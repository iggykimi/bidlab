"""Extraction jobs: queued admission + worker attempts (PKG-T03).

Single-process design: the run endpoint persists a queued job and returns
202 immediately; a worker thread claims it (compare-and-swap on
status/lease/generation), extracts with no job transaction open, and
publishes through a generation fence. Terminal jobs are returned as-is,
failed jobs may be retried as new attempts, and lease-expired running jobs
may be reclaimed; a publish from a superseded claim is rolled back.
Live attempts reserve spend before the call and settle the reported cost
(PKG-T02); only attempts that never reach the network release the hold.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import secrets
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import TYPE_CHECKING, Any

from pydantic import ValidationError
from sqlalchemy import func, select, update
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.orm import Session

from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.schemas import generated as g
from bidlab.services import budget as budget_service
from bidlab.services import meta_adapter, page_selection
from bidlab.services import pdf as pdf_service
from bidlab.services import render as render_service
from bidlab.settings import get_settings

if TYPE_CHECKING:
    from collections.abc import Sequence
    from pathlib import Path

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


def latest_invocation(session: Session, job_id: str) -> models.ModelInvocation | None:
    """Newest invocation row for a job (attempts publish sequentially)."""
    return session.scalars(
        select(models.ModelInvocation)
        .where(models.ModelInvocation.job_id == job_id)
        .order_by(models.ModelInvocation.created_at.desc())
        .limit(1)
    ).first()


def _capped(value: str | None, limit: int) -> str | None:
    """Clip an unbounded stored string to its contract length."""
    if value is None:
        return None
    return value[:limit]


def job_to_dict(session: Session, job: models.Job) -> dict[str, Any]:
    req = _as_dict(job.request_json)
    progress = _as_dict(req.get("progress"))
    invocation = latest_invocation(session, job.id)
    mode = invocation.mode if invocation is not None else None
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
        "invocation_id": invocation.id if invocation is not None else None,
        "mode": mode if mode in ("fixture", "live") else None,
        "model": _capped(invocation.model if invocation is not None else None, 80),
        "prompt_tokens": invocation.prompt_tokens if invocation is not None else None,
        "completion_tokens": (invocation.completion_tokens if invocation is not None else None),
        "estimated_cost_usd": _capped(
            invocation.estimated_cost_usd if invocation is not None else None, 32
        ),
        "provider_request_id": _capped(
            invocation.provider_request_id if invocation is not None else None, 200
        ),
        "latency_ms": invocation.latency_ms if invocation is not None else None,
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


def _engine_of(session: Session) -> Engine:
    bind = session.get_bind()
    if isinstance(bind, Engine):
        return bind
    if isinstance(bind, Connection):
        return bind.engine
    msg = "database bind unavailable"
    raise AssertionError(msg)


def check_live_budget(session: Session) -> None:
    """Fail closed when held + settled spend reaches the configured budget."""
    engine = _engine_of(session)
    cap = budget_service.budget_cap_micro_usd()
    held_spend = budget_service.totals(engine, ceiling_micro=cap)
    if held_spend["uncertain"]:
        raise ApiError(
            429, "budget_exhausted", "live usage needs reconciliation before another run"
        )
    if held_spend["spent"] + held_spend["held"] >= held_spend["ceiling"]:
        raise ApiError(429, "budget_exhausted", "live model budget exhausted")


def _settle_attempt(
    engine: Engine,
    key: str,
    *,
    sent: bool,
    cost_usd: str | None,
) -> None:
    """Settle known usage; keep unknown usage held until reconciled."""
    if not sent:
        budget_service.release_untransmitted_dispatch(engine, key)
        return
    if cost_usd is None:
        budget_service.mark_uncertain(engine, key)
        return
    actual = budget_service.usd_str_to_micro(cost_usd)
    budget_service.settle(engine, key, actual_micro=actual, receipt=key)


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
    # The worker re-selects; this call only validates key + endpoint.
    meta_adapter.select_adapter(payload.mode)
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
                "document_hashes": {doc_id: by_id[doc_id].sha256 for doc_id in doc_ids},
            },
            "progress": {"processed_pages": 0, "total_pages": total_pages},
            "warnings": [],
            "attempts": 0,
        },
        stage="queued",
        generation=1,
        worker_id=None,
        lease_until=None,
        result_revision=None,
        error_code=None,
        created_at=now,
        updated_at=now,
    )
    session.add(job)
    session.flush()
    # Admission commits here: the worker must see the queued job, and the
    # budget pre-check below stays auditable even when it fails fast. The
    # authoritative admission is the worker-side reservation (PKG-T02).
    session.commit()
    if payload.mode == "live":
        try:
            check_live_budget(session)
        except ApiError:
            _fail_admission_over_budget(session, job, doc_ids)
            session.commit()
            raise
    return job


def _fail_admission_over_budget(session: Session, job: models.Job, doc_ids: list[str]) -> None:
    # Fast 429 as failed attempt 1 (auditable, retry-safe).
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
    _fail_job(
        session,
        job,
        code="budget_exhausted",
        message="live model budget exhausted",
        mode="live",
        attempt=1,
        input_hash=meta_adapter.pages_input_hash(inputs),
    )


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
    receipt: meta_adapter.Receipt | None = None,
) -> models.Job:
    _record_invocation(
        session,
        job_id=job.id,
        attempt=attempt,
        input_hash=input_hash,
        mode=mode,
        receipt=receipt,
        status=receipt.status if receipt is not None else "failed",
    )
    job.status = "failed"
    job.stage = "failed"
    job.result_revision = None
    job.error_code = code[:80]
    job.updated_at = _now().isoformat()
    _update_request(job, warnings=[message[:2000]], attempts=attempt)
    session.flush()
    return job


def _record_invocation(
    session: Session,
    *,
    job_id: str,
    attempt: int,
    input_hash: str,
    mode: str,
    receipt: meta_adapter.Receipt | None,
    status: str,
    created_at: str | None = None,
) -> None:
    """Keep transport evidence independently of proposal promotion.

    Promotion can subsequently mark the same invocation failed; it cannot
    erase the usage already committed by execution. Recovery without a
    receipt also leaves any previously reported metrics intact.
    """
    invocation_id = f"inv-{job_id}-a{attempt}"
    row = session.get(models.ModelInvocation, invocation_id)
    if row is None:
        row = models.ModelInvocation(
            id=invocation_id,
            job_id=job_id,
            mode=mode,
            prompt_version=meta_adapter.PROMPT_VERSION,
            input_hash=input_hash,
            latency_ms=0,
            status=status,
            created_at=created_at or _now().isoformat(),
        )
        session.add(row)
    row.status = status
    if receipt is not None:
        row.mode = receipt.mode
        row.model = receipt.model
        row.provider_request_id = receipt.provider_request_id
        row.prompt_tokens = receipt.prompt_tokens
        row.completion_tokens = receipt.completion_tokens
        row.cached_tokens = receipt.cached_tokens
        row.estimated_cost_usd = receipt.estimated_cost_usd
        row.latency_ms = receipt.latency_ms


def _outcome_receipt(outcome: AttemptOutcome) -> meta_adapter.Receipt | None:
    if outcome.error is not None:
        return outcome.error.receipt
    result = outcome.result
    if result is None:
        return None
    return meta_adapter.Receipt(
        mode=result.mode,
        model=result.model,
        provider_request_id=result.provider_request_id,
        prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens,
        cached_tokens=result.cached_tokens,
        estimated_cost_usd=result.estimated_cost_usd,
        latency_ms=result.latency_ms,
        status=result.status,
        sent=outcome.live,
    )


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


@dataclass(frozen=True)
class AttemptClaim:
    """A worker's exclusive lease on one job attempt (CAS-claimed)."""

    job_id: str
    attempt: int
    generation: int
    tender_id: str
    mode: str
    doc_ids: tuple[str, ...]
    worker_id: str
    expected_revision: int | None = None
    document_hashes: tuple[tuple[str, str], ...] = ()


