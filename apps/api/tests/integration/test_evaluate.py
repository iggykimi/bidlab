"""I03/I04/I11: evaluate Tías 5%, single bidder, curve, invalid inputs."""

import json
from decimal import Decimal
from pathlib import Path

from bidlab.db import models
from bidlab.db.session import get_engine
from bidlab.schemas import generated as g
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[4]
HEADERS = {"X-BidLab-Client": "local-ui"}


def _request() -> dict:
    raw = (ROOT / "examples" / "evaluation_request.json").read_text(encoding="utf-8")
    payload = json.loads(raw)
    payload["pricing_rule_id"] = "tias-price-r1"  # seed id; example file uses an illustrative id
    return payload


def test_evaluate_tias_5_percent(seeded_client: TestClient) -> None:
    res = seeded_client.post("/api/v1/scenarios/evaluate", json=_request(), headers=HEADERS)
    assert res.status_code == 200, res.text
    result = g.EvaluationResult.model_validate(res.json())
    plain = result.model_dump(mode="json")
    assert plain["price_net"] == "112419.20"
    assert plain["profit_net"] == "22419.20"
    assert plain["margin_rate"] == "0.199425009251"
    assert plain["score"]["status"] == "defined"
    assert plain["score"]["value"] == "46.421052631579"
    assert plain["anomaly"]["status"] == "not_flagged_under_assumptions"
    assert plain["anomaly"]["branch"] == "n3_no_trim"
    assert plain["engine_version"] == "1.0.0"
    assert len(plain["trace"]) >= 2
    assert len(plain["source_hashes"]) == 2
    trace_text = " ".join(f"{step['label']} {step['expression']}" for step in plain["trace"])
    assert "plantilla proportional_inverse sobre 112419.20" in trace_text
    assert "política tias-18-5, rama n3_no_trim" in trace_text


def test_evaluate_incomplete_assumptions_spanish_copy(seeded_client: TestClient) -> None:
    """Copy A1/A2: undetermined score/anomaly read without raw unknown."""
    payload = _request()
    payload["rivals"] = {
        "state": "assumed",
        "complete": False,
        "group_membership_confirmed": False,
        "own_group_id": None,
        "offers": [],
    }
    res = seeded_client.post("/api/v1/scenarios/evaluate", json=payload, headers=HEADERS)
    assert res.status_code == 200, res.text
    plain = g.EvaluationResult.model_validate(res.json()).model_dump(mode="json")
    assumptions = plain["assumptions"]
    assert "Conjunto incompleto: puntuación sin determinar" in assumptions
    assert "Pertenencia a grupos sin confirmar: anormalidad sin determinar" in assumptions


def test_evaluate_single_bidder(seeded_client: TestClient) -> None:
    payload = _request()
    payload["rivals"] = {
        "state": "unspecified",
        "complete": True,
        "group_membership_confirmed": True,
        "own_group_id": "own",
        "offers": [],
    }
    res = seeded_client.post("/api/v1/scenarios/evaluate", json=payload, headers=HEADERS)
    assert res.status_code == 200, res.text
    plain = g.EvaluationResult.model_validate(res.json()).model_dump(mode="json")
    assert plain["score"]["status"] == "defined"
    assert plain["score"]["value"] == "49.000000000000"
    assert plain["anomaly"]["branch"] == "n1"


def test_evaluate_curve(seeded_client: TestClient) -> None:
    payload = _request()
    payload["curve"] = {"from_discount_rate": "0.0000", "to_discount_rate": "0.4000", "points": 11}
    res = seeded_client.post("/api/v1/scenarios/evaluate", json=payload, headers=HEADERS)
    assert res.status_code == 200, res.text
    plain = g.EvaluationResult.model_validate(res.json()).model_dump(mode="json")
    assert len(plain["curve"]) == 11
    assert plain["curve"][0]["price_net"] == "118336.00"
    assert plain["curve"][-1]["price_net"] == "71001.60"
    prices = [p["price_net"] for p in plain["curve"]]
    assert prices == sorted(prices, key=Decimal, reverse=True)


def test_evaluate_rglcap_has_no_absolute_close(seeded_client: TestClient) -> None:
    """C1: Tías flags the absolute-25 close; RGLCAP85 (same flag=true) does not."""
    payload = _request()
    payload["discount_rate"] = "0.2600"  # price 87568.64 < 0.75 * base (88752.00)
    payload["rivals"] = {
        "state": "assumed",
        "complete": True,
        "group_membership_confirmed": True,
        "own_group_id": "own",
        "offers": [
            {"label": "R1", "price_net": "88000.00", "group_id": "g1"},
            {"label": "R2", "price_net": "88500.00", "group_id": "g2"},
        ],
    }
    tias = seeded_client.post("/api/v1/scenarios/evaluate", json=payload, headers=HEADERS)
    assert tias.status_code == 200, tias.text
    tias_anomaly = g.EvaluationResult.model_validate(tias.json()).model_dump(mode="json")["anomaly"]
    assert tias_anomaly["status"] == "possible_justification_required"
    assert tias_anomaly["branch"] == "n3_no_trim"
    assert "absolute_25_close" in tias_anomaly["reason_codes"]

    with Session(get_engine()) as session:
        rule = session.get(models.RuleRevision, ("tias-price-r1", 1))
        assert rule is not None
        rule_json = dict(rule.rule_json) if isinstance(rule.rule_json, dict) else {}
        policy = dict(rule_json.get("anomaly_policy", {}))
        assert policy.get("three_bidder_absolute_25") is True
        policy["variant"] = "rglcap85_standard"
        rule_json["anomaly_policy"] = policy
        rule.rule_json = rule_json
        session.commit()

    rglcap = seeded_client.post("/api/v1/scenarios/evaluate", json=payload, headers=HEADERS)
    assert rglcap.status_code == 200, rglcap.text
    rglcap_anomaly = g.EvaluationResult.model_validate(rglcap.json()).model_dump(mode="json")[
        "anomaly"
    ]
    assert rglcap_anomaly["status"] == "not_flagged_under_assumptions"
    assert rglcap_anomaly["branch"] == "n3_no_trim"
    assert "absolute_25_close" not in rglcap_anomaly["reason_codes"]


def test_evaluate_rejects_invalid(seeded_client: TestClient) -> None:
    payload = _request()
    payload["discount_rate"] = "0.5000"
    res = seeded_client.post("/api/v1/scenarios/evaluate", json=payload, headers=HEADERS)
    assert res.status_code == 422

    payload = _request()
    payload["rivals"]["offers"][0]["price_net"] = 106502.40
    res = seeded_client.post("/api/v1/scenarios/evaluate", json=payload, headers=HEADERS)
    assert res.status_code == 422

    payload = _request()
    payload["unknown_field"] = "x"
    res = seeded_client.post("/api/v1/scenarios/evaluate", json=payload, headers=HEADERS)
    assert res.status_code == 422
    assert res.json()["code"] == "extra_forbidden"
