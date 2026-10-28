"""I06 + T17: analysis run endpoint (202), job polling, stub honesty."""

import datetime as dt
import json
import socket
import threading
import time
from typing import Any

import httpx
import pytest
from bidlab.db import models
from bidlab.db.session import get_engine
from bidlab.schemas import generated as g
from bidlab.services import budget as budget_service
from bidlab.services import meta_adapter
from bidlab.services import worker as worker_service
from bidlab.settings import get_settings
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

CLIENT_HEADERS = {"X-BidLab-Client": "local-ui"}


@pytest.fixture()
def demo_client(seeded_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    # Offline by default: live selection needs an explicit key + endpoint.
    # (Seeded first: seed/demo data never read these variables.)
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    monkeypatch.delenv(meta_adapter.META_API_URL_ENV, raising=False)
    get_settings.cache_clear()
    return seeded_client


def _body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "document_ids": ["doc-tias-pcap"],
        "mode": "curated_demo",
        "allow_remote_processing": False,
        "expected_interpretation_revision": 1,
    }
    body.update(overrides)
    return body


def _headers(key: str) -> dict[str, str]:
    return {**CLIENT_HEADERS, "Idempotency-Key": key}


def _db() -> Session:
    return Session(get_engine())


_TERMINAL_STATUSES = ("succeeded", "needs_review", "failed", "cancelled")


def _poll_terminal(client: TestClient, job_id: str, timeout_s: float = 20.0) -> dict[str, Any]:
    """GET-poll a job until the worker reaches a terminal state."""
    deadline = time.monotonic() + timeout_s
    body: dict[str, Any] = {}
    while True:
        res = client.get(f"/api/v1/jobs/{job_id}")
        assert res.status_code == 200
        body = res.json()
        if body["status"] in _TERMINAL_STATUSES:
            return body
        assert time.monotonic() < deadline, f"job {job_id} stuck in {body['status']}"
        time.sleep(0.05)


def test_start_and_poll_needs_review(demo_client: TestClient) -> None:
    res = demo_client.post("/api/v1/tenders/tias/analysis", json=_body(), headers=_headers("k1"))
    assert res.status_code == 202
    assert res.headers["Location"].startswith("/api/v1/jobs/job-")
    job = g.Job.model_validate(res.json())
    assert job.status == "queued"
    job = g.Job.model_validate(_poll_terminal(demo_client, job.id.root))
    assert job.status == "needs_review"
    assert job.result_revision is not None
    assert job.result_revision.root == 2
    assert job.total_pages == 41
    assert 0 < job.processed_pages <= job.total_pages
    assert any("fixture_stub" in w.root for w in job.warnings)

    poll = demo_client.get(f"/api/v1/jobs/{job.id.root}")
    assert poll.status_code == 200
    assert g.Job.model_validate(poll.json()).status == "needs_review"

    with _db() as session:
        invocation = session.scalars(
            select(models.ModelInvocation).where(models.ModelInvocation.job_id == job.id.root)
        ).one()
        assert invocation.mode == "fixture"
        assert invocation.model is None
        assert invocation.prompt_tokens is None
        assert invocation.completion_tokens is None
        revision = session.get(models.InterpretationRevision, ("tias", 2))
        assert revision is not None
        assert revision.mode == "fixture"


def test_idempotent_replay_and_body_conflict(demo_client: TestClient) -> None:
    first = demo_client.post("/api/v1/tenders/tias/analysis", json=_body(), headers=_headers("k2"))
    replay = demo_client.post("/api/v1/tenders/tias/analysis", json=_body(), headers=_headers("k2"))
    assert replay.status_code == 202
    assert replay.json()["id"] == first.json()["id"]
    conflict = demo_client.post(
        "/api/v1/tenders/tias/analysis",
        json=_body(expected_interpretation_revision=2),
        headers=_headers("k2"),
    )
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "idempotency_conflict"


def test_missing_client_header_forbidden(demo_client: TestClient) -> None:
    res = demo_client.post(
        "/api/v1/tenders/tias/analysis",
        json=_body(),
        headers={"Idempotency-Key": "k3"},
    )
    assert res.status_code == 403


def test_unknown_tender_document_and_job(demo_client: TestClient) -> None:
    res = demo_client.post("/api/v1/tenders/nope/analysis", json=_body(), headers=_headers("k4"))
    assert res.status_code == 404
    assert res.json()["code"] == "tender_not_found"
    res = demo_client.post(
        "/api/v1/tenders/tias/analysis",
        json=_body(document_ids=["doc-missing"]),
        headers=_headers("k5"),
    )
    assert res.status_code == 404
    assert res.json()["code"] == "document_not_found"
    assert demo_client.get("/api/v1/jobs/job-missing").status_code == 404