@dataclass(frozen=True)
class AttemptOutcome:
    """Everything the execution learned, without touching job rows."""

    inputs: tuple[meta_adapter.PageInput, ...]
    input_hash: str
    run_started: str
    live: bool
    coverage: dict[str, Any]
    result: meta_adapter.AdapterResult | None = None
    error: meta_adapter.AdapterError | None = None
    budget_blocked: bool = False


def claim_attempt(session: Session, job_id: str, worker_id: str) -> AttemptClaim | None:
    """CAS-claim a queued, failed, or lease-expired job for one attempt.

    Flushes the claim; the caller commits the short transaction. Returns
    None when the job is missing, terminal, or held by a live worker.
    """
    job = session.get(models.Job, job_id)
    if job is None:
        return None
    if job.status in ("succeeded", "needs_review", "cancelled"):
        return None
    now = _now()
    claimed = session.connection().execute(
        update(models.Job)
        .where(models.Job.id == job_id)
        .where(models.Job.generation == job.generation)
        .where(
            (models.Job.status.in_(["queued", "failed"]))
            | (
                (models.Job.status == "running")
                & ((models.Job.lease_until.is_(None)) | (models.Job.lease_until < now.isoformat()))
            )
        )
        .values(
            status="running",
            stage="extracting",
            worker_id=worker_id,
            lease_until=(now + dt.timedelta(minutes=LEASE_MINUTES)).isoformat(),
            updated_at=now.isoformat(),
            generation=models.Job.generation + 1,
        )
    )
    if claimed.rowcount != 1:
        return None
    session.refresh(job)
    req = _as_dict(job.request_json)
    attempt = _as_int(req.get("attempts")) + 1
    _update_request(job, attempts=attempt)
    session.flush()
    job_input = _as_dict(req.get("input"))
    return AttemptClaim(
        job_id=job.id,
        attempt=attempt,
        generation=job.generation,
        tender_id=job.tender_id,
        mode=str(job_input.get("mode", "curated_demo")),
        doc_ids=tuple(str(item) for item in (job_input.get("document_ids", []) or [])),
        worker_id=worker_id,
        expected_revision=(
            job_input["expected_interpretation_revision"]
            if type(job_input.get("expected_interpretation_revision")) is int
            else None
        ),
        document_hashes=tuple(sorted(_as_dict(job_input.get("document_hashes")).items())),
    )


