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
    cur.close()


@lru_cache
def get_engine(db_path: str | None = None) -> Engine:
    settings = get_settings()
    path = Path(db_path) if db_path else settings.storage_path / "bidlab.sqlite3"
    path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(f"sqlite:///{path}")
    event.listen(engine, "connect", _apply_pragmas)
    return engine


def get_session(db_path: str | None = None) -> Iterator[Session]:
    factory = sessionmaker(bind=get_engine(db_path))
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
