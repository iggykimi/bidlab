"""Catch-all handler: internal envelope, server-side traceback, no leak."""

import json
import logging

from bidlab.api.errors import _from_http, _from_pdf_error, _from_unhandled
from bidlab.schemas import generated as g
from bidlab.services.pdf import PdfError
from starlette.exceptions import HTTPException
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
    body = json.loads(bytes(response.body))
    assert body["code"] == "internal"
    assert body["message"] == "internal error"
    assert body["request_id"]
    assert body["details"] == []
    assert "boom-secret-detail" not in json.dumps(body)
    assert "Traceback" in caplog.text


def test_pdf_error_maps_size_to_413_and_content_to_422() -> None:
    """S3: PdfError carries an envelope code; only oversize input is 413."""
    oversize = _from_pdf_error(_request(), PdfError("pdf_too_large", "100 bytes over"))
    assert oversize.status_code == 413
    assert json.loads(bytes(oversize.body))["code"] == "pdf_too_large"
    for code in (
        "pdf_unreadable",
        "pdf_no_pages",
        "pdf_too_many_pages",
        "pdf_page_unreadable",
    ):
        res = _from_pdf_error(_request(), PdfError(code, "bad content"))
        assert res.status_code == 422, code
        body = json.loads(bytes(res.body))
        assert body["code"] == code
        g.Error.model_validate(body)  # every PdfError code is in the enum


def test_http_405_and_415_map_to_named_codes() -> None:
    res = _from_http(_request(), HTTPException(status_code=405))
    assert res.status_code == 405
    assert json.loads(bytes(res.body))["code"] == "method_not_allowed"
    g.Error.model_validate(json.loads(bytes(res.body)))
    res = _from_http(_request(), HTTPException(status_code=415))
    assert res.status_code == 415
    assert json.loads(bytes(res.body))["code"] == "unsupported_media"
    g.Error.model_validate(json.loads(bytes(res.body)))