def _page_images(
    storage_root: Path,
    tender_id: str,
    doc_id: str,
    *,
    expected_pdf_sha256: str | None,
    selected_pages: set[int] | None = None,
) -> dict[int, tuple[bytes, dict[str, Any]]]:
    """Load rendered PNGs plus manifest entries for one document.

    Best effort: a missing, failed or unreadable render means text-only
    pages, never a failed attempt. Images load from files, outside any
    database transaction.
    """
    try:
        manifest = render_service.load_render_manifest(storage_root, tender_id, doc_id)
    except (OSError, ValueError):
        return {}
    if (
        not manifest
        or manifest.get("status") != "ready"
        or not expected_pdf_sha256
        or manifest.get("pdf_sha256") != expected_pdf_sha256
        or manifest.get("render_version") != render_service.RENDER_VERSION
    ):
        return {}
    entries = manifest.get("pages")
    if not isinstance(entries, list):
        return {}
    out: dict[int, tuple[bytes, dict[str, Any]]] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        number = entry.get("physical_page")
        file_name = entry.get("file")
        if (
            not isinstance(number, int)
            or isinstance(number, bool)
            or number < 1
            or not isinstance(file_name, str)
            or not file_name
            or (selected_pages is not None and number not in selected_pages)
        ):
            continue
        try:
            png = render_service.load_rendered_png(storage_root, tender_id, doc_id, file_name)
        except OSError:
            continue
        if png is None or hashlib.sha256(png).hexdigest() != entry.get("image_sha256"):
            continue
        if len(png) < 24 or png[:8] != b"\x89PNG\r\n\x1a\n":
            continue
        if int.from_bytes(png[16:20], "big") != entry.get("width") or int.from_bytes(
            png[20:24], "big"
        ) != entry.get("height"):
            continue
        out[number] = (png, entry)
    return out


