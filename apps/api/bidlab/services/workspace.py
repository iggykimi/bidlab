"""Read-model assembly: Tender/Scope/Workspace/Document/Page/Citation dicts."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.services import consistency as consistency_service
from bidlab.services import pdf as pdf_service

RIGHTS_MAP = {
    "research_only": "research_only",
    "reviewed_for_demo": "reviewed_for_demo",
    "redistribution_allowed": "redistribution_allowed",
    "research_copy_pending_publication_review": "research_only",
}
PARSE_MAP = {
    "queued": "queued",
    "ready": "ready",
    "needs_review": "needs_review",
    "failed": "failed",
    "metadata_only_curated_excerpts": "needs_review",
}
# feed_id -> Tender.origin. Intake writes "local", placsp_import writes its
# FEED_ID ("placsp_deeplink"; literal here because placsp_import imports this
# module, so importing the constant would cycle; a test pins the equality).
# Curated seeds are the only other producer and carry feed URLs as feed_id.
ORIGIN_BY_FEED = {"local": "local", "placsp_deeplink": "placsp"}


def origin_for(feed_id: str) -> str:
    return ORIGIN_BY_FEED.get(feed_id, "seed")


def money_or_none(cents: int | None) -> str | None:
    if cents is None:
        return None
    return f"{cents // 100}.{cents % 100:02d}"


def scope_to_dict(scope: models.Scope) -> dict[str, Any]:
    basis = scope.basis_json if isinstance(scope.basis_json, dict) else {}
    period = basis.get("period_months")
    if scope.lot_key == "__whole__":
        if isinstance(period, int):
            label = f"Contrato inicial completo ({period} meses)"
        else:
            label = "Contrato completo"
    else:
        label = scope.lot_key
    return {
        "id": scope.id,
        "tender_id": scope.tender_id,
        "lot_id": None if scope.lot_key == "__whole__" else scope.lot_key,
        "label": label,
        "basis": basis,
    }


def tender_to_dict(session: Session, tender_id: str) -> dict[str, Any]:
    tender = session.get(models.Tender, tender_id)
    if tender is None:
        raise ApiError(404, "tender_not_found", f"unknown tender {tender_id}")
    meta = tender.metadata_json if isinstance(tender.metadata_json, dict) else {}
    scopes = session.scalars(
        select(models.Scope).where(models.Scope.tender_id == tender_id).order_by(models.Scope.id)
    ).all()
    notice = session.scalars(
        select(models.NoticeVersion)
        .where(models.NoticeVersion.tender_id == tender_id, models.NoticeVersion.tombstone == 0)
        .order_by(models.NoticeVersion.updated_utc.desc())
    ).first()
    first_budget = scopes[0].budget_net_cents if scopes else None
    return {
        "raw_snapshot_sha256": notice.raw_sha256 if notice else "",
        "metadata_evidence": meta.get("metadata_evidence", []),
        "id": tender.id,
        "origin": origin_for(tender.feed_id),
        "source_id": tender.atom_id,
        "source_url": tender.source_url,
        "external_id": tender.external_id,
        "title": tender.title,
        "contracting_body": str(meta.get("contracting_body", "")),
        "cpv_codes": meta.get("cpv_codes", []),
        "status_raw": str(meta.get("status_raw", "")),
        "source_updated_at": tender.source_updated_at,
        "deadline_literal": meta.get("deadline_literal"),
        "deadline_at": meta.get("deadline_at"),
        "pbl_net": money_or_none(first_budget),
        "pbl_gross": meta.get("pbl_gross"),
        "estimated_value": meta.get("estimated_value"),
        "scopes": [scope_to_dict(scope) for scope in scopes],
        "quality_flags": meta.get("quality_flags", []),
    }


def document_to_dict(doc: models.Document) -> tuple[dict[str, Any], list[str]]:
    warnings: list[str] = []
    rights = RIGHTS_MAP.get(doc.rights_status)
    if rights is None:
        warnings.append(f"document {doc.id}: unmapped rights_status {doc.rights_status!r}")
        rights = "unknown"
    elif rights != doc.rights_status:
        warnings.append(
            f"document {doc.id}: internal status {doc.rights_status!r} served as {rights!r}"
        )
    parse = PARSE_MAP.get(doc.parse_status)
    if parse is None:
        warnings.append(f"document {doc.id}: unmapped parse_status {doc.parse_status!r}")
        parse = "needs_review"
    elif parse != doc.parse_status:
        warnings.append(
            f"document {doc.id}: internal status {doc.parse_status!r} served as {parse!r}"
        )
    if not doc.blob_path:
        warnings.append(
            f"document {doc.id}: original bytes not redistributed; metadata and excerpts only"
        )
    return (
        {
            "id": doc.id,
            "tender_id": doc.tender_id,
            "kind": doc.kind,
            "display_name": doc.display_name,
            "sha256": doc.sha256,
            "pages_count": doc.pages_count,
            "source_url": doc.source_url,
            "rights_status": rights,
            "parse_status": parse,
        },
        warnings,
    )


def page_to_dict(page: models.DocumentPage) -> dict[str, Any]:
    flags = page.flags_json if isinstance(page.flags_json, dict) else {}
    return {
        "document_id": page.document_id,
        "page_number": page.page_number,
        "printed_label": None,
        "raw_text": page.raw_text,
        "normalized_text": page.normalized_text,
        "text_sha256": page.text_sha256,
        "extractor_version": page.extractor_version,
        "quality_flags": sorted(str(k) for k, v in flags.items() if v),
    }


def citation_to_dict(cit: models.Citation) -> dict[str, Any]:
    return {
        "id": cit.id,
        "document_id": cit.document_id,
        "document_sha256": cit.document_sha256,
        "page_number": cit.page_number,
        "printed_label": None,
        "verbatim_excerpt": cit.quote,
        "match_status": cit.match_status,
        "normalized_start": cit.normalized_start,
        "normalized_end": cit.normalized_end,
        "normalization_version": cit.normalization_version,
    }


def get_workspace(session: Session, tender_id: str, mode: str) -> dict[str, Any]:
    tender = tender_to_dict(session, tender_id)
    interps = session.scalars(
        select(models.InterpretationRevision)
        .where(models.InterpretationRevision.tender_id == tender_id)
        .order_by(models.InterpretationRevision.revision.desc())
    ).all()
    latest = interps[0] if interps else None
    proposal = latest.proposal_json if latest and isinstance(latest.proposal_json, dict) else {}
    reviewed = latest.reviewed_json if latest and isinstance(latest.reviewed_json, dict) else {}
    docs = session.scalars(
        select(models.Document)
        .where(models.Document.tender_id == tender_id)
        .order_by(models.Document.id)
    ).all()
    documents: list[dict[str, Any]] = []
    warnings: list[str] = []
    for doc in docs:
        payload, doc_warnings = document_to_dict(doc)
        documents.append(payload)
        warnings.extend(doc_warnings)
    doc_ids = [doc.id for doc in docs]
    if doc_ids:
        page_rows = session.scalars(
            select(models.DocumentPage)
            .where(models.DocumentPage.document_id.in_(doc_ids))
            .order_by(models.DocumentPage.document_id, models.DocumentPage.page_number)
        ).all()
        by_doc: dict[str, list[models.DocumentPage]] = {}
        for row in page_rows:
            by_doc.setdefault(row.document_id, []).append(row)
        for doc in docs:
            report = pdf_service.coverage(
                {doc.id: doc.pages_count},
                [
                    pdf_service.CoveragePage(
                        document_id=row.document_id,
                        physical_page=row.page_number,
                        text=row.normalized_text,
                        flags=tuple(
                            str(key)
                            for key, value in (
                                row.flags_json.items() if isinstance(row.flags_json, dict) else []
                            )
                            if value
                        ),
                    )
                    for row in by_doc.get(doc.id, [])
                ],
            )
            warnings.extend(pdf_service.coverage_warning_lines(report, limit=3))
    raw_claims = proposal.get("claims", [])
    claims = raw_claims if isinstance(raw_claims, list) else []
    tree = reviewed.get("requirements_tree")
    requirements = [tree] if isinstance(tree, dict) else []
    citations: list[dict[str, Any]] = []
    if doc_ids:
        rows = session.scalars(
            select(models.Citation)
            .where(models.Citation.document_id.in_(doc_ids))
            .order_by(models.Citation.document_id, models.Citation.page_number, models.Citation.id)
        ).all()
        citations = [citation_to_dict(cit) for cit in rows]
    scope_ids = [scope["id"] for scope in tender["scopes"]]
    pricing_rules: list[dict[str, Any]] = []
    if scope_ids:
        revisions = session.scalars(
            select(models.RuleRevision)
            .where(models.RuleRevision.scope_id.in_(scope_ids))
            .order_by(models.RuleRevision.rule_id, models.RuleRevision.revision.desc())
        ).all()
        seen: set[str] = set()
        for rev in revisions:
            if rev.rule_id in seen:
                continue
            seen.add(rev.rule_id)
            if isinstance(rev.rule_json, dict):
                pricing_rules.append(rev.rule_json)
    if latest is None:
        warnings.append("no interpretation yet for this tender")
    return {
        "tender": tender,
        "interpretation_revision": latest.revision if latest else 0,
        "mode": mode,
        "documents": documents,
        "claims": claims,
        "requirements": requirements,
        "citations": citations,
        "pricing_rules": pricing_rules,
        # T20: observations v2 are not persisted per tender yet (only the
        # proposal plus manifest hashes), so real items are honestly empty
        # until then; the labeled synthetic example still demos the radar.
        "consistency": consistency_service.build_report(()),
        "warnings": warnings,
    }