def test_revision_conflict(demo_client: TestClient) -> None:
    res = demo_client.post(
        "/api/v1/tenders/tias/analysis",
        json=_body(expected_interpretation_revision=0),
        headers=_headers("k6"),
    )
    assert res.status_code == 409
    assert res.json()["code"] == "revision_conflict"


def test_document_from_other_tender_rejected(demo_client: TestClient) -> None:
    with _db() as session:
        session.add(
            models.Tender(
                id="other",
                feed_id="f",
                atom_id="a",
                external_id="e",
                title="t",
                source_url="u",
                source_updated_at="2026-01-01",
                metadata_json={},
            )
        )
        session.flush()
        session.add(
            models.Document(
                id="doc-other",
                tender_id="other",
                kind="pcap",
                sha256="00" * 32,
                blob_path="",
                display_name="d",
                pages_count=1,
                source_url=None,
                rights_status="research_only",
                parse_status="ready",
            )
        )
        session.commit()
    res = demo_client.post(
        "/api/v1/tenders/tias/analysis",
        json=_body(document_ids=["doc-other"]),
        headers=_headers("k7"),
    )
    assert res.status_code == 400
    assert res.json()["code"] == "document_wrong_tender"


def test_live_mode_needs_consent_and_key(demo_client: TestClient) -> None:
    res = demo_client.post(
        "/api/v1/tenders/tias/analysis",
        json=_body(mode="live", allow_remote_processing=False),
        headers=_headers("k8"),
    )
    assert res.status_code == 400
    assert res.json()["code"] == "remote_processing_not_allowed"
    res = demo_client.post(
        "/api/v1/tenders/tias/analysis",
        json=_body(mode="live", allow_remote_processing=True),
        headers=_headers("k9"),
    )
    assert res.status_code == 503
    assert res.json()["code"] == "provider_not_configured"


def test_stub_failure_fails_job_explicitly(
    demo_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "bidlab.services.jobs.meta_adapter.select_adapter",
        lambda mode: meta_adapter.StubExtractor(meta_adapter.StubScenario.REFUSAL),
    )
    res = demo_client.post("/api/v1/tenders/tias/analysis", json=_body(), headers=_headers("k10"))
    assert res.status_code == 202
    job = g.Job.model_validate(res.json())
    assert job.status == "queued"
    job = g.Job.model_validate(_poll_terminal(demo_client, job.id.root))
    assert job.status == "failed"
    assert job.error_code is not None
    assert job.error_code.root == "provider_refusal"
    assert job.result_revision is None