def _build_inputs_and_coverage(
    page_rows: Sequence[models.DocumentPage],
    doc_rows: Sequence[models.Document],
    images_by_doc: dict[str, dict[int, tuple[bytes, dict[str, Any]]]],
    *,
    submitted_keys: set[tuple[str, int]] | None = None,
) -> tuple[tuple[meta_adapter.PageInput, ...], dict[str, Any]]:
    """Assemble adapter inputs plus delivery coverage over the same rows."""
    sha_by_doc = {doc.id: doc.sha256 for doc in doc_rows}
    inputs: list[meta_adapter.PageInput] = []
    cover_pages: list[pdf_service.CoveragePage] = []
    for page in page_rows:
        image = images_by_doc.get(page.document_id, {}).get(page.page_number)
        png: bytes | None = None
        width: int | None = None
        height: int | None = None
        image_id: str | None = None
        image_sha: str | None = None
        if image is not None:
            raw, entry = image
            entry_width = entry.get("width")
            entry_height = entry.get("height")
            entry_id = entry.get("cache_key")
            dims_ok = (
                isinstance(entry_width, int)
                and not isinstance(entry_width, bool)
                and entry_width >= 1
                and isinstance(entry_height, int)
                and not isinstance(entry_height, bool)
                and entry_height >= 1
            )
            if dims_ok and isinstance(entry_id, str) and entry_id:
                png, width, height, image_id = raw, entry_width, entry_height, entry_id
                image_sha = hashlib.sha256(raw).hexdigest()
        inputs.append(
            meta_adapter.PageInput(
                document_id=page.document_id,
                page_number=page.page_number,
                normalized_text=page.normalized_text,
                document_sha256=sha_by_doc.get(page.document_id),
                image_bytes=png,
                image_id=image_id,
                image_sha256=image_sha,
                image_width=width,
                image_height=height,
            )
        )
        cover_pages.append(
            pdf_service.CoveragePage(
                document_id=page.document_id,
                physical_page=page.page_number,
                text=page.normalized_text,
                flags=tuple(
                    str(key)
                    for key, value in (
                        page.flags_json.items() if isinstance(page.flags_json, dict) else []
                    )
                    if value
                ),
                image_submitted=(
                    png is not None
                    and (
                        submitted_keys is None
                        or (page.document_id, page.page_number) in submitted_keys
                    )
                ),
                text_submitted=(
                    submitted_keys is None or (page.document_id, page.page_number) in submitted_keys
                ),
            )
        )
    coverage = pdf_service.coverage({doc.id: doc.pages_count for doc in doc_rows}, cover_pages)
    return tuple(inputs), coverage


