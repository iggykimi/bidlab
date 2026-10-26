"""Semantic review of extraction proposals (T18).

A review approves claim keys, optionally replaces the proposal with a
corrected one, and records requirement trees plus scope/pricing decisions as
a new ``manual`` interpretation revision. Locating citations and semantic
review stay distinct states: corrected citations are located and stored with
their real ``match_status`` (``missing`` included), never upgraded silently.
Every review writes an audit event.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.schemas import generated as g
from bidlab.services import jobs as jobs_service
from bidlab.services import workspace as workspace_service
from bidlab.settings import get_settings


def route_for(tender_id: str) -> str:
    return f"POST /api/v1/tenders/{tender_id}/reviews"


def _now() -> str:
    return dt.datetime.now(dt.UTC).isoformat()


def _as_dict(value: object) -> dict[str, Any]:
    if isinstance(value, dict):
        return {str(key): item for key, item in value.items()}
    return {}


def latest_revision_row(
    session: Session, tender_id: str
) -> models.InterpretationRevision | None:
    return session.scalars(
        select(models.InterpretationRevision)
        .where(models.InterpretationRevision.tender_id == tender_id)
        .order_by(models.InterpretationRevision.revision.desc())
    ).first()


def apply_review(
    session: Session, tender_id: str, payload: g.ReviewRequest
) -> dict[str, Any]:
    tender = session.get(models.Tender, tender_id)
    if tender is None:
        raise ApiError(404, "tender_not_found", f"unknown tender {tender_id}")
    latest = latest_revision_row(session, tender_id)
    if latest is None:
        raise ApiError(409, "nothing_to_review", f"no interpretation for {tender_id}")
    if payload.expected_revision != latest.revision:
        raise ApiError(
            409,
            "revision_conflict",
            f"expected interpretation revision {latest.revision}, "
            f"got {payload.expected_revision}",
        )
    proposal_data = (
        payload.corrected_proposal.model_dump(mode="json")
        if payload.corrected_proposal is not None
        else _as_dict(latest.proposal_json)
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
    new_revision = latest.revision + 1
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
                (page.document_id, page.page_number): page.normalized_text
                for page in pages
            },
            doc_sha256={doc.id: doc.sha256 for doc in docs},
        )
    trees = [tree.model_dump(mode="json") for tree in payload.requirement_trees]
    previous = _as_dict(latest.reviewed_json)
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
            document_hashes_json=_as_dict(latest.document_hashes_json),
            actor=payload.actor,
            reason=payload.reason,
            created_at=_now(),
        )
    )
    session.add(
        models.AuditEvent(
            id=f"audit-{tender_id}-interp-{new_revision}",
            entity_type="interpretation",
            entity_id=f"{tender_id}:{new_revision}",
            actor=payload.actor,
            reason=payload.reason,
            old_json={"revision": latest.revision},
            new_json={"revision": new_revision, "approved_claim_keys": approved},
            created_at=_now(),
        )
    )
    session.flush()
    return workspace_service.get_workspace(session, tender_id, get_settings().bidlab_mode)
