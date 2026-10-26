"""Demo sessions: guard, create 201 (auto-seed on empty DB), idempotent replay."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from bidlab.api import deps
from bidlab.db.session import get_engine
from bidlab.main import app
from bidlab.schemas import generated as g
from bidlab.settings import get_settings
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

client = TestClient(app)
HEADERS = {"X-BidLab-Client": "local-ui", "Idempotency-Key": "e2e-demo-1"}


@pytest.fixture()
def fresh_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("BIDLAB_STORAGE_DIR", str(tmp_path))
    get_settings.cache_clear()
    get_engine.cache_clear()

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
