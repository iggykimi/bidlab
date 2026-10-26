"""Idempotency-Key store (24h). Same key+body replays; other body is 409."""

import datetime as dt
import hashlib
import json
from typing import Any

from sqlalchemy.orm import Session

from bidlab.api.errors import ApiError
from bidlab.db import models


def _now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def body_hash(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()


def check(session: Session, route: str, key: str, body: bytes) -> dict[str, Any] | None:
    """Return the stored response, None when absent/expired; 409 on body mismatch."""
    record = session.get(models.IdempotencyRecord, (route, key))
    if record is None:
        return None
    if dt.datetime.fromisoformat(record.expires_at) < _now():
        session.delete(record)
        session.flush()
        return None
    if record.body_sha256 != body_hash(body):
        raise ApiError(409, "idempotency_conflict", "Idempotency-Key reused with a different body")
    stored = record.response_json
    if isinstance(stored, str):
        stored = json.loads(stored)
    return stored if isinstance(stored, dict) else {"value": stored}


def store(session: Session, route: str, key: str, body: bytes, response: dict[str, Any]) -> None:
    session.add(
        models.IdempotencyRecord(
            route=route,
            idempotency_key=key,
            body_sha256=body_hash(body),
            response_json=response,
            expires_at=(_now() + dt.timedelta(hours=24)).isoformat(),
        )
    )
    session.flush()
