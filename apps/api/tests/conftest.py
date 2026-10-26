"""Shared integration fixtures: temp-storage TestClient with seeded (or fresh) DB.

Every backend integration test runs against an isolated BIDLAB_STORAGE_DIR
with dependency-overridden sessions that commit like get_session().
"""

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from bidlab.api import deps
from bidlab.db.session import get_engine, get_session, get_session_factory
from bidlab.main import app
from bidlab.services import seed as seed_service
from bidlab.settings import get_settings
from fastapi.testclient import TestClient
from hypothesis import settings as hyp_settings
from sqlalchemy.orm import Session

# Slow properties have no meaningful per-example time bound on shared runners.
hyp_settings.register_profile("dev", deadline=None)
hyp_settings.register_profile("ci", deadline=None)
hyp_settings.load_profile(os.getenv("HYPOTHESIS_PROFILE", "dev"))


def _override_db() -> Iterator[Session]:
    yield from get_session()


def _reset_caches() -> None:
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


@pytest.fixture()
def fresh_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """Unseeded client (empty DB); routes migrate/seed on demand."""
    monkeypatch.setenv("BIDLAB_STORAGE_DIR", str(tmp_path))
    _reset_caches()
    app.dependency_overrides[deps.get_db] = _override_db
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        _reset_caches()


@pytest.fixture()
def seeded_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """Client over a freshly curated Tías seed."""
    monkeypatch.setenv("BIDLAB_STORAGE_DIR", str(tmp_path))
    _reset_caches()
    seed_service.seed()
    app.dependency_overrides[deps.get_db] = _override_db
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        _reset_caches()
