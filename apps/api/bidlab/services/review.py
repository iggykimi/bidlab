"""Semantic review of extraction proposals (T18).

A review approves claim keys, optionally replaces the proposal with a
corrected one, and records requirement trees plus scope/pricing decisions as
a new ``manual`` interpretation revision. Locating citations and semantic
review stay distinct states: corrected citations are located and stored with
their real ``match_status`` (``missing`` included), never upgraded silently.
An approved ``pricing_rule`` also materializes as a ``RuleRevision`` and an
approved ``scope_basis`` updates its scope, so own tenders can evaluate;
pending/blocked payloads are only recorded. Every review writes an audit event.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal, InvalidOperation
from typing import TYPE_CHECKING, Any

from sqlalchemy import select

from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.domain import expressions as EX
from bidlab.services import jobs as jobs_service
from bidlab.services import pdf as pdf_service
from bidlab.services import workspace as workspace_service
from bidlab.settings import get_settings

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from bidlab.schemas import generated as g


def route_for(tender_id: str) -> str:
    return f"POST /api/v1/tenders/{tender_id}/reviews"


def _now() -> str:
    return dt.datetime.now(dt.UTC).isoformat()


def _as_dict(value: object) -> dict[str, Any]:
    if isinstance(value, dict):
        return {str(key): item for key, item in value.items()}
    return {}


def _validate_rule_expression(rule: dict[str, Any]) -> None:
    """Approve-time expression check mirroring evaluation (same AST/template rules).

    Evaluation parses the stored expression and requires it to equal the
    canonical AST of its template; anything it would reject is rejected here
    as ``rule_expression_invalid`` so an approved rule always executes.
    """
    stored = rule.get("expression")
    template_id = rule.get("template_id")
    if not isinstance(stored, dict) or not isinstance(template_id, str):
        raise ApiError(422, "rule_expression_invalid", "rule lacks expression/template_id")
    try:
        parsed = EX.parse_expr(stored)
    except EX.ExprError as exc:
        raise ApiError(422, "rule_expression_invalid", f"expression invalid: {exc}") from exc
    try:
        canonical = EX.template_for(template_id)
    except EX.ExprError as exc:
        raise ApiError(422, "rule_expression_invalid", f"unknown template {template_id}") from exc
    if parsed != canonical:
        raise ApiError(422, "rule_expression_invalid", "stored AST differs from its template")


def _basis_budget_cents(budget_net: object) -> int:
    """Approved-basis budget as integer cents; unparseable/non-positive is 422."""
    if not isinstance(budget_net, str):
        raise ApiError(422, "basis_budget_invalid", "approved basis requires budget_net")
    try:
        cents = int(Decimal(budget_net) * 100)
    except InvalidOperation:
        raise ApiError(
            422, "basis_budget_invalid", f"budget_net unparseable: {budget_net!r}"
        ) from None
    if cents <= 0:
        raise ApiError(422, "basis_budget_invalid", "budget_net must be > 0")
    return cents


def latest_revision_row(session: Session, tender_id: str) -> models.InterpretationRevision | None:
    return session.scalars(
        select(models.InterpretationRevision)
        .where(models.InterpretationRevision.tender_id == tender_id)
        .order_by(models.InterpretationRevision.revision.desc())
    ).first()


def _validate_approved_claims(
    session: Session,
    tender_id: str,
    proposal: dict[str, Any],
    approved_keys: list[str],
    expected_hashes: dict[str, Any],
) -> None:
    """Approval requires located sources, not a browser-supplied badge.

    Matching is checked against the current physical page and file version.
    It only establishes citation location; the actor still owns semantic
    approval. An unknown/ambiguous value cannot be approved as a found fact.
    """
    claims = [item for item in proposal.get("claims", []) if isinstance(item, dict)]
    for key in approved_keys:
        candidates = [claim for claim in claims if claim.get("key") == key]
        if len(candidates) != 1:
            raise ApiError(422, "unknown_claim_key", f"claim {key}: missing or duplicate key")
        claim = candidates[0]
        value = claim.get("normalized_value")
        if claim.get("status") != "proposed" or not isinstance(value, str) or not value.strip():
            raise ApiError(
                422, "claim_not_reviewable", f"claim {key}: correct the unknown value first"
            )
        citations = claim.get("citations")
        if not isinstance(citations, list) or not citations:
            raise ApiError(422, "citation_unverified", f"claim {key}: no supporting citation")
        for citation in citations:
            if not isinstance(citation, dict):
                raise ApiError(422, "citation_unverified", f"claim {key}: invalid citation")
            doc_id = citation.get("document_id")
            page_no = citation.get("page_number")
            quote = citation.get("verbatim_excerpt")
            doc = session.get(models.Document, doc_id) if isinstance(doc_id, str) else None
            if doc is None or doc.tender_id != tender_id:
                raise ApiError(
                    422, "citation_unverified", f"claim {key}: source outside this tender"
                )
            if expected_hashes.get(doc.id) != doc.sha256:
                raise ApiError(409, "revision_conflict", f"claim {key}: document version changed")
            page = session.get(models.DocumentPage, (doc.id, page_no))
            if (
                page is None
                or not isinstance(quote, str)
                or pdf_service.locate_citation(page.normalized_text, quote).match_status
                == "missing"
            ):
                raise ApiError(
                    422, "citation_unverified", f"claim {key}: quote not found on its page"
                )


def apply_review(session: Session, tender_id: str, payload: g.ReviewRequest) -> dict[str, Any]:
    tender = session.get(models.Tender, tender_id)
    if tender is None:
        raise ApiError(404, "tender_not_found", f"unknown tender {tender_id}")
    latest = latest_revision_row(session, tender_id)
    if latest is None:
        # Manual tender without any analysis yet: the user is the source, so
        # expected 0 opens revision 1. Anything else is a genuine conflict.
        if payload.expected_revision != 0:
            raise ApiError(
                409,
                "revision_conflict",
                f"expected interpretation revision 0, got {payload.expected_revision}",
            )
        base_proposal: dict[str, Any] = {}
        previous: dict[str, Any] = {}
        doc_hashes: dict[str, Any] = {}
        new_revision = 1
    else:
        if payload.expected_revision != latest.revision:
            raise ApiError(
                409,
                "revision_conflict",
                f"expected revision {latest.revision}, got {payload.expected_revision}",
            )
        base_proposal = _as_dict(latest.proposal_json)
        previous = _as_dict(latest.reviewed_json)
        doc_hashes = _as_dict(latest.document_hashes_json)
        new_revision = latest.revision + 1
    proposal_data = (
        payload.corrected_proposal.model_dump(mode="json")
        if payload.corrected_proposal is not None
        else base_proposal
    )
    claim_keys = {
        str(claim["key"])
        for claim in (proposal_data.get("claims", []) or [])
        if isinstance(claim, dict) and "key" in claim
    }
    unknown = [key.root for key in payload.approved_claim_keys if key.root not in claim_keys]
    if unknown:
        raise ApiError(
            422, "unknown_claim_key", f"unknown claim keys: {', '.join(sorted(unknown))}"
        )
    # An explicit correction can cite another current document from this
    # tender. Record the new version set; unchanged proposals must still
    # match the versions their extraction actually used.
    if payload.corrected_proposal is not None:
        current_docs = session.scalars(
            select(models.Document).where(models.Document.tender_id == tender_id)
        ).all()
        doc_hashes = {doc.id: doc.sha256 for doc in current_docs}
    _validate_approved_claims(
        session,
        tender_id,
        proposal_data,
        [key.root for key in payload.approved_claim_keys],
        doc_hashes,
    )
    # Materialization plan: validate EVERYTHING before persisting anything, so a
    # 409/422 below leaves no orphan InterpretationRevision behind. Only an
    # approved payload materializes; pending/blocked (or absent) payloads are
    # recorded in reviewed_json alone.
    pricing_dump: dict[str, Any] | None = None
    rule_id = ""
    rule_revision_no = 0
    rule_scope_id = ""
    if payload.pricing_rule is not None and payload.pricing_rule.review_status == "approved":
        pricing_dump = payload.pricing_rule.model_dump(mode="json")
        rule_id = payload.pricing_rule.id.root
        rule_revision_no = payload.pricing_rule.revision
        rule_scope_id = payload.pricing_rule.scope_id.root
        rule_scope = session.get(models.Scope, rule_scope_id)
        if rule_scope is None or rule_scope.tender_id != tender_id:
            raise ApiError(
                422, "rule_scope_mismatch", f"scope {rule_scope_id}: not part of {tender_id}"
            )
        _validate_rule_expression(pricing_dump)
        if session.get(models.RuleRevision, (rule_id, rule_revision_no)) is not None:
            raise ApiError(
                409,
                "rule_revision_conflict",
                f"rule {rule_id}:{rule_revision_no} already exists",
            )
    basis_dump: dict[str, Any] | None = None
    basis_row: models.Scope | None = None
    basis_cents = 0
    if payload.scope_basis is not None and payload.scope_basis.review_status == "approved":
        basis_dump = payload.scope_basis.model_dump(mode="json")
        basis_scope_id = payload.scope_basis.scope_id.root
        basis_row = session.get(models.Scope, basis_scope_id)
        if basis_row is None:
            raise ApiError(404, "scope_not_found", f"unknown scope {basis_scope_id}")
        if basis_row.tender_id != tender_id:
            raise ApiError(
                422, "scope_tender_mismatch", f"scope {basis_scope_id}: not part of {tender_id}"
            )
        basis_cents = _basis_budget_cents(basis_dump.get("budget_net"))
    if payload.corrected_proposal is not None:
        docs = session.scalars(
            select(models.Document).where(models.Document.tender_id == tender_id)
        ).all()
        doc_ids = [doc.id for doc in docs]
        pages = session.scalars(
            select(models.DocumentPage)
            .where(models.DocumentPage.document_id.in_(doc_ids))
            .order_by(models.DocumentPage.document_id, models.DocumentPage.page_number)
        ).all()
        jobs_service.verify_and_store_citations(
            session,
            id_prefix=f"cit-{tender_id}-r{new_revision}",
            proposal=proposal_data,
            text_by_page={
                (page.document_id, page.page_number): page.normalized_text for page in pages
            },
            doc_sha256={doc.id: doc.sha256 for doc in docs},
        )
    trees = [tree.model_dump(mode="json") for tree in payload.requirement_trees]
    approved = [key.root for key in payload.approved_claim_keys]
    reviewed = {
        "status": "reviewed",
        "approved_claim_keys": approved,
        "requirements_tree": trees[0] if trees else previous.get("requirements_tree"),
        "scope_basis": (
            payload.scope_basis.model_dump(mode="json")
            if payload.scope_basis is not None
            else previous.get("scope_basis")
        ),
        "pricing_rule": (
            payload.pricing_rule.model_dump(mode="json")
            if payload.pricing_rule is not None
            else previous.get("pricing_rule")
        ),
    }
    session.add(
        models.InterpretationRevision(
            tender_id=tender_id,
            revision=new_revision,
            mode="manual",
            proposal_json=proposal_data,
            reviewed_json=reviewed,
            document_hashes_json=doc_hashes,
            actor=payload.actor,
            reason=payload.reason,
            created_at=_now(),
        )
    )
    if pricing_dump is not None:
        session.add(
            models.RuleRevision(
                rule_id=rule_id,
                revision=rule_revision_no,
                scope_id=rule_scope_id,
                interpretation_revision=new_revision,
                rule_json=pricing_dump,
                review_status="approved",
                actor=payload.actor,
                reason=payload.reason,
                created_at=_now(),
            )
        )
    if basis_dump is not None and basis_row is not None:
        basis_row.basis_json = basis_dump
        basis_row.budget_net_cents = basis_cents
    session.add(
        models.AuditEvent(
            id=f"audit-{tender_id}-interp-{new_revision}",
            entity_type="interpretation",
            entity_id=f"{tender_id}:{new_revision}",
            actor=payload.actor,
            reason=payload.reason,
            old_json={"revision": new_revision - 1},
            new_json={"revision": new_revision, "approved_claim_keys": approved},
            created_at=_now(),
        )
    )
    session.flush()
    return workspace_service.get_workspace(session, tender_id, get_settings().bidlab_mode)
