"""Scenarios + reports: save/get roundtrip, stale 409, idempotency, HTML sources."""

import json
from pathlib import Path

import pytest
from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.db.session import get_engine
from bidlab.schemas import generated as g
from bidlab.services import reports as reports_service
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[4]
HEADERS = {"X-BidLab-Client": "local-ui", "Idempotency-Key": "scn-1"}


def _input() -> dict:
    raw = (ROOT / "examples" / "evaluation_request.json").read_text(encoding="utf-8")
    payload = json.loads(raw)
    payload["pricing_rule_id"] = "tias-price-r1"
    return payload


def test_save_get_roundtrip(seeded_client: TestClient) -> None:
    res = seeded_client.post(
        "/api/v1/scenarios", json={"name": "Base 5%", "input": _input()}, headers=HEADERS
    )
    assert res.status_code == 201, res.text
    saved = g.Scenario.model_validate(res.json())
    plain = saved.model_dump(mode="json")
    assert plain["name"] == "Base 5%"
    assert plain["result"]["price_net"] == "112419.20"
    assert plain["context"]["rule"]["id"] == "tias-price-r1"
    assert len(plain["snapshot_sha256"]) == 64
    assert plain["context"]["pending_items"], "expected pending items (manual leaves)"

    fetched = seeded_client.get(f"/api/v1/scenarios/{plain['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == res.json()

    replay = seeded_client.post(
        "/api/v1/scenarios", json={"name": "Base 5%", "input": _input()}, headers=HEADERS
    )
    assert replay.status_code == 200
    assert replay.json()["id"] == plain["id"]


def test_save_rejects_stale_revision(seeded_client: TestClient, tmp_path: Path) -> None:
    session = Session(get_engine())
    try:
        rule = session.get(models.RuleRevision, ("tias-price-r1", 1))
        assert rule is not None
        session.add(
            models.RuleRevision(
                rule_id=rule.rule_id,
                revision=2,
                scope_id=rule.scope_id,
                interpretation_revision=rule.interpretation_revision,
                rule_json=rule.rule_json,
                review_status="approved",
                actor="test",
                reason="newer revision",
                created_at="2026-10-26T00:00:00Z",
            )
        )
        session.commit()
    finally:
        session.close()
    res = seeded_client.post(
        "/api/v1/scenarios",
        json={"name": "stale", "input": _input()},
        headers={"X-BidLab-Client": "local-ui", "Idempotency-Key": "scn-stale"},
    )
    assert res.status_code == 409
    assert res.json()["code"] == "stale_revision"


def test_report_with_html_sources(seeded_client: TestClient) -> None:
    res = seeded_client.post(
        "/api/v1/scenarios", json={"name": "Base 5%", "input": _input()}, headers=HEADERS
    )
    scenario_id = res.json()["id"]
    created = seeded_client.post(
        "/api/v1/reports",
        json={"scenario_id": scenario_id, "decision": "prepare", "note": "Margen OK <b>esc</b>"},
        headers={"X-BidLab-Client": "local-ui", "Idempotency-Key": "rep-1"},
    )
    assert created.status_code == 201, created.text
    report = g.Report.model_validate(created.json()).model_dump(mode="json")
    assert report["decision"] == "prepare"
    assert report["pending_items"] == report["scenario"]["context"]["pending_items"]

    fetched = seeded_client.get(f"/api/v1/reports/{report['id']}")
    assert fetched.status_code == 200

    html = seeded_client.get(f"/api/v1/reports/{report['id']}/html")
    assert html.status_code == 200
    assert "112419.20" in html.text
    assert report["scenario"]["snapshot_sha256"] in html.text
    assert "207.088" in html.text
    assert "<b>esc</b>" not in html.text  # user note is escaped
    assert "Demo curada" in html.text


def test_report_html_path_rejects_malformed_id(seeded_client: TestClient) -> None:
    """C7: non-uuid-hex ids never reach the filesystem (404, no traversal)."""
    for bad_id in ("not-a-uuid", "../escape", "..%2Fescape", "x" * 31, "Z" * 32, ""):
        with pytest.raises(ApiError) as exc:
            reports_service.html_path(bad_id)
        assert exc.value.status_code == 404
        assert exc.value.code == "report_not_found"
    http = seeded_client.get("/api/v1/reports/not-a-uuid/html")
    assert http.status_code == 404
    assert http.json()["code"] == "report_not_found"


def test_report_html_path_roundtrip(seeded_client: TestClient) -> None:
    res = seeded_client.post(
        "/api/v1/scenarios", json={"name": "Base 5%", "input": _input()}, headers=HEADERS
    )
    created = seeded_client.post(
        "/api/v1/reports",
        json={"scenario_id": res.json()["id"], "decision": "study", "note": "n"},
        headers={"X-BidLab-Client": "local-ui", "Idempotency-Key": "rep-roundtrip"},
    )
    assert created.status_code == 201, created.text
    report_id = str(created.json()["id"])
    assert reports_service.html_path(report_id).exists()
