"""SQLite engine/session. WAL, foreign_keys=ON, busy_timeout=5000."""

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


@lru_cache
def get_engine(db_path: str | None = None) -> Engine:
    settings = get_settings()
    path = Path(db_path) if db_path else settings.storage_path / "bidlab.sqlite3"
    path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})
    event.listen(engine, "connect", _apply_pragmas)
    return engine


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
