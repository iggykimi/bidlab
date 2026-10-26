"""T15/T17 service logic: citation verification, budget guard, restarts."""

import datetime as dt
from collections.abc import Iterator

import pytest
from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.services import jobs as jobs_service
from bidlab.services import meta_adapter
from bidlab.settings import get_settings
from sqlalchemy import create_engine
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
    proposal = _proposal(
        [{"document_id": "d1", "page_number": 6, "verbatim_excerpt": "118336.00"}]
    )
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
    proposal = _proposal(
        [{"document_id": "d1", "page_number": 6, "verbatim_excerpt": "no existe"}]
    )
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
    proposal = _proposal(
        [{"document_id": "d1", "page_number": 9, "verbatim_excerpt": "hola"}]
    )
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


def test_budget_guard_blocks_at_ceiling(
    session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
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


def test_run_job_terminal_is_idempotent(session: Session) -> None:
    session.add(_job_row("needs_review"))
    session.commit()
    job = jobs_service.run_job(session, "job-test-1")
    assert job.status == "needs_review"
    assert job.result_revision == 2


def test_run_job_running_with_live_lease_conflicts(session: Session) -> None:
    lease = (dt.datetime.now(dt.UTC) + dt.timedelta(minutes=5)).isoformat()
    session.add(_job_row("running", lease_until=lease))
    session.commit()
    with pytest.raises(ApiError) as exc:
        jobs_service.run_job(session, "job-test-1")
    assert exc.value.status_code == 409


def test_run_job_failed_retries_as_new_attempt(session: Session) -> None:
    session.add(_job_row("failed"))
    session.commit()
    job = jobs_service.run_job(
        session, "job-test-1", adapter=meta_adapter.StubExtractor()
    )
    assert job.status == "needs_review"
    assert job.result_revision == 1
    assert job.error_code is None
    invocation = session.get(models.ModelInvocation, "inv-job-test-1-a2")
    assert invocation is not None
    assert invocation.mode == "fixture"


def test_run_job_refusal_fails_explicitly(session: Session) -> None:
    session.add(_job_row("failed"))
    session.commit()
    job = jobs_service.run_job(
        session,
        "job-test-1",
        adapter=meta_adapter.StubExtractor(meta_adapter.StubScenario.REFUSAL),
    )
    assert job.status == "failed"
    assert job.error_code == "provider_refusal"
    assert job.result_revision is None
