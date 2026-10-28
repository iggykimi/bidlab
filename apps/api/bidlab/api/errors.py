"""Contract Error envelope {code, message, request_id, details} + handlers."""

import logging
import uuid
from typing import Any, cast

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from bidlab.domain.anomaly import AnomalyError
from bidlab.domain.expressions import ExprError
from bidlab.domain.groups import GroupsError
from bidlab.domain.money import MoneyError
from bidlab.domain.scoring import ScoringError
from bidlab.schemas import generated as g
from bidlab.services.pdf import PdfError

DOMAIN_ERRORS = (MoneyError, ScoringError, ExprError, AnomalyError, GroupsError)

logger = logging.getLogger(__name__)

# Shared OpenAPI error docs for data routers (docs only; handlers build envelopes).
ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    400: {"model": g.Error},
    403: {"model": g.Error},
    404: {"model": g.Error},
    409: {"model": g.Error},
    422: {"model": g.Error},
    503: {"model": g.Error},
}


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
    error = cast("ApiError", exc)
    return JSONResponse(
        status_code=error.status_code,
        content=envelope(error.code, error.message, _request_id(request), error.details),
    )


def _from_http(request: Request, exc: Exception) -> JSONResponse:
    error = cast("HTTPException", exc)
    codes = {
        400: "bad_request",
        403: "forbidden",
        404: "not_found",
        405: "method_not_allowed",
        409: "conflict",
        413: "upload_too_large",
        415: "unsupported_media",
        429: "rate_limited",
        502: "provider_failure",
        503: "provider_not_configured",
    }
    # Defensive fallback for unreachable statuses (Starlette only raises
    # 404/405 here); every reachable code above is in the ErrorCode enum.
    code = codes.get(error.status_code, f"http_{error.status_code}")
    message = error.detail if isinstance(error.detail, str) else code
    return JSONResponse(
        status_code=error.status_code, content=envelope(code, message, _request_id(request))
    )


def _from_validation(request: Request, exc: Exception) -> JSONResponse:
    error = cast("RequestValidationError", exc)
    errors = error.errors()
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


# S3: oversized input is 413; unreadable/over-limit content is 422. Media-type
# mismatches stay on the generic 415 path (_from_http, unsupported_media).
PDF_STATUS = {"pdf_too_large": 413}


def _from_pdf_error(request: Request, exc: Exception) -> JSONResponse:
    error = cast("PdfError", exc)
    status = PDF_STATUS.get(error.code, 422)
    return JSONResponse(
        status_code=status,
        content=envelope(error.code, error.message, _request_id(request)),
    )


def _from_unhandled(request: Request, _exc: Exception) -> JSONResponse:
    logger.exception("unhandled exception for %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content=envelope("internal", "internal error", _request_id(request)),
    )


def register_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, _from_api_error)
    app.add_exception_handler(HTTPException, _from_http)
    app.add_exception_handler(RequestValidationError, _from_validation)
    for cls in DOMAIN_ERRORS:
        app.add_exception_handler(cls, _from_domain)
    app.add_exception_handler(PdfError, _from_pdf_error)
    app.add_exception_handler(Exception, _from_unhandled)
