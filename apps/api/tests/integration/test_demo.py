"""Demo sessions: guard, create 201 (auto-seed on empty DB), idempotent replay."""

from bidlab.schemas import generated as g
from fastapi.testclient import TestClient

HEADERS = {"X-BidLab-Client": "local-ui", "Idempotency-Key": "e2e-demo-1"}


def test_demo_requires_client_header(fresh_client: TestClient) -> None:
    res = fresh_client.post("/api/v1/demo/sessions", headers={"Idempotency-Key": "k1"})
    assert res.status_code == 403
    assert res.json()["code"] == "forbidden"


def test_demo_create_replay_and_conflict(fresh_client: TestClient) -> None:
    res = fresh_client.post("/api/v1/demo/sessions", headers=HEADERS)
    assert res.status_code == 201
    first = g.DemoSession.model_validate(res.json())
    assert (first.tender_id, first.scope_id, first.company_id, first.mode) == (
        "tias",
        "tias-whole",
        "company-demo",
        "demo",
    )
    replay = fresh_client.post("/api/v1/demo/sessions", headers=HEADERS)
    assert replay.status_code == 200
    assert replay.json() == res.json()
    conflict = fresh_client.post(
        "/api/v1/demo/sessions", content=b'{"other":true}', headers=HEADERS
    )
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "idempotency_conflict"
