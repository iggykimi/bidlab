"""Compare endpoint + tender scenario/report collections."""

import json
from pathlib import Path
from typing import Any, cast

from bidlab.db import models
from bidlab.db.session import get_engine
from bidlab.schemas import generated as g
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[4]
COMPARE_HEADERS = {"X-BidLab-Client": "local-ui"}


def _input(discount: str = "0.1000", rule_revision: int = 1) -> dict[str, Any]:
    raw = (ROOT / "examples" / "evaluation_request.json").read_text(encoding="utf-8")
    payload = json.loads(raw)
    payload["pricing_rule_id"] = "tias-price-r1"
    payload["pricing_rule_revision"] = rule_revision
    payload["discount_rate"] = discount
    return cast("dict[str, Any]", payload)


def _save(client: TestClient, name: str, payload: dict[str, Any], key: str) -> str:
    res = client.post(
        "/api/v1/scenarios",
        json={"name": name, "input": payload},
        headers={"X-BidLab-Client": "local-ui", "Idempotency-Key": key},
    )
    assert res.status_code == 201, res.text
    return str(res.json()["id"])


def test_golden_compare_10_vs_15(seeded_client: TestClient) -> None:
    id15 = _save(seeded_client, "Baja 15%", _input("0.1500"), "cmp-g15")
    id10 = _save(seeded_client, "Baja 10%", _input("0.1000"), "cmp-g10")
    res = seeded_client.post(
        "/api/v1/scenarios/compare",
        json={"scenario_ids": [id15, id10], "primary_id": id15},
        headers=COMPARE_HEADERS,
    )
    assert res.status_code == 200, res.text
    plain = g.CompareResult.model_validate(res.json()).model_dump(mode="json")
    assert plain["status"] == "comparable"
    assert plain["warnings"] == []
    assert [entry["score_value"] for entry in plain["entries"]] == [
        "49.000000000000",
        "49.000000000000",
    ]
    (delta,) = plain["deltas"]
    assert delta["delta_price_net"] == "5916.80"
    assert delta["delta_profit_net"] == "5916.80"
    assert delta["delta_score"] == "0.000000000000"
    assert delta["cost_per_point_net"] is None
    assert "mismos puntos" in (delta["cost_per_point_motivo"] or "")
    assert delta["dominant_id"] == id10
    assert delta["indicator"] == "higher_profit_same_score"
    assert "5.916,80\u00a0€" in delta["indicator_motivo"]
    assert "con los mismos puntos" in delta["indicator_motivo"]


def test_frontier_rejects_mixed_contexts(seeded_client: TestClient) -> None:
    """BL-V2-05/Q02-F: scenarios from different hypotheses never share a frontier."""
    twin_id = _save(seeded_client, "Frontera base", _input(), "fro-1")
    unspecified = _input()
    unspecified["rivals"] = {
        "state": "unspecified",
        "complete": False,
        "group_membership_confirmed": False,
        "own_group_id": None,
        "offers": [],
    }
    other_id = _save(seeded_client, "Frontera otra hipótesis", unspecified, "fro-2")
    res = seeded_client.post(
        "/api/v1/scenarios/frontier",
        json={"scenario_ids": [twin_id, other_id]},
        headers=COMPARE_HEADERS,
    )
    assert res.status_code == 422, res.text
    assert res.json()["code"] == "frontier_not_comparable"


def test_compare_max_three_and_min_two_enforced(seeded_client: TestClient) -> None:
    for body in (
        {"scenario_ids": ["a", "b", "c", "d"], "primary_id": "a"},
        {"scenario_ids": ["a"], "primary_id": "a"},
    ):
        res = seeded_client.post("/api/v1/scenarios/compare", json=body, headers=COMPARE_HEADERS)
        assert res.status_code == 422, res.text
        assert res.json()["code"] == "validation_error"


def test_compare_rejects_duplicates_and_unknown_primary(seeded_client: TestClient) -> None:
    scenario_id = _save(seeded_client, "Baja 10%", _input(), "cmp-dup")
    res = seeded_client.post(
        "/api/v1/scenarios/compare",
        json={"scenario_ids": [scenario_id, scenario_id], "primary_id": scenario_id},
        headers=COMPARE_HEADERS,
    )
    assert res.status_code == 422
    assert res.json()["code"] == "compare_invalid_request"
    res = seeded_client.post(
        "/api/v1/scenarios/compare",
        json={"scenario_ids": [scenario_id, "other-id"], "primary_id": "missing-id"},
        headers=COMPARE_HEADERS,
    )
    assert res.status_code == 422
    assert res.json()["code"] == "compare_invalid_request"