def test_offline_stub_makes_no_network_calls(
    demo_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _blocked(*args: object, **kwargs: object) -> object:
        raise AssertionError("offline run must not open connections")

    monkeypatch.setattr(socket, "create_connection", _blocked)
    monkeypatch.setattr(httpx, "post", _blocked)
    res = demo_client.post("/api/v1/tenders/tias/analysis", json=_body(), headers=_headers("k11"))
    assert res.status_code == 202
    terminal = _poll_terminal(demo_client, res.json()["id"])
    assert terminal["status"] in ("succeeded", "needs_review")


def test_budget_exhaust_persists_failed_job(
    demo_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """C6: the 429 keeps an auditable failed job + invocation (committed pre-raise)."""

    def _blocked(*args: object, **kwargs: object) -> object:
        raise AssertionError("exhausted budget must fail before any model call")

    monkeypatch.setattr(socket, "create_connection", _blocked)
    monkeypatch.setattr(httpx, "post", _blocked)
    monkeypatch.setenv("MODEL_API_KEY", "test-key")
    monkeypatch.setenv(meta_adapter.META_API_URL_ENV, "https://meta.test/v1")
    monkeypatch.setenv("BIDLAB_META_BUDGET_USD", "0.00")
    get_settings.cache_clear()
    try:
        res = demo_client.post(
            "/api/v1/tenders/tias/analysis",
            json=_body(mode="live", allow_remote_processing=True),
            headers=_headers("k-budget"),
        )
    finally:
        get_settings.cache_clear()
    assert res.status_code == 429
    assert res.json()["code"] == "budget_exhausted"
    with _db() as session:
        jobs = session.scalars(select(models.Job).where(models.Job.tender_id == "tias")).all()
        assert len(jobs) == 1
        assert jobs[0].status == "failed"
        assert jobs[0].error_code == "budget_exhausted"
        invocations = session.scalars(
            select(models.ModelInvocation).where(models.ModelInvocation.job_id == jobs[0].id)
        ).all()
        assert len(invocations) == 1
        assert invocations[0].status == "failed"
        assert invocations[0].mode == "live"
        job_id = jobs[0].id
    poll = demo_client.get(f"/api/v1/jobs/{job_id}")
    assert poll.status_code == 200
    assert poll.json()["status"] == "failed"


def test_live_invalid_output_keeps_receipt(
    demo_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PKG-T01/B01 fixed: the failed invocation keeps the live receipt."""
    body = {
        "id": "mock-response-no-network",
        "model": "muse-spark-1.3",
        "choices": [{"finish_reason": "stop", "message": {"content": "{invalid-json"}}],
        "usage": {"prompt_tokens": 12000, "completion_tokens": 3000},
    }
    monkeypatch.setattr(
        "bidlab.services.jobs.meta_adapter.select_adapter",
        lambda mode: meta_adapter.LiveExtractor(
            api_key="test-key",
            model="muse-spark-1.3",
            endpoint_url="https://meta.test/chat",
        ),
    )
    monkeypatch.setattr(httpx, "post", lambda *a, **k: httpx.Response(200, json=body))
    res = demo_client.post(
        "/api/v1/tenders/tias/analysis",
        json=_body(mode="live", allow_remote_processing=True),
        headers=_headers("k-receipt"),
    )
    assert res.status_code == 202
    job = g.Job.model_validate(res.json())
    assert job.status == "queued"
    job = g.Job.model_validate(_poll_terminal(demo_client, job.id.root))
    assert job.status == "failed"
    assert job.error_code is not None
    assert job.error_code.root == "invalid_model_output"
    with _db() as session:
        invocation = session.scalars(
            select(models.ModelInvocation).where(models.ModelInvocation.job_id == job.id.root)
        ).one()
        assert invocation.mode == "live"
        assert invocation.model == "muse-spark-1.3"
        assert invocation.provider_request_id == "mock-response-no-network"
        assert invocation.prompt_tokens == 12000
        assert invocation.completion_tokens == 3000
        assert invocation.estimated_cost_usd == meta_adapter.estimate_cost_usd(12000, 3000)
        assert invocation.latency_ms is not None
        assert invocation.status == "failed"


def _live_transport(monkeypatch: pytest.MonkeyPatch, post: object) -> None:
    monkeypatch.setattr(
        "bidlab.services.jobs.meta_adapter.select_adapter",
        lambda mode: meta_adapter.LiveExtractor(
            api_key="test-key",
            model="muse-spark-1.3",
            endpoint_url="https://meta.test/chat",
        ),
    )
    monkeypatch.setattr(httpx, "post", post)


def test_live_success_settles_reported_cost(
    demo_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PKG-T02: a billed ok call settles its reported cost, not the estimate."""
    proposal = (
        meta_adapter.StubExtractor()
        .extract([meta_adapter.PageInput("doc-tias-pcap", 1, "x")])
        .proposal
    )
    body = {
        "id": "mock-ok-no-network",
        "model": "muse-spark-1.3",
        "choices": [
            {
                "finish_reason": "stop",
                "message": {"content": json.dumps(proposal)},
            }
        ],
        "usage": {"prompt_tokens": 100, "completion_tokens": 50},
    }
    _live_transport(monkeypatch, lambda *a, **k: httpx.Response(200, json=body))
    res = demo_client.post(
        "/api/v1/tenders/tias/analysis",
        json=_body(mode="live", allow_remote_processing=True),
        headers=_headers("k-settle-ok"),
    )
    assert res.status_code == 202
    job = g.Job.model_validate(res.json())
    assert job.status == "queued"
    job = g.Job.model_validate(_poll_terminal(demo_client, job.id.root))
    assert job.status == "needs_review"
    key = f"inv-{job.id.root}-a1"
    with _db() as session:
        row = session.get(models.ModelSpendReservation, key)
        assert row is not None
        assert row.state == "settled"
        assert row.actual_micro_usd == 338
        assert row.receipt == key
    totals = budget_service.totals(get_engine(), ceiling_micro=20_000_000)
    assert totals["spent"] == 338
    assert totals["held"] == 0


def test_live_invalid_output_settles_reported_cost(
    demo_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PKG-T02: invalid proposals still settle the billed usage (B01 cost)."""
    body = {
        "id": "mock-invalid-no-network",
        "model": "muse-spark-1.3",
        "choices": [{"finish_reason": "stop", "message": {"content": "{invalid-json"}}],
        "usage": {"prompt_tokens": 12000, "completion_tokens": 3000},
    }
    _live_transport(monkeypatch, lambda *a, **k: httpx.Response(200, json=body))
    res = demo_client.post(
        "/api/v1/tenders/tias/analysis",
        json=_body(mode="live", allow_remote_processing=True),
        headers=_headers("k-settle-invalid"),
    )
    assert res.status_code == 202
    job = g.Job.model_validate(res.json())
    assert job.status == "queued"
    job = g.Job.model_validate(_poll_terminal(demo_client, job.id.root))
    assert job.status == "failed"
    key = f"inv-{job.id.root}-a1"
    with _db() as session:
        row = session.get(models.ModelSpendReservation, key)
        assert row is not None
        assert row.state == "settled"
        assert row.actual_micro_usd == 27750
    assert budget_service.totals(get_engine(), ceiling_micro=20_000_000)["spent"] == 27750


def test_live_timeout_settles_estimate_as_uncertain(
    demo_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PKG-T02 acceptance: sent-but-unknown never settles as zero."""

    def _timeout(*args: object, **kwargs: object) -> object:
        raise httpx.TimeoutException("read timed out")

    _live_transport(monkeypatch, _timeout)
    res = demo_client.post(
        "/api/v1/tenders/tias/analysis",
        json=_body(mode="live", allow_remote_processing=True),
        headers=_headers("k-settle-timeout"),
    )
    assert res.status_code == 202
    job = g.Job.model_validate(res.json())
    assert job.status == "queued"
    job = g.Job.model_validate(_poll_terminal(demo_client, job.id.root))
    assert job.status == "failed"
    assert job.error_code is not None
    assert job.error_code.root == "provider_failure"
    key = f"inv-{job.id.root}-a1"
    with _db() as session:
        invocation = session.get(models.ModelInvocation, key)
        assert invocation is not None
        assert invocation.status == "uncertain"
        row = session.get(models.ModelSpendReservation, key)
        assert row is not None
        assert row.state == "settled"
        assert row.actual_micro_usd == row.amount_micro_usd
        assert row.actual_micro_usd > 0


def test_live_unsent_attempt_releases_hold(
    demo_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PKG-T02: failures before the network free the reservation."""

    class _NotSent:
        is_live = True

        def extract(self, pages: object) -> object:
            raise meta_adapter.AdapterError("bad_request", "pages rejected")

    monkeypatch.setattr(
        "bidlab.services.jobs.meta_adapter.select_adapter",
        lambda mode: _NotSent(),
    )
    res = demo_client.post(
        "/api/v1/tenders/tias/analysis",
        json=_body(mode="live", allow_remote_processing=True),
        headers=_headers("k-release"),
    )
    assert res.status_code == 202
    job = g.Job.model_validate(res.json())
    assert job.status == "queued"
    job = g.Job.model_validate(_poll_terminal(demo_client, job.id.root))
    assert job.status == "failed"
    key = f"inv-{job.id.root}-a1"
    with _db() as session:
        row = session.get(models.ModelSpendReservation, key)
        assert row is not None
        assert row.state == "released"
        invocation = session.get(models.ModelInvocation, key)
        assert invocation is not None
        assert invocation.mode == "live"
    totals = budget_service.totals(get_engine(), ceiling_micro=20_000_000)
    assert (totals["spent"], totals["held"]) == (0, 0)


def test_slow_provider_does_not_block_polling_or_health(
    demo_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PKG-T03 acceptance: 202 returns before inference; polls stay fast."""

    gate = threading.Event()

    class _Gated:
        is_live = False

        def extract(self, pages: object) -> object:
            assert gate.wait(timeout=20)
            return meta_adapter.StubExtractor().extract(pages)  # type: ignore[arg-type]

    monkeypatch.setattr(
        "bidlab.services.jobs.meta_adapter.select_adapter",
        lambda mode: _Gated(),
    )
    res = demo_client.post(
        "/api/v1/tenders/tias/analysis", json=_body(), headers=_headers("k-gated")
    )
    assert res.status_code == 202
    assert res.json()["status"] == "queued"
    job_id = res.json()["id"]
    # The worker is gated inside extract: polling and health still answer.
    queued = demo_client.get(f"/api/v1/jobs/{job_id}")
    assert queued.status_code == 200
    assert queued.json()["status"] in ("queued", "running")
    health = demo_client.get("/api/v1/health")
    assert health.status_code == 200
    gate.set()
    terminal = _poll_terminal(demo_client, job_id)
    assert terminal["status"] == "needs_review"


def test_worker_start_requeues_orphans(demo_client: TestClient) -> None:
    """PKG-T03: boot re-queues jobs left queued by a previous process."""
    now = dt.datetime.now(dt.UTC).isoformat()
    with _db() as session:
        session.add(
            models.Job(
                id="job-orphan-1",
                tender_id="tias",
                status="queued",
                request_json={
                    "input": {"document_ids": ["doc-tias-pcap"], "mode": "curated_demo"},
                    "progress": {"processed_pages": 0, "total_pages": 6},
                    "warnings": [],
                    "attempts": 0,
                },
                stage="queued",
                generation=1,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()
    worker_service.start()
    terminal = _poll_terminal(demo_client, "job-orphan-1")
    assert terminal["status"] == "needs_review"
