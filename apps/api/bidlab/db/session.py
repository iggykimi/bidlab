"""SQLite engine/session. WAL, foreign_keys=ON, busy_timeout=5000."""

import threading
from collections.abc import Iterator
from functools import lru_cache
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from bidlab.settings import get_settings


def _apply_pragmas(dbapi_conn: Any, _record: Any) -> None:
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA foreign_keys=ON")
    cur.execute("PRAGMA busy_timeout=5000")
    cur.execute("PRAGMA synchronous=NORMAL")
    cur.execute("PRAGMA cache_size=-64000")
    cur.execute("PRAGMA temp_store=MEMORY")
    cur.execute("PRAGMA journal_size_limit=33554432")
    cur.close()


class _EngineCache:
    """Single-flight engine registry.

    Plain lru_cache lets two threads racing on first use (worker boot vs
    first request) build two pools for the same file. The orphan pool then
    holds SQLite open with no cached handle to dispose, which blocks
    temp-dir removal on Windows. Tests reset via cache_clear().
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._engines: dict[str | None, Engine] = {}

    def __call__(self, db_path: str | None = None) -> Engine:
        with self._lock:
            engine = self._engines.get(db_path)
            if engine is None:
                settings = get_settings()
                path = Path(db_path) if db_path else settings.storage_path / "bidlab.sqlite3"
                path.parent.mkdir(parents=True, exist_ok=True)
                engine = create_engine(
                    f"sqlite:///{path}", connect_args={"check_same_thread": False}
                )
                event.listen(engine, "connect", _apply_pragmas)
                self._engines[db_path] = engine
            return engine

    def cache_clear(self) -> None:
        with self._lock:
            self._engines.clear()


get_engine = _EngineCache()


@lru_cache
def get_session_factory(db_path: str | None = None) -> sessionmaker[Session]:
    """Module-level cached factory. No attribute expiry on commit (read-your-writes)."""
    return sessionmaker(bind=get_engine(db_path), expire_on_commit=False)


def get_session(db_path: str | None = None) -> Iterator[Session]:
    session = get_session_factory(db_path)()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def quick_check(db_path: str | None = None) -> str:
    """Run PRAGMA quick_check; 'ok' when healthy, else the first corruption line."""
    with get_engine(db_path).connect() as conn:
        rows = conn.exec_driver_sql("PRAGMA quick_check").fetchall()
    if len(rows) == 1 and str(rows[0][0]).lower() == "ok":
        return "ok"
    if rows:
        return str(rows[0][0])[:200]
    return "empty quick_check result"
