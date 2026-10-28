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
    detail = demo_client.get(f"/api/v1/jobs/{res.json()['id']}")
    assert detail.status_code == 200
    data = g.Job.model_validate(detail.json()).model_dump(mode="json")
    assert data["mode"] == "fixture"
    assert data["invocation_id"] is not None
    assert data["model"] is None
    assert data["prompt_tokens"] is None
    assert data["estimated_cost_usd"] is None


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
    empty_v2 = {
        "schema_version": "2.0-proposal",
        "observations": [],
        "ambiguities": [],
        "unread_image_ids": [],
    }
    body = {
        "id": "mock-ok-no-network",
        "model": "muse-spark-1.3",
        "choices": [
            {
                "finish_reason": "stop",
                "message": {"content": json.dumps(empty_v2)},
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
    detail = demo_client.get(f"/api/v1/jobs/{job.id.root}")
    assert detail.status_code == 200
    data = g.Job.model_validate(detail.json()).model_dump(mode="json")
    assert data["mode"] == "live"
    assert data["model"] == "muse-spark-1.3"
    assert data["prompt_tokens"] == 100
    assert data["completion_tokens"] == 50
    assert data["estimated_cost_usd"] == meta_adapter.estimate_cost_usd(100, 50)
    assert data["provider_request_id"] == "mock-ok-no-network"
    assert data["invocation_id"] == f"inv-{job.id.root}-a1"
    assert data["latency_ms"] is not None


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


def _one_page_pdf() -> bytes:
    text = "(hola mundo)"
    stream = f"BT /F1 12 Tf 20 20 Td {text} Tj ET".encode("latin-1")
    pdf = b"%PDF-1.4\n"
    offsets = {}
    body = (
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Resources"
        b"<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n"
        b"4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
        b"5 0 obj<</Length "
        + str(len(stream)).encode("ascii")
        + b">>stream\n"
        + stream
        + b"\nendstream\nendobj\n"
    )
    for num in (1, 2, 3, 4, 5):
        marker = f"{num} 0 obj".encode("ascii")
        offsets[num] = len(pdf) + body.index(marker)
    pdf += body
    xref_at = len(pdf)
    pdf += b"xref\n0 6\n0000000000 65535 f \n"
    for num in range(1, 6):
        pdf += f"{offsets[num]:010d} 00000 n \n".encode("ascii")
    pdf += b"trailer<</Size 6/Root 1 0 R>>\nstartxref\n" + str(xref_at).encode("ascii") + b"\n%%EOF"
    return pdf


def test_live_analysis_sends_rendered_images(
    demo_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PKG-T06: upload renders travel inside the hybrid packet; packet persists."""
    up = demo_client.post(
        "/api/v1/tenders/tias/documents",
        files={"file": ("render.pdf", _one_page_pdf(), "application/pdf")},
        data={"kind": "other"},
        headers={**CLIENT_HEADERS, "Idempotency-Key": "up-hybrid-img"},
    )
    assert up.status_code == 201, up.text
    doc_id = up.json()["id"]
    captured: dict[str, Any] = {}

    def _capture(*args: Any, **kwargs: Any) -> httpx.Response:
        captured["json"] = kwargs["json"]
        echo = json.loads(kwargs["json"]["messages"][1]["content"][0]["text"])["source"]
        content = {
            "schema_version": "2.0-proposal",
            "observations": [
                {
                    "id": "ob-1",
                    "field": "budget_net",
                    "value": "118336.00",
                    "qualifier": {
                        "scope_id": None,
                        "unit": "EUR",
                        "currency": None,
                        "tax_basis": None,
                        "period_segment": None,
                        "reference_kind": None,
                    },
                    "source": {
                        "document_id": echo["document_id"],
                        "document_sha256": echo["document_sha256"],
                        "physical_page": echo["physical_page"],
                        "verbatim_excerpt": "phantom quote",
                        "image_id": echo["image_id"],
                        "image_sha256": echo["image_sha256"],
                        "bbox_0_1000": [0, 0, 10, 10],
                    },
                    "status": "proposed",
                }
            ],
            "ambiguities": [],
            "unread_image_ids": [],
        }
        chat = {
            "id": "mock-hybrid-no-network",
            "model": "muse-spark-1.3",
            "choices": [{"finish_reason": "stop", "message": {"content": json.dumps(content)}}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 50},
        }
        return httpx.Response(200, json=chat)

    _live_transport(monkeypatch, _capture)
    res = demo_client.post(
        "/api/v1/tenders/tias/analysis",
        json=_body(mode="live", allow_remote_processing=True, document_ids=[doc_id]),
        headers=_headers("k-hybrid-img"),
    )
    assert res.status_code == 202
    job = g.Job.model_validate(res.json())
    terminal = _poll_terminal(demo_client, job.id.root)
    assert terminal["status"] == "needs_review"
    parts = captured["json"]["messages"][1]["content"]
    assert [part["type"] for part in parts] == ["text", "image_url"]
    assert parts[1]["image_url"]["url"].startswith("data:image/png;base64,")
    source = json.loads(parts[0]["text"])["source"]
    assert source["document_id"] == doc_id
    assert source["image_id"] is not None
    with _db() as session:
        stored = session.get(models.Job, job.id.root)
        assert stored is not None
        packet = stored.request_json["manifest"]["packet"]
        assert packet["pages"][0]["document_id"] == doc_id
        assert packet["pages"][0]["image_sha256"] is not None
        assert packet["observations"]["observations"][0]["id"] == "ob-1"


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


def test_empty_pages_count_zero_and_force_review(demo_client: TestClient) -> None:
    """PKG-T04/B02 fixed: empty rows are not readable text; review forced."""
    with _db() as session:
        rows = session.scalars(select(models.DocumentPage)).all()
        assert len(rows) == 6
        for row in rows:
            row.raw_text = ""
            row.normalized_text = ""
            row.flags_json = {}
        session.commit()
    res = demo_client.post(
        "/api/v1/tenders/tias/analysis", json=_body(), headers=_headers("k-empty")
    )
    assert res.status_code == 202
    job = g.Job.model_validate(res.json())
    assert job.status == "queued"
    terminal = _poll_terminal(demo_client, job.id.root)
    assert terminal["status"] == "needs_review"
    assert terminal["processed_pages"] == 0
    assert terminal["total_pages"] == 41
    assert any("no_extractable_text" in warning for warning in terminal["warnings"])
    with _db() as session:
        stored = session.get(models.Job, job.id.root)
        assert stored is not None
        manifest = stored.request_json["manifest"]
        assert manifest["coverage"]["usable_text"] == 0
        assert manifest["coverage"]["not_submitted"] == 41
        assert manifest["coverage"]["requires_attention"] is True
    workspace = demo_client.get("/api/v1/tenders/tias/workspace")
    assert workspace.status_code == 200
    assert any("no_extractable_text" in warning for warning in workspace.json()["warnings"])


def test_truncated_page_warns_in_result_and_review(demo_client: TestClient) -> None:
    """PKG-T04: text_truncated is usable (counts) but warns everywhere."""
    with _db() as session:
        row = session.scalars(select(models.DocumentPage)).first()
        assert row is not None
        row.flags_json = {"text_truncated": True}
        session.commit()
    res = demo_client.post(
        "/api/v1/tenders/tias/analysis", json=_body(), headers=_headers("k-trunc")
    )
    assert res.status_code == 202
    job = g.Job.model_validate(res.json())
    terminal = _poll_terminal(demo_client, job.id.root)
    assert terminal["processed_pages"] == 6
    assert any("text_truncated" in warning for warning in terminal["warnings"])
    workspace = demo_client.get("/api/v1/tenders/tias/workspace")
    assert workspace.status_code == 200
    assert any("text_truncated" in warning for warning in workspace.json()["warnings"])