def execute_attempt(
    engine: Engine,
    claim: AttemptClaim,
    adapter: meta_adapter.ExtractionAdapter | None = None,
) -> AttemptOutcome:
    """Run the extraction with no job transaction open.

    Pages are read through a short-lived session closed before any network
    call; spend reservation/settlement use the ledger's own short
    connections. Resolves the adapter here so a missing key surfaces as a
    failed attempt, never a stuck job.
    """
    with Session(engine) as session:
        revision = current_revision(session, claim.tender_id)
        page_rows = session.scalars(
            select(models.DocumentPage)
            .where(models.DocumentPage.document_id.in_(claim.doc_ids))
            .order_by(models.DocumentPage.document_id, models.DocumentPage.page_number)
        ).all()
        doc_rows = session.scalars(
            select(models.Document).where(models.Document.id.in_(claim.doc_ids))
        ).all()
    context_changed = (
        claim.expected_revision is not None and revision != claim.expected_revision
    ) or (
        bool(claim.document_hashes)
        and dict(claim.document_hashes) != {doc.id: doc.sha256 for doc in doc_rows}
    )
    if context_changed:
        inputs, coverage = _build_inputs_and_coverage(page_rows, doc_rows, {})
        return AttemptOutcome(
            inputs=inputs,
            input_hash=meta_adapter.pages_input_hash(inputs),
            run_started=_now().isoformat(),
            live=claim.mode == "live",
            coverage=coverage,
            error=meta_adapter.AdapterError(
                "revision_conflict",
                "analysis context changed before processing; start a new analysis",
            ),
        )
    if adapter is None:
        try:
            adapter = meta_adapter.select_adapter(claim.mode)
        except ApiError as exc:
            inputs, coverage = _build_inputs_and_coverage(page_rows, doc_rows, {})
            input_hash = meta_adapter.pages_input_hash(inputs)
            return AttemptOutcome(
                inputs=inputs,
                input_hash=input_hash,
                run_started=_now().isoformat(),
                live=claim.mode == "live",
                coverage=coverage,
                error=meta_adapter.AdapterError(exc.code, exc.message),
            )
    live = adapter.is_live
    images_by_doc: dict[str, dict[int, tuple[bytes, dict[str, Any]]]] = {}
    selected_keys: set[tuple[str, int]] | None = None
    if live:
        candidates, _ = _build_inputs_and_coverage(page_rows, doc_rows, {})
        selected = page_selection.select_first_packet(
            candidates, limit=meta_adapter.MAX_HYBRID_PAGES
        )
        selected_keys = {(page.document_id, page.page_number) for page in selected}
        storage_root = get_settings().storage_path.resolve()
        sha_by_doc = {doc.id: doc.sha256 for doc in doc_rows}
        for doc_id in claim.doc_ids:
            images_by_doc[doc_id] = _page_images(
                storage_root,
                claim.tender_id,
                doc_id,
                expected_pdf_sha256=sha_by_doc.get(doc_id),
                selected_pages={number for ident, number in selected_keys if ident == doc_id},
            )
    inputs, coverage = _build_inputs_and_coverage(
        page_rows, doc_rows, images_by_doc, submitted_keys=selected_keys
    )
    if selected_keys is not None:
        inputs = tuple(
            page for page in inputs if (page.document_id, page.page_number) in selected_keys
        )
    input_hash = meta_adapter.pages_input_hash(inputs)
    run_started = _now().isoformat()
    key = f"inv-{claim.job_id}-a{claim.attempt}"
    estimate = 0
    if live:
        estimate = budget_service.estimate_attempt_micro_usd(
            sum(len(page.normalized_text) for page in inputs)
        )
        try:
            budget_service.reserve(
                engine,
                key=key,
                job_id=claim.job_id,
                amount_micro=estimate,
                ceiling_micro=budget_service.budget_cap_micro_usd(),
            )
        except budget_service.BudgetBlockedError:
            return AttemptOutcome(
                inputs=inputs,
                input_hash=input_hash,
                run_started=run_started,
                live=True,
                coverage=coverage,
                budget_blocked=True,
            )
        # Commit intent before entering the adapter: a crash during HTTP
        # must leave a possible send visible, not an apparently unused hold.
        budget_service.mark_sent(engine, key)
    try:
        result = adapter.extract(inputs)
    except meta_adapter.AdapterError as exc:
        if live:
            receipt = exc.receipt
            _settle_attempt(
                engine,
                key,
                sent=receipt is not None and receipt.sent,
                cost_usd=receipt.estimated_cost_usd if receipt is not None else None,
            )
        return AttemptOutcome(
            inputs=inputs,
            input_hash=input_hash,
            run_started=run_started,
            live=live,
            coverage=coverage,
            error=exc,
        )
    except Exception:
        # A transport/plugin bug is not proof that nothing was sent. Keep
        # its hold and surface a terminal job rather than a permanent spinner.
        receipt = None
        if live:
            budget_service.mark_uncertain(engine, key)
            receipt = meta_adapter.Receipt(
                mode="live",
                model=get_settings().meta_model,
                provider_request_id=None,
                prompt_tokens=None,
                completion_tokens=None,
                cached_tokens=None,
                estimated_cost_usd=None,
                latency_ms=0,
                status="uncertain",
                sent=True,
            )
        return AttemptOutcome(
            inputs=inputs,
            input_hash=input_hash,
            run_started=run_started,
            live=live,
            coverage=coverage,
            error=meta_adapter.AdapterError(
                "provider_failure",
                "unexpected extraction failure; inspect the recorded attempt",
                receipt,
            ),
        )
    if live:
        _settle_attempt(engine, key, sent=True, cost_usd=result.estimated_cost_usd)
    return AttemptOutcome(
        inputs=inputs,
        input_hash=input_hash,
        run_started=run_started,
        live=live,
        coverage=coverage,
        result=result,
    )


