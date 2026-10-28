"""C3: concurrent same-key POSTs collapse onto the winner's stored response."""

import json
import threading
from pathlib import Path
from typing import Any, cast

from bidlab.db import models
from bidlab.db.session import get_engine
from bidlab.main import app
from bidlab.services import idempotency
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[4]
HEADERS = {"X-BidLab-Client": "local-ui", "Idempotency-Key": "race-1"}


def _input() -> dict[str, Any]:
    raw = (ROOT / "examples" / "evaluation_request.json").read_text(encoding="utf-8")
    payload = json.loads(raw)
    payload["pricing_rule_id"] = "tias-price-r1"  # seed id; example file uses an illustrative id
    return cast("dict[str, Any]", payload)


def test_concurrent_save_scenario_same_key_returns_winner(
    seeded_client: TestClient,
) -> None:
    barrier = threading.Barrier(2)
    outcomes: list[tuple[int, dict[str, Any]]] = []

    def _post() -> None:
        barrier.wait(timeout=30)
        res = TestClient(app).post(
            "/api/v1/scenarios",
            json={"name": "race", "input": _input()},
            headers=HEADERS,
        )
        outcomes.append((res.status_code, res.json()))

    workers = [threading.Thread(target=_post) for _ in range(2)]
    for worker in workers:
        worker.start()
    for worker in workers:
        worker.join(timeout=120)
    assert all(not worker.is_alive() for worker in workers)
    assert len(outcomes) == 2, outcomes
    assert {status for status, _ in outcomes} <= {200, 201}, outcomes
    ids = {body["id"] for _, body in outcomes}
    assert len(ids) == 1, outcomes
    scenario_id = ids.pop()
    with Session(get_engine()) as session:
        scenarios = session.scalars(select(models.Scenario)).all()
        assert [row.id for row in scenarios] == [scenario_id]
        records = session.scalars(select(models.IdempotencyRecord)).all()
        assert len(records) == 1


def test_store_conflict_returns_winner_response(seeded_client: TestClient) -> None:
    body = b'{"name":"w"}'
    first = Session(get_engine())
    try:
        stored = idempotency.store(first, "POST /api/v1/scenarios", "k-winner", body, {"id": "s1"})
        assert stored is None
        first.commit()
    finally:
        first.close()
    second = Session(get_engine())
    try:
        winner = idempotency.store(second, "POST /api/v1/scenarios", "k-winner", body, {"id": "s2"})
    finally:
        second.close()
    assert winner == {"id": "s1"}
