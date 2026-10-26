"""Contract Error envelope {code, message, request_id, details} + handlers."""

import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from bidlab.domain.anomaly import AnomalyError
from bidlab.domain.expressions import ExprError
from bidlab.domain.groups import GroupsError
from bidlab.domain.money import MoneyError
from bidlab.domain.scoring import ScoringError

DOMAIN_ERRORS = (MoneyError, ScoringError, ExprError, AnomalyError, GroupsError)


def new_request_id() -> str:
    return uuid.uuid4().hex


def _request_id(request: Request) -> str:
    stored: Any = getattr(request.state, "request_id", None)
    return str(stored) if stored else new_request_id()


def envelope(
    code: str, message: str, request_id: str, details: list[str] | None = None
) -> dict[str, object]:
    return {
        "code": code[:80],
        "message": message[:2000],
        "request_id": request_id[:80],
        "details": (details or [])[:30],
    }


class ApiError(HTTPException):
    """HTTP failure with a contract code + details (handled as Error envelope)."""

    def __init__(
        self, status_code: int, code: str, message: str, details: list[str] | None = None
    ) -> None:
        super().__init__(status_code=status_code, detail=message)
        self.code = code
        self.message = message
        self.details = details or []


def _from_api_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ApiError)
    return JSONResponse(
        status_code=exc.status_code,
        content=envelope(exc.code, exc.message, _request_id(request), exc.details),
    )


def _from_http(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, HTTPException)
    codes = {
        400: "bad_request",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        413: "upload_too_large",
        415: "unsupported_media",
        429: "rate_limited",
        502: "provider_failure",
        503: "provider_not_configured",
    }
    code = codes.get(exc.status_code, f"http_{exc.status_code}")
    message = exc.detail if isinstance(exc.detail, str) else code
    return JSONResponse(
        status_code=exc.status_code, content=envelope(code, message, _request_id(request))
    )


def _from_validation(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    errors = exc.errors()
    details = [f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in errors]
    forbidden = any(e["type"] == "extra_forbidden" for e in errors)
    code = "extra_forbidden" if forbidden else "validation_error"
    return JSONResponse(
        status_code=422,
        content=envelope(code, "request validation failed", _request_id(request), details),
    )


def _from_domain(request: Request, exc: Exception) -> JSONResponse:
    code = getattr(exc, "code", "domain_validation")
    return JSONResponse(
        status_code=422, content=envelope(str(code), str(exc), _request_id(request))
    )


def register_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, _from_api_error)
    app.add_exception_handler(HTTPException, _from_http)
    app.add_exception_handler(RequestValidationError, _from_validation)
    for cls in DOMAIN_ERRORS:
        app.add_exception_handler(cls, _from_domain)