def publish_outcome(
    session: Session, claim: AttemptClaim, outcome: AttemptOutcome
) -> models.Job | None:
    """Fence-checked publish. Commits, or rolls back and returns None if stale.

    The guarded touch UPDATE is the real fence: it only matches while this
    claim still owns the job, so a publish from a superseded worker (whose
    lease expired and was reclaimed) rolls back instead of overwriting the
    newer attempt.
    """
    # A slow or rejected proposal is still an invocation. Persist its
    # receipt before the generation/context fence can reject promotion.
    transport_receipt = _outcome_receipt(outcome)
    with Session(_engine_of(session)) as receipt_session:
        _record_invocation(
            receipt_session,
            job_id=claim.job_id,
            attempt=claim.attempt,
            input_hash=outcome.input_hash,
            mode="live" if outcome.live else "fixture",
            receipt=transport_receipt,
            status=transport_receipt.status if transport_receipt is not None else "failed",
            created_at=outcome.run_started,
        )
        receipt_session.commit()
    job = session.get(models.Job, claim.job_id)
    if (
        job is None
        or job.generation != claim.generation
        or job.status != "running"
        or job.worker_id != claim.worker_id
    ):
        session.rollback()
        return None
    fenced = session.connection().execute(
        update(models.Job)
        .where(models.Job.id == claim.job_id)
        .where(models.Job.generation == claim.generation)
        .where(models.Job.status == "running")
        .where(models.Job.worker_id == claim.worker_id)
        .values(updated_at=_now().isoformat())
    )
    if fenced.rowcount != 1:
        session.rollback()
        return None
    docs = session.scalars(
        select(models.Document).where(models.Document.id.in_(claim.doc_ids))
    ).all()
    if (
        claim.expected_revision is not None
        and current_revision(session, claim.tender_id) != claim.expected_revision
    ) or (
        bool(claim.document_hashes)
        and dict(claim.document_hashes) != {doc.id: doc.sha256 for doc in docs}
    ):
        _fail_job(
            session,
            job,
            code="revision_conflict",
            message="analysis belongs to an earlier context; current review was preserved",
            mode="live" if outcome.live else "fixture",
            attempt=claim.attempt,
            input_hash=outcome.input_hash,
            receipt=_outcome_receipt(outcome),
        )
    elif outcome.budget_blocked:
        _fail_job(
            session,
            job,
            code="budget_exhausted",
            message="live model budget exhausted",
            mode="live",
            attempt=claim.attempt,
            input_hash=outcome.input_hash,
        )
    elif outcome.error is not None:
        exc = outcome.error
        receipt = exc.receipt
        mode = receipt.mode if receipt is not None else ("live" if outcome.live else "fixture")
        _fail_job(
            session,
            job,
            code=exc.code,
            message=f"{exc.code}: {exc.message}",
            mode=mode,
            attempt=claim.attempt,
            input_hash=outcome.input_hash,
            receipt=receipt,
        )
    elif outcome.result is not None:
        _publish_success(session, job, claim, outcome, outcome.result)
    session.commit()
    session.refresh(job)
    return job


