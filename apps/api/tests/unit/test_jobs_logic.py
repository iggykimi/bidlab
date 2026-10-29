"""T15/T17 service logic: citation verification, budget guard, restarts."""

import datetime as dt
import hashlib
from collections.abc import Iterator, Sequence
from typing import Any, cast

import pytest
from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.schemas import generated as g
from bidlab.services import jobs as jobs_service
from bidlab.services import meta_adapter
from bidlab.settings import get_settings
from sqlalchemy import create_engine, update
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session


@pytest.fixture()
def session() -> Iterator[Session]:
    engine = create_engine("sqlite:///:memory:")
    models.Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def _proposal(citations: list[dict[str, object]]) -> dict[str, object]:
    return {
        "schema_version": "1.0",
        "claims": [
            {
                "key": "k1",
                "raw_value": None,
                "normalized_value": None,
                "unit": None,
                "citations": citations,
                "confidence": "low",
                "status": "proposed",
                "notes": [],
            }
        ],
        "requirements": [],
        "pricing_formula": {
            "formula_literal": None,
            "template_hint": "unsupported",
            "max_points": None,
            "variables": [],
            "citations": [],
            "ambiguities": [],
        },
        "anomaly_text": None,
        "anomaly_citations": [],
        "unread_pages": [],
        "warnings": [],
    }


def test_verify_exact_citation_persisted_with_offsets(session: Session) -> None:
    proposal = _proposal([{"document_id": "d1", "page_number": 6, "verbatim_excerpt": "118336.00"}])
    ids, warnings, unmatched = jobs_service.verify_and_store_citations(
        session,
        id_prefix="cit-x",
        proposal=proposal,
        text_by_page={("d1", 6): "precio neto 118336.00 euros"},
        doc_sha256={"d1": "ab" * 32},
    )
    assert warnings == []
    assert unmatched == 0
    row = session.get(models.Citation, ids[0])
    assert row is not None
    assert row.match_status == "exact"
    assert (row.normalized_start, row.normalized_end) == (12, 21)
    assert row.normalization_version == "nfkc-noshyphen-collapse-1"


def test_verify_missing_quote_recorded_not_upgraded(session: Session) -> None:
    proposal = _proposal([{"document_id": "d1", "page_number": 6, "verbatim_excerpt": "no existe"}])
    ids, warnings, unmatched = jobs_service.verify_and_store_citations(
        session,
        id_prefix="cit-x",
        proposal=proposal,
        text_by_page={("d1", 6): "precio neto 118336.00 euros"},
        doc_sha256={"d1": "ab" * 32},
    )
    assert unmatched == 1
    assert any("not found" in w for w in warnings)
    row = session.get(models.Citation, ids[0])
    assert row is not None
    assert row.match_status == "missing"
    assert row.normalized_start is None


def test_verify_skips_pages_without_text(session: Session) -> None:
    proposal = _proposal([{"document_id": "d1", "page_number": 9, "verbatim_excerpt": "hola"}])
    ids, warnings, unmatched = jobs_service.verify_and_store_citations(
        session,
        id_prefix="cit-x",
        proposal=proposal,
        text_by_page={},
        doc_sha256={"d1": "ab" * 32},
    )
    assert ids == []
    assert unmatched == 1
    assert any("no extracted text" in w for w in warnings)


def test_live_spend_sums_and_ignores_garbage(session: Session) -> None:
    now = dt.datetime.now(dt.UTC).isoformat()
    for ident, cost in (("a", "1.25"), ("b", "2.50"), ("c", "nan-junk"), ("d", None)):
        session.add(
            models.ModelInvocation(
                id=ident,
                job_id=None,
                mode="live",
                model="m",
                prompt_version="p",
                input_hash="h",
                provider_request_id=None,
                prompt_tokens=1,
                completion_tokens=1,
                cached_tokens=None,
                estimated_cost_usd=cost,
                latency_ms=1,
                status="ok",
                created_at=now,
            )
        )
    session.add(
        models.ModelInvocation(
            id="e",
            job_id=None,
            mode="fixture",
            model=None,
            prompt_version="p",
            input_hash="h",
            provider_request_id=None,
            prompt_tokens=None,
            completion_tokens=None,
            cached_tokens=None,
            estimated_cost_usd="100.00",
            latency_ms=0,
            status="ok",
            created_at=now,
        )
    )
    assert str(jobs_service.live_spend_usd(session)) == "3.75"


