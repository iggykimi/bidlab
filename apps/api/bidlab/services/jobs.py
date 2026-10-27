"""Extraction jobs: persisted record + inline run (T17).

Single-process design: the run endpoint executes the job synchronously and
returns its terminal state with 202. ``run_job`` is restart-safe: terminal
jobs (except ``failed``) are returned as-is, and a ``running`` job whose
lease expired may be reclaimed. Failed jobs may be retried as a new attempt.
"""

from __future__ import annotations

import datetime as dt
import secrets
from decimal import Decimal, InvalidOperation
from typing import TYPE_CHECKING, Any

from pydantic import ValidationError
from sqlalchemy import func, select

from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.schemas import generated as g
from bidlab.services import meta_adapter
from bidlab.services import pdf as pdf_service
from bidlab.settings import get_settings

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

LEASE_MINUTES = 10
NON_PROPOSED_CLAIM = frozenset({"not_found", "ambiguous", "unsupported"})


def route_for(tender_id: str) -> str:
    return f"POST /api/v1/tenders/{tender_id}/analysis"


def new_job_id() -> str:
    return f"job-{secrets.token_hex(8)}"


def _now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def _as_dict(value: object) -> dict[str, Any]:
    if isinstance(value, dict):
        return {str(key): item for key, item in value.items()}
    return {}


def _as_int(value: object, default: int = 0) -> int:
    if isinstance(value, bool):
        return default
    if isinstance(value, int):
        return value
    return default