def test_compare_rivals_set_difference_warns(seeded_client: TestClient) -> None:
    base_id = _save(seeded_client, "Baja 10%", _input(), "cmp-u1")
    unspecified = _input()
    unspecified["rivals"] = {
        "state": "unspecified",
        "complete": False,
        "group_membership_confirmed": False,
        "own_group_id": None,
        "offers": [],
    }
    # Same rivals object shape would still differ, so a no-rivals twin is
    # compared against itself under a second alias: unknown but comparable.
    twin_id = _save(seeded_client, "Baja 10% copia", _input(), "cmp-u2")
    res = seeded_client.post(
        "/api/v1/scenarios/compare",
        json={"scenario_ids": [base_id, twin_id], "primary_id": base_id},
        headers=COMPARE_HEADERS,
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "comparable"

    norivals_id = _save(seeded_client, "Baja 10% sin rivales", unspecified, "cmp-u3")
    res = seeded_client.post(
        "/api/v1/scenarios/compare",
        json={"scenario_ids": [norivals_id, twin_id], "primary_id": norivals_id},
        headers=COMPARE_HEADERS,
    )
    assert res.status_code == 200, res.text
    plain = g.CompareResult.model_validate(res.json()).model_dump(mode="json")
    assert plain["status"] == "no_comparable"  # rival sets differ
    assert any("rivales distintos" in warning for warning in plain["warnings"])


def test_compare_same_context_unknown_score_partial(seeded_client: TestClient) -> None:
    unspecified = _input()
    unspecified["rivals"] = {
        "state": "unspecified",
        "complete": False,
        "group_membership_confirmed": False,
        "own_group_id": None,
        "offers": [],
    }
    first = _save(seeded_client, "Sin rivales A", unspecified, "cmp-p1")
    second = _save(seeded_client, "Sin rivales B", unspecified, "cmp-p2")
    res = seeded_client.post(
        "/api/v1/scenarios/compare",
        json={"scenario_ids": [first, second], "primary_id": first},
        headers=COMPARE_HEADERS,
    )
    assert res.status_code == 200, res.text
    plain = g.CompareResult.model_validate(res.json()).model_dump(mode="json")
    assert plain["status"] == "partial"
    (delta,) = plain["deltas"]
    assert delta["delta_price_net"] == "0.00"
    assert delta["delta_score"] is None
    assert "no calculamos la diferencia de puntos" in (delta["delta_score_motivo"] or "")
    assert delta["indicator"] == "unknown"


def test_compare_different_rule_revision_warns(seeded_client: TestClient) -> None:
    first = _save(seeded_client, "Baja 10% r1", _input(), "cmp-r1")
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
    second = _save(seeded_client, "Baja 10% r2", _input(rule_revision=2), "cmp-r2")
    res = seeded_client.post(
        "/api/v1/scenarios/compare",
        json={"scenario_ids": [first, second], "primary_id": first},
        headers=COMPARE_HEADERS,
    )
    assert res.status_code == 200, res.text
    plain = g.CompareResult.model_validate(res.json()).model_dump(mode="json")
    assert plain["status"] == "no_comparable"
    assert any("revisión" in warning for warning in plain["warnings"])
    (delta,) = plain["deltas"]
    assert delta["delta_profit_net"] is None
    assert delta["dominant_id"] is None
    assert delta["indicator"] == "different_context"


def test_compare_pure_compute_convention(seeded_client: TestClient) -> None:
    """Compare needs X-BidLab-Client like evaluate, but no Idempotency-Key."""
    id15 = _save(seeded_client, "Baja 15%", _input("0.1500"), "cmp-c15")
    id10 = _save(seeded_client, "Baja 10%", _input("0.1000"), "cmp-c10")
    body = {"scenario_ids": [id15, id10], "primary_id": id15}
    first = seeded_client.post("/api/v1/scenarios/compare", json=body, headers=COMPARE_HEADERS)
    second = seeded_client.post("/api/v1/scenarios/compare", json=body, headers=COMPARE_HEADERS)
    assert first.status_code == 200, first.text
    assert second.status_code == 200
    assert second.json() == first.json()

    missing_guard = seeded_client.post("/api/v1/scenarios/compare", json=body)
    assert missing_guard.status_code == 403
    assert missing_guard.json()["code"] == "forbidden"

    unknown = seeded_client.post(
        "/api/v1/scenarios/compare",
        json={"scenario_ids": [id15, "no-such-id"], "primary_id": id15},
        headers=COMPARE_HEADERS,
    )
    assert unknown.status_code == 404
    assert unknown.json()["code"] == "scenario_not_found"


def test_list_tender_scenarios_paginated_light(seeded_client: TestClient) -> None:
    _save(seeded_client, "Baja 5%", _input("0.0500"), "cmp-l1")
    _save(seeded_client, "Baja 10%", _input("0.1000"), "cmp-l2")
    _save(seeded_client, "Baja 15%", _input("0.1500"), "cmp-l3")

    res = seeded_client.get("/api/v1/tenders/tias/scenarios?page=1&page_size=2")
    assert res.status_code == 200, res.text
    plain = g.ScenarioList.model_validate(res.json()).model_dump(mode="json")
    assert plain["page"] == 1
    assert plain["page_size"] == 2
    assert plain["total"] == 3
    assert len(plain["items"]) == 2
    for item in plain["items"]:
        assert "input" not in item
        assert "result" not in item
        assert "context" not in item
        assert len(item["snapshot_sha256"]) == 64

    second = seeded_client.get("/api/v1/tenders/tias/scenarios?page=2&page_size=2")
    assert second.status_code == 200
    assert len(second.json()["items"]) == 1

    filtered = seeded_client.get("/api/v1/tenders/tias/scenarios?scope_id=tias-whole")
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 3

    missing_scope = seeded_client.get("/api/v1/tenders/tias/scenarios?scope_id=nope")
    assert missing_scope.status_code == 404
    assert missing_scope.json()["code"] == "scope_not_found"

    missing_tender = seeded_client.get("/api/v1/tenders/nope/scenarios")
    assert missing_tender.status_code == 404
    assert missing_tender.json()["code"] == "tender_not_found"


def test_list_collections_scope_mismatch(seeded_client: TestClient) -> None:
    session = Session(get_engine())
    try:
        session.add(
            models.Tender(
                id="other",
                feed_id="feed",
                atom_id="atom",
                external_id="ext",
                title="Other",
                source_url="https://example.invalid",
                source_updated_at="2026-10-26T00:00:00Z",
                metadata_json={},
            )
        )
        session.flush()
        session.add(
            models.Scope(
                id="other-whole",
                tender_id="other",
                lot_key="__whole__",
                basis_json={},
                budget_net_cents=None,
            )
        )
        session.commit()
    finally:
        session.close()
    for path in ("scenarios", "reports"):
        res = seeded_client.get(f"/api/v1/tenders/tias/{path}?scope_id=other-whole")
        assert res.status_code == 422, (path, res.text)
        assert res.json()["code"] == "scope_tender_mismatch"


def test_list_tender_reports_light(seeded_client: TestClient) -> None:
    scenario_id = _save(seeded_client, "Baja 10%", _input(), "cmp-rep")
    created = seeded_client.post(
        "/api/v1/reports",
        json={"scenario_id": scenario_id, "decision": "study", "note": "n"},
        headers={"X-BidLab-Client": "local-ui", "Idempotency-Key": "cmp-rep-1"},
    )
    assert created.status_code == 201, created.text

    res = seeded_client.get("/api/v1/tenders/tias/reports")
    assert res.status_code == 200, res.text
    plain = g.ReportList.model_validate(res.json()).model_dump(mode="json")
    assert plain["total"] == 1
    (item,) = plain["items"]
    assert item["scenario_id"] == scenario_id
    assert item["scenario_name"] == "Baja 10%"
    assert item["scope_id"] == "tias-whole"
    assert item["decision"] == "study"
    assert "scenario" not in item

    filtered = seeded_client.get("/api/v1/tenders/tias/reports?scope_id=tias-whole")
    assert filtered.json()["total"] == 1

    missing = seeded_client.get("/api/v1/tenders/nope/reports")
    assert missing.status_code == 404
    assert missing.json()["code"] == "tender_not_found"
