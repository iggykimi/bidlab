"""I01: migration + double seed on temp DB → same counts, clean FKs."""

import sqlite3
from pathlib import Path

from bidlab.db.session import get_engine
from bidlab.services import seed as seed_demo
from bidlab.settings import get_settings


def test_seed_twice_same_counts(tmp_path: Path, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setenv("BIDLAB_STORAGE_DIR", str(tmp_path))
    get_settings.cache_clear()
    get_engine.cache_clear()
    try:
        first = seed_demo.seed()
        second = seed_demo.seed()
    finally:
        get_settings.cache_clear()
        get_engine.cache_clear()
    assert first == second
    assert first["tender"] == 1
    assert first["scope"] == 1
    assert first["document"] == 1
    assert first["document_page"] == 6
    assert first["citation"] == 9
    assert first["interpretation_revision"] == 1
    assert first["rule_revision"] == 1
    assert first["company"] == 1
    assert first["company_revision"] == 1
    conn = sqlite3.connect(str(tmp_path / "bidlab.sqlite3"))
    try:
        violations = conn.execute("PRAGMA foreign_key_check").fetchall()
    finally:
        conn.close()
    assert violations == []
