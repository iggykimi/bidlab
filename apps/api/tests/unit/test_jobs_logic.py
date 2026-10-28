"""T15/T17 service logic: citation verification, budget guard, restarts."""

import datetime as dt
from collections.abc import Iterator

import pytest
from bidlab.api.errors import ApiError
from bidlab.db import models
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


def test_publish_stale_generation_aborts_without_side_effects(session: Session) -> None:
    """PKG-T03 fence: a superseded claim publishes nothing."""
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
        assert reader.get(models.ModelInvocation, "inv-job-test-1-a2") is None
        job = reader.get(models.Job, "job-test-1")
        assert job is not None
        assert job.status == "running"
        assert job.worker_id == "w2"


def test_execute_live_without_key_fails_attempt(session: Session) -> None:
    """A key removed after admission fails the attempt, never sticks it."""
    row = _job_row("queued")
    row.request_json["input"]["mode"] = "live"
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

        def extract(self, pages: object) -> object:
            return meta_adapter.StubExtractor().extract(pages)  # type: ignore[arg-type]

    row = _job_row("queued")
    row.request_json["input"]["mode"] = "live"
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