def test_budget_guard_blocks_at_ceiling(session: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BIDLAB_META_BUDGET_USD", "0.00")
    get_settings.cache_clear()
    try:
        with pytest.raises(ApiError) as exc:
            jobs_service.check_live_budget(session)
    finally:
        get_settings.cache_clear()
    assert exc.value.status_code == 429
    assert exc.value.code == "budget_exhausted"


def _job_row(status: str, lease_until: str | None = None) -> models.Job:
    now = dt.datetime.now(dt.UTC).isoformat()
    return models.Job(
        id="job-test-1",
        tender_id="t1",
        status=status,
        request_json={
            "input": {"document_ids": [], "mode": "curated_demo"},
            "progress": {"processed_pages": 0, "total_pages": 0},
            "warnings": [],
            "attempts": 1,
        },
        stage="done" if status in ("succeeded", "needs_review") else status,
        worker_id=None,
        lease_until=lease_until,
        result_revision=2 if status in ("succeeded", "needs_review") else None,
        error_code="x" if status == "failed" else None,
        created_at=now,
        updated_at=now,
    )


def _engine_of(session: Session) -> Engine:
    bind = session.get_bind()
    assert isinstance(bind, Engine)
    return bind


def test_claim_terminal_returns_none(session: Session) -> None:
    session.add(_job_row("needs_review"))
    session.commit()
    assert jobs_service.claim_attempt(session, "job-test-1", "w1") is None
    session.rollback()


def test_claim_running_with_live_lease_returns_none(session: Session) -> None:
    lease = (dt.datetime.now(dt.UTC) + dt.timedelta(minutes=5)).isoformat()
    session.add(_job_row("running", lease_until=lease))
    session.commit()
    assert jobs_service.claim_attempt(session, "job-test-1", "w1") is None
    session.rollback()


def test_claim_race_second_loses(session: Session) -> None:
    session.add(_job_row("queued"))
    session.commit()
    first = jobs_service.claim_attempt(session, "job-test-1", "w1")
    assert first is not None
    session.commit()
    assert jobs_service.claim_attempt(session, "job-test-1", "w2") is None
    session.rollback()


def test_claim_failed_retries_as_new_attempt(session: Session) -> None:
    session.add(_job_row("failed"))
    session.commit()
    claim = jobs_service.claim_attempt(session, "job-test-1", "w1")
    assert claim is not None
    assert claim.attempt == 2
    assert claim.generation == 2
    assert claim.mode == "curated_demo"
    session.commit()
    job = session.get(models.Job, "job-test-1")
    assert job is not None
    assert job.status == "running"
    assert job.worker_id == "w1"


def test_claim_expired_lease_reclaimed(session: Session) -> None:
    lease = (dt.datetime.now(dt.UTC) - dt.timedelta(minutes=5)).isoformat()
    session.add(_job_row("running", lease_until=lease))
    session.commit()
    claim = jobs_service.claim_attempt(session, "job-test-1", "w2")
    assert claim is not None
    assert claim.generation == 2
    session.rollback()


def test_run_claimed_attempt_success_persists_manifest(session: Session) -> None:
    session.add(_job_row("failed"))
    session.commit()
    engine = _engine_of(session)
    job = jobs_service.run_claimed_attempt(
        engine, "job-test-1", "w1", adapter=meta_adapter.StubExtractor()
    )
    assert job is not None
    assert job.status == "needs_review"
    assert job.result_revision == 1
    assert job.error_code is None
    request = job.request_json
    assert isinstance(request, dict)
    manifest = request.get("manifest")
    assert isinstance(manifest, dict)
    assert manifest["run_id"] == "inv-job-test-1-a2"
    assert manifest["mode"] == "fixture"
    assert manifest["schema_version"] == "1.0"
    assert manifest["prompt_version"] == meta_adapter.PROMPT_VERSION
    assert manifest["pages"] == []
    assert manifest["citation_ids"] == []
    assert manifest["human_review"] == "pending"
    with Session(engine) as reader:
        invocation = reader.get(models.ModelInvocation, "inv-job-test-1-a2")
        assert invocation is not None
        assert invocation.mode == "fixture"


def test_run_claimed_attempt_refusal_fails_explicitly(session: Session) -> None:
    session.add(_job_row("failed"))
    session.commit()
    job = jobs_service.run_claimed_attempt(
        _engine_of(session),
        "job-test-1",
        "w1",
        adapter=meta_adapter.StubExtractor(meta_adapter.StubScenario.REFUSAL),
    )
    assert job is not None
    assert job.status == "failed"
    assert job.error_code == "provider_refusal"
    assert job.result_revision is None


def test_publish_stale_generation_keeps_receipt_without_promoting(session: Session) -> None:
    """A superseded claim cannot publish a proposal or erase its invocation."""
    session.add(_job_row("queued"))
    session.commit()
    engine = _engine_of(session)
    with Session(engine) as claim_session:
        claim = jobs_service.claim_attempt(claim_session, "job-test-1", "w1")
        assert claim is not None
        claim_session.commit()
    outcome = jobs_service.execute_attempt(engine, claim, adapter=meta_adapter.StubExtractor())
    assert outcome.result is not None
    # Another worker reclaims the job before we publish.
    with Session(engine) as thief:
        thief.execute(
            update(models.Job)
            .where(models.Job.id == "job-test-1")
            .values(generation=claim.generation + 1, worker_id="w2")
        )
        thief.commit()
    with Session(engine) as publish_session:
        assert jobs_service.publish_outcome(publish_session, claim, outcome) is None
    with Session(engine) as reader:
        assert reader.get(models.InterpretationRevision, ("t1", 1)) is None
        invocation = reader.get(models.ModelInvocation, "inv-job-test-1-a2")
        assert invocation is not None
        assert invocation.mode == "fixture"
        assert invocation.prompt_tokens is None
        job = reader.get(models.Job, "job-test-1")
        assert job is not None
        assert job.status == "running"
        assert job.worker_id == "w2"


def test_execute_live_without_key_fails_attempt(session: Session) -> None:
    """A key removed after admission fails the attempt, never sticks it."""
    row = _job_row("queued")
    request_input = cast("dict[str, Any]", row.request_json["input"])
    request_input["mode"] = "live"
    session.add(row)
    session.commit()
    engine = _engine_of(session)
    job = jobs_service.run_claimed_attempt(engine, "job-test-1", "w1")
    assert job is not None
    assert job.status == "failed"
    assert job.error_code == "provider_not_configured"


def test_execute_budget_blocked_publishes_failed(
    session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Worker-side reserve is the authoritative admission (fast 429 already ran)."""

    class _LiveStub:
        is_live = True

        def extract(self, pages: Sequence[meta_adapter.PageInput]) -> meta_adapter.AdapterResult:
            return meta_adapter.StubExtractor().extract(pages)

    row = _job_row("queued")
    request_input = cast("dict[str, Any]", row.request_json["input"])
    request_input["mode"] = "live"
    session.add(row)
    session.commit()
    monkeypatch.setenv("BIDLAB_META_BUDGET_USD", "0.00")
    get_settings.cache_clear()
    try:
        job = jobs_service.run_claimed_attempt(
            _engine_of(session), "job-test-1", "w1", adapter=_LiveStub()
        )
    finally:
        get_settings.cache_clear()
    assert job is not None
    assert job.status == "failed"
    assert job.error_code == "budget_exhausted"


def test_cancel_queued_job(session: Session) -> None:
    session.add(_job_row("queued"))
    session.commit()
    assert jobs_service.cancel_queued_job(session, "job-test-1") is True
    session.commit()
    job = session.get(models.Job, "job-test-1")
    assert job is not None
    assert job.status == "cancelled"
    assert jobs_service.cancel_queued_job(session, "job-test-1") is False
    session.rollback()


def _invocation_row(
    attempt: int,
    created_at: str,
    mode: str = "live",
    model: str | None = "muse-spark-1.3",
) -> models.ModelInvocation:
    return models.ModelInvocation(
        id=f"inv-job-test-1-a{attempt}",
        job_id="job-test-1",
        mode=mode,
        model=model,
        prompt_version="bidlab-extract-3",
        input_hash="h" * 64,
        provider_request_id="chatcmpl-x",
        prompt_tokens=100,
        completion_tokens=50,
        cached_tokens=None,
        estimated_cost_usd="0.000338",
        latency_ms=12,
        status="ok",
        created_at=created_at,
    )


def test_job_to_dict_without_invocation_has_nulls(session: Session) -> None:
    """PKG-T09: a job with no attempt yet reports null invocation facts."""
    session.add(_job_row("queued"))
    session.commit()
    job = session.get(models.Job, "job-test-1")
    assert job is not None
    payload = jobs_service.job_to_dict(session, job)
    assert payload["invocation_id"] is None
    assert payload["mode"] is None
    assert payload["model"] is None
    assert payload["prompt_tokens"] is None
    assert payload["completion_tokens"] is None
    assert payload["estimated_cost_usd"] is None
    assert payload["provider_request_id"] is None
    assert payload["latency_ms"] is None
    g.Job.model_validate(payload)
    session.rollback()


def test_job_to_dict_exposes_latest_invocation(session: Session) -> None:
    """PKG-T09: the newest attempt is the verifiable run."""
    session.add(_job_row("needs_review"))
    session.add(_invocation_row(1, "2026-10-28T10:00:00+00:00"))
    session.add(_invocation_row(2, "2026-10-28T10:01:00+00:00"))
    session.commit()
    job = session.get(models.Job, "job-test-1")
    assert job is not None
    payload = jobs_service.job_to_dict(session, job)
    assert payload["invocation_id"] == "inv-job-test-1-a2"
    assert payload["mode"] == "live"
    assert payload["model"] == "muse-spark-1.3"
    assert payload["prompt_tokens"] == 100
    assert payload["completion_tokens"] == 50
    assert payload["estimated_cost_usd"] == "0.000338"
    assert payload["provider_request_id"] == "chatcmpl-x"
    assert payload["latency_ms"] == 12
    parsed = g.Job.model_validate(payload)
    assert parsed.invocation_id is not None
    assert parsed.invocation_id.root == "inv-job-test-1-a2"
    session.rollback()


def _doc_row(pages_count: int = 8, doc_id: str = "d1") -> models.Document:
    return models.Document(
        id=doc_id,
        tender_id="t1",
        kind="pcap",
        sha256=hashlib.sha256(doc_id.encode()).hexdigest(),
        blob_path="",
        display_name="doc",
        pages_count=pages_count,
        source_url=None,
        rights_status="user_supplied",
        parse_status="parsed",
    )


def _publish_fixtures(
    session: Session, *, live: bool, pages: int, empty_text: bool = False, tag: str = ""
) -> tuple[
    models.Job, jobs_service.AttemptClaim, jobs_service.AttemptOutcome, meta_adapter.AdapterResult
]:
    job_id = f"job-test-1{tag}"
    doc_id = f"d1{tag}"
    row = _job_row("queued")
    row.id = job_id
    session.add(row)
    session.add(_doc_row(doc_id=doc_id))
    session.commit()
    job = session.get(models.Job, job_id)
    assert job is not None
    claim = jobs_service.AttemptClaim(
        job_id=job_id,
        attempt=1,
        generation=1,
        tender_id="t1",
        mode="live" if live else "curated_demo",
        doc_ids=(doc_id,),
        worker_id="w1",
    )
    inputs = tuple(
        meta_adapter.PageInput(
            document_id=doc_id,
            page_number=n,
            normalized_text="" if empty_text else f"texto extraido pagina {n}",
        )
        for n in range(1, pages + 1)
    )
    outcome = jobs_service.AttemptOutcome(
        inputs=inputs,
        input_hash="ab" * 32,
        run_started=dt.datetime.now(dt.UTC).isoformat(),
        live=live,
        coverage={},
    )
    result = meta_adapter.AdapterResult(
        proposal=_proposal([]),
        warnings=(),
        mode="live" if live else "fixture",
        model="muse-spark" if live else None,
        prompt_tokens=None,
        completion_tokens=None,
        cached_tokens=None,
        provider_request_id=None,
        estimated_cost_usd=None,
        latency_ms=0,
        status="ok",
    )
    return job, claim, outcome, result


def _publish_warnings(session: Session, job_id: str = "job-test-1") -> tuple[list[str], models.Job]:
    job = session.get(models.Job, job_id)
    assert job is not None
    request = job.request_json
    assert isinstance(request, dict)
    warnings = request.get("warnings", [])
    assert isinstance(warnings, list)
    return [str(w) for w in warnings], job


def test_publish_partial_live_warns_submitted_to_meta(session: Session) -> None:
    job, claim, outcome, result = _publish_fixtures(session, live=True, pages=6)
    jobs_service._publish_success(session, job, claim, outcome, result)
    warnings, published = _publish_warnings(session)
    assert published.status == "needs_review"
    assert "document d1: 6 of 8 pages submitted to Meta (partial coverage)" in warnings


def test_publish_partial_fixture_warns_local_records(session: Session) -> None:
    job, claim, outcome, result = _publish_fixtures(session, live=False, pages=6)
    jobs_service._publish_success(session, job, claim, outcome, result)
    warnings, published = _publish_warnings(session)
    assert published.status == "needs_review"
    assert "document d1: 6 of 8 page records available for local extraction" in warnings
    assert not any("Meta" in w for w in warnings)


def test_publish_live_image_only_never_claims_text(session: Session) -> None:
    job, claim, outcome, result = _publish_fixtures(session, live=True, pages=6, empty_text=True)
    jobs_service._publish_success(session, job, claim, outcome, result)
    warnings, _ = _publish_warnings(session)
    assert "document d1: 6 of 8 pages submitted to Meta (partial coverage)" in warnings
    assert not any("has text" in w or "with text" in w for w in warnings)


def test_publish_live_keeps_partial_reading_manifest(session: Session) -> None:
    job, claim, outcome, result = _publish_fixtures(session, live=True, pages=6)
    jobs_service._publish_success(session, job, claim, outcome, result)
    published = session.get(models.Job, "job-test-1")
    assert published is not None
    request = published.request_json
    assert isinstance(request, dict)
    manifest = request.get("manifest")
    assert isinstance(manifest, dict)
    selection = manifest.get("page_selection")
    assert isinstance(selection, dict)
    assert selection["complete_document_reading"] is False
    assert len(selection["selected"]) == 6


def test_publish_warnings_carry_no_hashes_or_secrets(session: Session) -> None:
    import re

    for tag, live in (("-a", True), ("-b", False)):
        job, claim, outcome, result = _publish_fixtures(session, live=live, pages=6, tag=tag)
        jobs_service._publish_success(session, job, claim, outcome, result)
        warnings, _ = _publish_warnings(session, f"job-test-1{tag}")
        assert warnings != []
        for warning in warnings:
            assert re.search(r"[0-9a-f]{32,}", warning) is None
            assert "sk-" not in warning and "key" not in warning.lower()


def test_publish_live_without_usage_warns_budget_hold(session: Session) -> None:
    job, claim, outcome, result = _publish_fixtures(session, live=True, pages=8)
    jobs_service._publish_success(session, job, claim, outcome, result)
    warnings, _ = _publish_warnings(session)
    assert "Meta usage unavailable; budget hold retained until reconciliation" in warnings


def test_job_to_dict_guards_foreign_mode_and_clips(session: Session) -> None:
    """PKG-T09: unexpected stored values never break the contract."""
    session.add(_job_row("failed"))
    session.add(_invocation_row(1, "2026-10-28T10:00:00+00:00", mode="curated_demo"))
    session.commit()
    job = session.get(models.Job, "job-test-1")
    assert job is not None
    payload = jobs_service.job_to_dict(session, job)
    assert payload["mode"] is None
    session.rollback()
    session.add(_invocation_row(2, "2026-10-28T10:02:00+00:00", model="m" * 100))
    session.commit()
    payload = jobs_service.job_to_dict(session, job)
    assert payload["model"] == "m" * 80
    assert payload["mode"] == "live"
    g.Job.model_validate(payload)
    session.rollback()
