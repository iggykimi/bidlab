"""Idempotency-Key store (24h). Same key+body replays; other body is 409."""

import datetime as dt
import hashlib
import hmac
import json
from typing import Any

from sqlalchemy.exc import IntegrityError
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
    if not hmac.compare_digest(record.body_sha256, body_hash(body)):
        raise ApiError(409, "idempotency_conflict", "Idempotency-Key reused with a different body")
    return _stored_response(record)


def _stored_response(record: models.IdempotencyRecord) -> dict[str, Any]:
    stored = record.response_json
    if isinstance(stored, str):
        stored = json.loads(stored)
    return stored if isinstance(stored, dict) else {"value": stored}


def store(
    session: Session, route: str, key: str, body: bytes, response: dict[str, Any]
) -> dict[str, Any] | None:
    """Persist the response; on a lost insert race return the winner's response.

    Returns None when this call won (response stored). When a concurrent
    request stored the same key first, the loser's own work is rolled back
    here and the winner's stored response is returned instead; the caller
    must return it to the client. A stored key with a different body is 409.
    """
    session.add(
        models.IdempotencyRecord(
            route=route,
            idempotency_key=key,
            body_sha256=body_hash(body),
            response_json=response,
            expires_at=(_now() + dt.timedelta(hours=24)).isoformat(),
        )
    )
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        winner = session.get(models.IdempotencyRecord, (route, key))
        if winner is None:
            raise
        if not hmac.compare_digest(winner.body_sha256, body_hash(body)):
            raise ApiError(
                409,
                "idempotency_conflict",
                "Idempotency-Key reused with a different body",
            ) from None
        return _stored_response(winner)
    return None