def _publish_success(
    session: Session,
    job: models.Job,
    claim: AttemptClaim,
    outcome: AttemptOutcome,
    result: meta_adapter.AdapterResult,
) -> None:
    try:
        proposal = g.ExtractionProposal.model_validate(result.proposal)
    except ValidationError as exc:
        receipt = meta_adapter.Receipt(
            mode=result.mode,
            model=result.model,
            provider_request_id=result.provider_request_id,
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            cached_tokens=result.cached_tokens,
            estimated_cost_usd=result.estimated_cost_usd,
            latency_ms=result.latency_ms,
            status="failed",
            sent=outcome.live,
        )
        _fail_job(
            session,
            job,
            code="invalid_model_output",
            message=f"invalid_model_output: proposal failed schema ({exc.error_count()})",
            mode=result.mode,
            attempt=claim.attempt,
            input_hash=outcome.input_hash,
            receipt=receipt,
        )
        return
    proposal_data = proposal.model_dump(mode="json")

    docs = session.scalars(
        select(models.Document).where(models.Document.id.in_(claim.doc_ids))
    ).all()
    doc_sha256 = {doc.id: doc.sha256 for doc in docs}
    by_doc: dict[str, int] = {}
    pages = outcome.inputs
    for page in pages:
        by_doc[page.document_id] = by_doc.get(page.document_id, 0) + 1
    job_warnings = list(result.warnings)
    if outcome.live and result.estimated_cost_usd is None:
        job_warnings.append("Meta usage unavailable; budget hold retained until reconciliation")
    for doc in docs:
        have = by_doc.get(doc.id, 0)
        if have < doc.pages_count:
            if outcome.live:
                job_warnings.append(
                    f"document {doc.id}: {have} of {doc.pages_count} "
                    "pages submitted to Meta (partial coverage)"
                )
            else:
                job_warnings.append(
                    f"document {doc.id}: {have} of {doc.pages_count} "
                    "page records available for local extraction"
                )

    text_by_page = {(page.document_id, page.page_number): page.normalized_text for page in pages}
    citation_ids, citation_warnings, unmatched = verify_and_store_citations(
        session,
        id_prefix=f"cit-{job.id}-a{claim.attempt}",
        proposal=proposal_data,
        text_by_page=text_by_page,
        doc_sha256=doc_sha256,
    )
    job_warnings.extend(citation_warnings)
    # Delivery problems (empty/truncated/missing pages) warn here and force
    # review; they also persist in the manifest coverage block below.
    job_warnings.extend(pdf_service.coverage_warning_lines(outcome.coverage))

    new_revision = current_revision(session, job.tender_id) + 1
    session.add(
        models.InterpretationRevision(
            tender_id=job.tender_id,
            revision=new_revision,
            mode=result.mode,
            proposal_json=proposal_data,
            reviewed_json={"status": "pending_review", "approved_claim_keys": []},
            document_hashes_json=dict(doc_sha256),
            actor="meta-live" if outcome.live else "meta-stub",
            reason=f"analysis job {job.id}",
            created_at=_now().isoformat(),
        )
    )
    # The invocation receipt is already committed independently above.
    claims = proposal_data.get("claims", []) or []
    weak_claim = any(
        isinstance(claim_item, dict) and claim_item.get("status") in NON_PROPOSED_CLAIM
        for claim_item in claims
    )
    needs_review = bool(job_warnings) or bool(proposal.unread_pages) or weak_claim or unmatched > 0
    manifest = meta_adapter.build_run_manifest(
        run_id=f"inv-{job.id}-a{claim.attempt}",
        mode=result.mode,
        pages=list(pages),
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
        started_at=outcome.run_started,
        finished_at=_now().isoformat(),
    )
    if result.packet_manifest is not None:
        manifest["packet"] = result.packet_manifest
    job.status = "needs_review" if needs_review else "succeeded"
    job.stage = "awaiting_review" if needs_review else "done"
    job.result_revision = new_revision
    job.error_code = None
    job.updated_at = _now().isoformat()
    coverage_pages = outcome.coverage.get("pages")
    delivered_pages = (
        sum(
            1
            for page in coverage_pages
            if isinstance(page, dict)
            and (page.get("text_submitted") or page.get("image_submitted"))
        )
        if isinstance(coverage_pages, list)
        else len(pages)
    )
    manifest["coverage"] = outcome.coverage
    if outcome.live:
        manifest["page_selection"] = {
            "method": "clause-signals-1",
            "limit": meta_adapter.MAX_HYBRID_PAGES,
            "selected": [[page.document_id, page.page_number] for page in pages],
            "complete_document_reading": False,
        }
    _update_request(
        job,
        processed=delivered_pages,
        warnings=job_warnings,
        manifest=manifest,
    )
    session.flush()


def run_claimed_attempt(
    engine: Engine,
    job_id: str,
    worker_id: str = "worker-inline",
    adapter: meta_adapter.ExtractionAdapter | None = None,
) -> models.Job | None:
    """Claim, execute and publish one attempt with short sessions each.

    Returns None when another worker holds the job or the claim went stale
    before publishing.
    """
    with Session(engine) as session:
        claim = claim_attempt(session, job_id, worker_id)
        if claim is None:
            return None
        session.commit()
    outcome = execute_attempt(engine, claim, adapter)
    with Session(engine) as session:
        return publish_outcome(session, claim, outcome)


def cancel_queued_job(session: Session, job_id: str) -> bool:
    """CAS-cancel a job that never started (idempotency race loser). Flushes."""
    cancelled = session.connection().execute(
        update(models.Job)
        .where(models.Job.id == job_id)
        .where(models.Job.status == "queued")
        .values(status="cancelled", stage="cancelled", updated_at=_now().isoformat())
    )
    session.flush()
    return bool(cancelled.rowcount == 1)


def recover_interrupted(engine: Engine) -> None:
    """Recover process-owned running jobs without another provider call."""
    with Session(engine) as session:
        ids = list(session.scalars(select(models.Job.id).where(models.Job.status == "running")))
    budget_service.retain_interrupted_holds(engine, ids)
    with Session(engine) as session:
        for job_id in ids:
            job = session.get(models.Job, job_id)
            if job is None or job.status != "running":
                continue
            req = _as_dict(job.request_json)
            job_input = _as_dict(req.get("input"))
            job.generation += 1
            job.worker_id = None
            job.lease_until = None
            _fail_job(
                session,
                job,
                code="interrupted",
                message=(
                    "processing was interrupted; review the attempt before starting a new analysis"
                ),
                mode="live" if job_input.get("mode") == "live" else "fixture",
                attempt=max(1, _as_int(req.get("attempts"))),
                input_hash="",
            )
        session.commit()
