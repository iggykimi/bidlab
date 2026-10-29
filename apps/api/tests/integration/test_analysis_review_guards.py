"""Real routes enforce source review and honest bounded page delivery."""

import json
import time
from io import BytesIO
from typing import Any

import httpx
import pytest
from bidlab.db import models
from bidlab.db.session import get_engine
from bidlab.schemas import generated as g
from bidlab.services import meta_adapter
from bidlab.settings import get_settings
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from sqlalchemy import select
from sqlalchemy.orm import Session

HEADERS = {"X-BidLab-Client": "local-ui"}


@pytest.mark.parametrize(
    "correction", ["quote", "page", "unknown", "ambiguous", "no-citations", "duplicate"]
)
def test_claim_approval_requires_every_citation_and_a_found_value(
    seeded_client: TestClient, correction: str
) -> None:
    with Session(get_engine()) as session:
        row = session.get(models.InterpretationRevision, ("tias", 1))
        assert row is not None
        proposal = json.loads(json.dumps(row.proposal_json))
    claim = proposal["claims"][0]
    if correction == "quote":
        claim["citations"][0]["verbatim_excerpt"] = "This sentence is not in the tender"
    elif correction == "page":
        claim["citations"][0]["page_number"] = 41
    elif correction == "unknown":
        claim["normalized_value"] = None
    elif correction == "ambiguous":
        claim["status"] = "ambiguous"
    elif correction == "no-citations":
        claim["citations"] = []
    elif correction == "duplicate":
        proposal["claims"].append(claim.copy())
    response = seeded_client.post(
        "/api/v1/tenders/tias/reviews",
        headers=HEADERS,
        json={
            "expected_revision": 1,
            "approved_claim_keys": [claim["key"]],
            "requirement_trees": [],
            "scope_basis": None,
            "pricing_rule": None,
            "corrected_proposal": proposal,
            "actor": "reviewer",
            "reason": "checking the original source",
        },
    )
    assert response.status_code == 422, response.text
    # Negative review paths must also respect the canonical ErrorCode enum.
    g.Error.model_validate(response.json())
    with Session(get_engine()) as session:
        assert session.get(models.InterpretationRevision, ("tias", 2)) is None


def test_changed_document_version_blocks_uncorrected_claim_approval(
    seeded_client: TestClient,
) -> None:
    with Session(get_engine()) as session:
        row = session.get(models.InterpretationRevision, ("tias", 1))
        assert row is not None
        key = row.proposal_json["claims"][0]["key"]  # type: ignore[index]
        doc = session.get(models.Document, "doc-tias-pcap")
        assert doc is not None
        doc.sha256 = "f" * 64
        session.commit()
    response = seeded_client.post(
        "/api/v1/tenders/tias/reviews",
        headers=HEADERS,
        json={
            "expected_revision": 1,
            "approved_claim_keys": [key],
            "requirement_trees": [],
            "scope_basis": None,
            "pricing_rule": None,
            "corrected_proposal": None,
            "actor": "reviewer",
            "reason": "old document no longer current",
        },
    )
    assert response.status_code == 409
    assert response.json()["code"] == "revision_conflict"


def test_long_scanned_document_submits_one_bounded_packet_and_reports_omissions(
    seeded_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    writer = PdfWriter()
    for _ in range(8):
        writer.add_blank_page(width=100, height=100)
    stream = BytesIO()
    writer.write(stream)
    uploaded = seeded_client.post(
        "/api/v1/tenders/tias/documents",
        headers={**HEADERS, "Idempotency-Key": "eight-pages"},
        files={"file": ("eight-scanned-pages.pdf", stream.getvalue(), "application/pdf")},
        data={"kind": "other"},
    )
    assert uploaded.status_code == 201
    calls: list[dict[str, Any]] = []

    def fake_post(*args: object, **kwargs: Any) -> httpx.Response:
        calls.append(kwargs["json"])
        content = {
            "schema_version": "2.0-proposal",
            "observations": [],
            "ambiguities": [],
            "unread_image_ids": [],
        }
        return httpx.Response(
            200,
            json={
                "id": "mock-eight-pages-no-network",
                "model": "muse-spark-1.3",
                "choices": [{"finish_reason": "stop", "message": {"content": json.dumps(content)}}],
                "usage": {"prompt_tokens": 100, "completion_tokens": 50},
            },
        )

    monkeypatch.setattr(
        meta_adapter,
        "select_adapter",
        lambda mode: meta_adapter.LiveExtractor(
            api_key="not-a-real-key",
            model="muse-spark-1.3",
            endpoint_url="https://meta.test/chat",
        ),
    )
    monkeypatch.setattr(httpx, "post", fake_post)
    response = seeded_client.post(
        "/api/v1/tenders/tias/analysis",
        headers={**HEADERS, "Idempotency-Key": "long-live"},
        json={
            "document_ids": [uploaded.json()["id"]],
            "mode": "live",
            "allow_remote_processing": True,
            "expected_interpretation_revision": 1,
        },
    )
    assert response.status_code == 202
    job_id = response.json()["id"]
    deadline = time.monotonic() + 10
    while True:
        result = seeded_client.get(f"/api/v1/jobs/{job_id}").json()
        if result["status"] in ("needs_review", "succeeded", "failed"):
            break
        assert time.monotonic() < deadline
        time.sleep(0.01)
    assert result["status"] == "needs_review"
    assert (result["processed_pages"], result["total_pages"]) == (6, 8)
    assert len(calls) == 1
    parts = calls[0]["messages"][1]["content"]
    assert sum(part["type"] == "image_url" for part in parts) == 6
    with Session(get_engine()) as session:
        row = session.get(models.Job, job_id)
        assert row is not None
        manifest = row.request_json["manifest"]
        assert isinstance(manifest, dict)
        assert manifest["coverage"]["not_submitted"] == 2
        assert manifest["coverage"]["usable_text"] == 0
        assert manifest["coverage"]["image_submitted"] == 6
        assert manifest["page_selection"]["complete_document_reading"] is False
        assert len(list(session.scalars(select(models.ModelInvocation)))) == 1


@pytest.mark.parametrize(
    ("origin", "allowed"),
    [
        ("http://localhost:9090", True),
        ("http://127.0.0.1:9090", True),
        ("http://[::1]:9090", True),
        ("http://127.0.0.1:5173", True),
        ("http://localhost:9091", False),
        ("http://localhost.evil.test:9090", False),
        ("http://127.0.0.1:9090@evil.test", False),
        ("null", False),
    ],
)
def test_mutations_accept_only_configured_app_or_dev_origins(
    seeded_client: TestClient, monkeypatch: pytest.MonkeyPatch, origin: str, allowed: bool
) -> None:
    monkeypatch.setenv("BIDLAB_PORT", "9090")
    get_settings.cache_clear()
    try:
        response = seeded_client.post(
            "/api/v1/demo/sessions",
            json={},
            headers={**HEADERS, "Origin": origin, "Idempotency-Key": "origin-port-test"},
        )
    finally:
        get_settings.cache_clear()
    assert response.status_code == (201 if allowed else 403), response.text
