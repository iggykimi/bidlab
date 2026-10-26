"""Shared integration fixtures: temp-storage TestClient with seeded (or fresh) DB.

Every backend integration test runs against an isolated BIDLAB_STORAGE_DIR
with dependency-overridden sessions that commit like get_session().
"""

from collections.abc import Iterator
from pathlib import Path

import pytest
from bidlab.api import deps
from bidlab.db.session import get_engine
from bidlab.main import app
from bidlab.services import seed as seed_service
from bidlab.settings import get_settings
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

client = TestClient(app)


def _override_db() -> Iterator[Session]:
    session = Session(get_engine())
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@pytest.fixture()
def fresh_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """Unseeded client (empty DB); routes migrate/seed on demand."""
    monkeypatch.setenv("BIDLAB_STORAGE_DIR", str(tmp_path))
    get_settings.cache_clear()
    get_engine.cache_clear()
    app.dependency_overrides[deps.get_db] = _override_db
    try:
        yield client
    finally:
        app.dependency_overrides.clear()
        get_settings.cache_clear()
        get_engine.cache_clear()


@pytest.fixture()
def seeded_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """Client over a freshly curated Tías seed."""
    monkeypatch.setenv("BIDLAB_STORAGE_DIR", str(tmp_path))
    get_settings.cache_clear()
    get_engine.cache_clear()
    seed_service.seed()
    app.dependency_overrides[deps.get_db] = _override_db
    try:
        yield client
    finally:
        app.dependency_overrides.clear()
        get_settings.cache_clear()
        get_engine.cache_clear()
