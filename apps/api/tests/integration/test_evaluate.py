"""I03/I04/I11: evaluate Tías 5%, single bidder, curve, invalid inputs."""

import json
from collections.abc import Iterator
from decimal import Decimal
from pathlib import Path

import pytest
from bidlab.api import deps
from bidlab.db.session import get_engine
from bidlab.main import app
from bidlab.schemas import generated as g
from bidlab.services import seed as seed_service
from bidlab.settings import get_settings
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[4]
client = TestClient(app)
HEADERS = {"X-BidLab-Client": "local-ui"}


@pytest.fixture()
def eval_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("BIDLAB_STORAGE_DIR", str(tmp_path))
    get_settings.cache_clear()
    get_engine.cache_clear()
    seed_service.seed()

    def override_db() -> Iterator[Session]:
        session = Session(get_engine())
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    app.dependency_overrides[deps.get_db] = override_db
    try:
        yield client
    finally:
        app.dependency_overrides.clear()
        get_settings.cache_clear()
        get_engine.cache_clear()


def _request() -> dict:
    raw = (ROOT / "examples" / "evaluation_request.json").read_text(encoding="utf-8")
    payload = json.loads(raw)
    payload["pricing_rule_id"] = "tias-price-r1"  # seed id; example file uses an illustrative id
    return payload


def test_evaluate_tias_5_percent(eval_client: TestClient) -> None:
    res = eval_client.post("/api/v1/scenarios/evaluate", json=_request(), headers=HEADERS)
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


def test_evaluate_single_bidder(eval_client: TestClient) -> None:
    payload = _request()
    payload["rivals"] = {
        "state": "unspecified",
        "complete": True,
        "group_membership_confirmed": True,
        "own_group_id": "own",
        "offers": [],
    }
    res = eval_client.post("/api/v1/scenarios/evaluate", json=payload, headers=HEADERS)
    assert res.status_code == 200, res.text
    plain = g.EvaluationResult.model_validate(res.json()).model_dump(mode="json")
    assert plain["score"]["status"] == "defined"
    assert plain["score"]["value"] == "49.000000000000"
    assert plain["anomaly"]["branch"] == "n1"


def test_evaluate_curve(eval_client: TestClient) -> None:
    payload = _request()
    payload["curve"] = {"from_discount_rate": "0.0000", "to_discount_rate": "0.4000", "points": 11}
    res = eval_client.post("/api/v1/scenarios/evaluate", json=payload, headers=HEADERS)
    assert res.status_code == 200, res.text
    plain = g.EvaluationResult.model_validate(res.json()).model_dump(mode="json")
    assert len(plain["curve"]) == 11
    assert plain["curve"][0]["price_net"] == "118336.00"
    assert plain["curve"][-1]["price_net"] == "71001.60"
    prices = [p["price_net"] for p in plain["curve"]]
    assert prices == sorted(prices, key=Decimal, reverse=True)


def test_evaluate_rejects_invalid(eval_client: TestClient) -> None:
    payload = _request()
    payload["discount_rate"] = "0.5000"
    res = eval_client.post("/api/v1/scenarios/evaluate", json=payload, headers=HEADERS)
    assert res.status_code == 422

    payload = _request()
    payload["rivals"]["offers"][0]["price_net"] = 106502.40
    res = eval_client.post("/api/v1/scenarios/evaluate", json=payload, headers=HEADERS)
    assert res.status_code == 422

    payload = _request()
    payload["unknown_field"] = "x"
    res = eval_client.post("/api/v1/scenarios/evaluate", json=payload, headers=HEADERS)
    assert res.status_code == 422
    assert res.json()["code"] == "extra_forbidden"
