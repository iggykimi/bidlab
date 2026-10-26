"""Catch-all handler: internal envelope, server-side traceback, no leak."""

import json
import logging

from bidlab.api.errors import _from_unhandled
from starlette.requests import Request


def _request() -> Request:
    return Request({"type": "http", "method": "GET", "path": "/", "headers": []})


def _boom() -> None:
    raise RuntimeError("boom-secret-detail")


def test_unhandled_returns_internal_envelope_without_leak(caplog) -> None:  # type: ignore[no-untyped-def]
    with caplog.at_level(logging.ERROR, logger="bidlab.api.errors"):
        try:
            _boom()
        except RuntimeError as exc:
            response = _from_unhandled(_request(), exc)
    assert response.status_code == 500
    body = json.loads(response.body)
    assert body["code"] == "internal"
    assert body["message"] == "internal error"
    assert body["request_id"]
    assert body["details"] == []
    assert "boom-secret-detail" not in json.dumps(body)
    assert "Traceback" in caplog.text
