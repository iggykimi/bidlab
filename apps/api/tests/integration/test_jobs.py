"""I06 + T17: analysis run endpoint (202), job polling, stub honesty."""

import socket
from typing import Any

import httpx
import pytest
from bidlab.db import models
from bidlab.db.session import get_engine
from bidlab.schemas import generated as g
from bidlab.services import meta_adapter
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


def test_start_and_poll_needs_review(demo_client: TestClient) -> None:
    res = demo_client.post("/api/v1/tenders/tias/analysis", json=_body(), headers=_headers("k1"))
    assert res.status_code == 202
    assert res.headers["Location"].startswith("/api/v1/jobs/job-")
    job = g.Job.model_validate(res.json())
    assert job.status == "needs_review"
    assert job.result_revision is not None
    assert job.result_revision.root == 2
    assert job.total_pages == 41
    assert 0 < job.processed_pages <= job.total_pages
    assert any("fixture_stub" in w.root for w in job.warnings)

    poll = demo_client.get(f"/api/v1/jobs/{job.id}")
    assert poll.status_code == 200
    assert g.Job.model_validate(poll.json()).status == "needs_review"

    with _db() as session:
        invocation = session.scalars(
            select(models.ModelInvocation).where(models.ModelInvocation.job_id == job.id)
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