def _as_str_list(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    return []


def current_revision(session: Session, tender_id: str) -> int:
    latest = session.scalar(
        select(func.max(models.InterpretationRevision.revision)).where(
            models.InterpretationRevision.tender_id == tender_id
        )
    )
    return int(latest or 0)


def get_job_or_404(session: Session, job_id: str) -> models.Job:
    job = session.get(models.Job, job_id)
    if job is None:
        raise ApiError(404, "job_not_found", f"unknown job {job_id}")
    return job


def job_to_dict(job: models.Job) -> dict[str, Any]:
    req = _as_dict(job.request_json)
    progress = _as_dict(req.get("progress"))
    return {
        "id": job.id,
        "tender_id": job.tender_id,
        "status": job.status,
        "stage": job.stage[:80],
        "processed_pages": _as_int(progress.get("processed_pages")),
        "total_pages": _as_int(progress.get("total_pages")),
        "result_revision": job.result_revision,
        "error_code": job.error_code,
        "warnings": _as_str_list(req.get("warnings"))[:30],
    }


def live_spend_usd(session: Session) -> Decimal:
    """Sum of reported live spend. Unreported usage is untracked by design."""
    total = Decimal("0")
    rows = session.scalars(
        select(models.ModelInvocation.estimated_cost_usd).where(
            models.ModelInvocation.mode == "live"
        )
    ).all()
    for raw in rows:
        if raw is None:
            continue
        try:
            total += Decimal(str(raw))
        except InvalidOperation:
            continue
    return total


def check_live_budget(session: Session) -> None:
    """Fail closed when reported live spend reaches the configured budget."""
    try:
        budget = Decimal(get_settings().bidlab_meta_budget_usd)
    except InvalidOperation:
        budget = Decimal("0")
    if live_spend_usd(session) >= budget:
        raise ApiError(429, "budget_exhausted", "live model budget exhausted")


def start_analysis(session: Session, tender_id: str, payload: g.AnalysisRequest) -> models.Job:
    tender = session.get(models.Tender, tender_id)
    if tender is None:
        raise ApiError(404, "tender_not_found", f"unknown tender {tender_id}")
    if payload.mode == "live" and not payload.allow_remote_processing:
        raise ApiError(
            400,
            "remote_processing_not_allowed",
            "live mode requires allow_remote_processing=true",
        )
    # Gate live availability BEFORE creating any record: no fake jobs.
    adapter = meta_adapter.select_adapter(payload.mode)
    expected = current_revision(session, tender_id)
    if payload.expected_interpretation_revision != expected:
        raise ApiError(
            409,
            "revision_conflict",
            f"expected interpretation revision {expected}, "
            f"got {payload.expected_interpretation_revision}",
        )
    doc_ids = list(dict.fromkeys(item.root for item in payload.document_ids))
    docs = session.scalars(select(models.Document).where(models.Document.id.in_(doc_ids))).all()
    by_id = {doc.id: doc for doc in docs}
    for doc_id in doc_ids:
        doc = by_id.get(doc_id)
        if doc is None:
            raise ApiError(404, "document_not_found", f"unknown document {doc_id}")
        if doc.tender_id != tender_id:
            raise ApiError(
                400, "document_wrong_tender", f"document {doc_id} is not from this tender"
            )
    total_pages = sum(by_id[doc_id].pages_count for doc_id in doc_ids)
    now = _now().isoformat()
    job = models.Job(
        id=new_job_id(),
        tender_id=tender_id,
        status="queued",
        request_json={
            "input": {
                "document_ids": doc_ids,
                "mode": payload.mode,
                "allow_remote_processing": payload.allow_remote_processing,
                "expected_interpretation_revision": (payload.expected_interpretation_revision),
            },
            "progress": {"processed_pages": 0, "total_pages": total_pages},
            "warnings": [],
            "attempts": 0,
        },
        stage="queued",
        worker_id=None,
        lease_until=None,
        result_revision=None,
        error_code=None,
        created_at=now,
        updated_at=now,
    )
    session.add(job)
    session.flush()
    return run_job(session, job.id, adapter=adapter)


def _update_request(
    job: models.Job,
    *,
    processed: int | None = None,
    warnings: list[str] | None = None,
    attempts: int | None = None,
    manifest: dict[str, Any] | None = None,
) -> None:
    req = _as_dict(job.request_json)
    progress = _as_dict(req.get("progress"))
    if processed is not None:
        progress["processed_pages"] = processed
    req["progress"] = progress
    if warnings is not None:
        req["warnings"] = warnings[:30]
    if attempts is not None:
        req["attempts"] = attempts
    if manifest is not None:
        req["manifest"] = manifest
    job.request_json = req


def _fail_job(
    session: Session,
    job: models.Job,
    *,
    code: str,
    message: str,
    mode: str,
    attempt: int,
    input_hash: str,
) -> models.Job:
    session.add(
        models.ModelInvocation(
            id=f"inv-{job.id}-a{attempt}",
            job_id=job.id,
            mode=mode,
            model=None,
            prompt_version=meta_adapter.PROMPT_VERSION,
            input_hash=input_hash,
            provider_request_id=None,
            prompt_tokens=None,
            completion_tokens=None,
            cached_tokens=None,
            estimated_cost_usd=None,
            latency_ms=0,
            status="failed",
            created_at=_now().isoformat(),
        )
    )
    job.status = "failed"
    job.stage = "failed"
    job.result_revision = None
    job.error_code = code[:80]
    job.updated_at = _now().isoformat()
    _update_request(job, warnings=[message[:2000]], attempts=attempt)
    session.flush()
    return job


def _iter_proposal_citations(proposal: dict[str, Any]) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    for claim in proposal.get("claims", []) or []:
        if isinstance(claim, dict):
            found.extend(c for c in (claim.get("citations", []) or []) if isinstance(c, dict))
    for req in proposal.get("requirements", []) or []:
        if isinstance(req, dict):
            found.extend(c for c in (req.get("citations", []) or []) if isinstance(c, dict))
    formula = proposal.get("pricing_formula")
    if isinstance(formula, dict):
        found.extend(c for c in (formula.get("citations", []) or []) if isinstance(c, dict))
    found.extend(c for c in (proposal.get("anomaly_citations", []) or []) if isinstance(c, dict))
    return found


def verify_and_store_citations(
    session: Session,
    *,
    id_prefix: str,
    proposal: dict[str, Any],
    text_by_page: dict[tuple[str, int], str],
    doc_sha256: dict[str, str],
) -> tuple[list[str], list[str], int]:
    """Locate every proposed citation, persist locatable ones, warn on gaps.

    Returns (citation_ids, warnings, unmatched_count). Citations whose page
    has no extracted text cannot satisfy the citation FK, so they are
    reported as warnings and skipped, never silently marked as verified.
    """
    ids: list[str] = []
    warnings: list[str] = []
    missing = 0
    for index, citation in enumerate(_iter_proposal_citations(proposal)):
        doc_id = str(citation.get("document_id", ""))
        page_raw = citation.get("page_number", 0)
        page_number = page_raw if isinstance(page_raw, int) else 0
        excerpt = str(citation.get("verbatim_excerpt", ""))
        page_text = text_by_page.get((doc_id, page_number))
        sha = doc_sha256.get(doc_id)
        if page_text is None or sha is None:
            missing += 1
            if len(warnings) < 5:
                warnings.append(f"citation {index}: no extracted text for {doc_id} p.{page_number}")
            continue
        match = pdf_service.locate_citation(page_text, excerpt)
        if match.match_status == "missing":
            missing += 1
            if len(warnings) < 5:
                warnings.append(f"citation {index}: quote not found on {doc_id} p.{page_number}")
        citation_id = f"{id_prefix}-{index:03d}"
        session.add(
            models.Citation(
                id=citation_id,
                document_id=doc_id,
                page_number=page_number,
                document_sha256=sha,
                quote=excerpt,
                match_status=match.match_status,
                normalized_start=match.normalized_start,
                normalized_end=match.normalized_end,
                normalization_version=pdf_service.NORMALIZATION_VERSION,
            )
        )
        ids.append(citation_id)
    if missing > 5:
        warnings.append(f"{missing} citations unmatched in total")
    return ids, warnings, missing


def run_job(
    session: Session, job_id: str, adapter: meta_adapter.ExtractionAdapter | None = None
) -> models.Job:
    job = get_job_or_404(session, job_id)
    if job.status in ("succeeded", "needs_review", "cancelled"):
        return job
    req = _as_dict(job.request_json)
    attempt = _as_int(req.get("attempts")) + 1
    if job.status == "running" and job.lease_until:
        try:
            leased = dt.datetime.fromisoformat(job.lease_until) > _now()
        except ValueError:
            leased = False
        if leased:
            raise ApiError(409, "job_running", f"job {job_id} is already running")
    job_input = _as_dict(req.get("input"))
    mode = str(job_input.get("mode", "curated_demo"))
    doc_ids = [str(item) for item in (job_input.get("document_ids", []) or [])]
    if adapter is None:
        adapter = meta_adapter.select_adapter(mode)
    job.status = "running"
    job.stage = "extracting"
    job.worker_id = "api-inline"
    job.lease_until = (_now() + dt.timedelta(minutes=LEASE_MINUTES)).isoformat()
    job.updated_at = _now().isoformat()
    _update_request(job, attempts=attempt)
    session.flush()

    pages = session.scalars(
        select(models.DocumentPage)
        .where(models.DocumentPage.document_id.in_(doc_ids))
        .order_by(models.DocumentPage.document_id, models.DocumentPage.page_number)
    ).all()
    inputs = [
        meta_adapter.PageInput(
            document_id=page.document_id,
            page_number=page.page_number,
            normalized_text=page.normalized_text,
        )
        for page in pages
    ]
    input_hash = meta_adapter.pages_input_hash(inputs)
    run_started = _now().isoformat()
    try:
        if adapter.is_live:
            check_live_budget(session)
        result = adapter.extract(inputs)
    except ApiError:
        _fail_job(
            session,
            job,
            code="budget_exhausted",
            message="live model budget exhausted",
            mode="live",
            attempt=attempt,
            input_hash=input_hash,
        )
        # The request scope rolls back on 429: commit the failed job and its
        # invocation first so the 429 keeps an auditable trace.
        session.commit()
        raise
    except meta_adapter.AdapterError as exc:
        return _fail_job(
            session,
            job,
            code=exc.code,
            message=f"{exc.code}: {exc.message}",
            mode="fixture",
            attempt=attempt,
            input_hash=input_hash,
        )

    try:
        proposal = g.ExtractionProposal.model_validate(result.proposal)
    except ValidationError as exc:
        return _fail_job(
            session,
            job,
            code="invalid_model_output",
            message=f"invalid_model_output: proposal failed schema ({exc.error_count()})",
            mode=result.mode,
            attempt=attempt,
            input_hash=input_hash,
        )
    proposal_data = proposal.model_dump(mode="json")

    docs = session.scalars(select(models.Document).where(models.Document.id.in_(doc_ids))).all()
    doc_sha256 = {doc.id: doc.sha256 for doc in docs}
    by_doc: dict[str, int] = {}
    for page in pages:
        by_doc[page.document_id] = by_doc.get(page.document_id, 0) + 1
    job_warnings = list(result.warnings)
    for doc in docs:
        have = by_doc.get(doc.id, 0)
        if have < doc.pages_count:
            job_warnings.append(f"document {doc.id}: {have} of {doc.pages_count} pages have text")

    text_by_page = {(page.document_id, page.page_number): page.normalized_text for page in pages}
    citation_ids, citation_warnings, unmatched = verify_and_store_citations(
        session,
        id_prefix=f"cit-{job.id}-a{attempt}",
        proposal=proposal_data,
        text_by_page=text_by_page,
        doc_sha256=doc_sha256,
    )
    job_warnings.extend(citation_warnings)

    new_revision = current_revision(session, job.tender_id) + 1
    session.add(
        models.InterpretationRevision(
            tender_id=job.tender_id,
            revision=new_revision,
            mode=result.mode,
            proposal_json=proposal_data,
            reviewed_json={"status": "pending_review", "approved_claim_keys": []},
            document_hashes_json=dict(doc_sha256),
            actor="meta-live" if adapter.is_live else "meta-stub",
            reason=f"analysis job {job.id}",
            created_at=_now().isoformat(),
        )
    )
    session.add(
        models.ModelInvocation(
            id=f"inv-{job.id}-a{attempt}",
            job_id=job.id,
            mode=result.mode,
            model=result.model,
            prompt_version=meta_adapter.PROMPT_VERSION,
            input_hash=input_hash,
            provider_request_id=result.provider_request_id,
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            cached_tokens=result.cached_tokens,
            estimated_cost_usd=result.estimated_cost_usd,
            latency_ms=result.latency_ms,
            status="ok",
            created_at=_now().isoformat(),
        )
    )
    claims = proposal_data.get("claims", []) or []
    weak_claim = any(
        isinstance(claim, dict) and claim.get("status") in NON_PROPOSED_CLAIM for claim in claims
    )
    needs_review = bool(job_warnings) or bool(proposal.unread_pages) or weak_claim or unmatched > 0
    manifest = meta_adapter.build_run_manifest(
        run_id=f"inv-{job.id}-a{attempt}",
        mode=result.mode,
        pages=inputs,
        model_requested=result.model,
        model_returned=result.returned_model,
        schema_version=str(proposal_data.get("schema_version", meta_adapter.SCHEMA_VERSION)),
        status="ok",
        provider_request_id=result.provider_request_id,
        prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens,
        cached_tokens=result.cached_tokens,
        proposal=proposal_data,
        citation_ids=citation_ids,
        citations_unmatched=unmatched,
        started_at=run_started,
        finished_at=_now().isoformat(),
    )
    job.status = "needs_review" if needs_review else "succeeded"
    job.stage = "awaiting_review" if needs_review else "done"
    job.result_revision = new_revision
    job.error_code = None
    job.updated_at = _now().isoformat()
    _update_request(job, processed=len(inputs), warnings=job_warnings, manifest=manifest)
    session.flush()
    return job
