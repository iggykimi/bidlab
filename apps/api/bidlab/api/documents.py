"""Document upload + page + content routes."""

import hashlib
from pathlib import Path as Fspath
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, File, Form, Header, Path, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from bidlab.api import deps
from bidlab.api.errors import ERROR_RESPONSES, ApiError
from bidlab.db import models
from bidlab.schemas import generated as g
from bidlab.services import idempotency
from bidlab.services import intake as intake_service
from bidlab.services import pdf as pdf_service
from bidlab.services import workspace as workspace_service
from bidlab.settings import get_settings

router = APIRouter(responses=ERROR_RESPONSES, tags=["documents"])

_BYTES_UNAVAILABLE = "original bytes not redistributed; use source_url and curated excerpts"


def _jailed_blob_path(blob_path: str) -> Fspath:
    """Resolve a stored blob path strictly inside the storage dir (S3 jail).

    Absolute paths, `..` escapes and missing files all answer the same 404:
    callers cannot distinguish "no bytes" from "escaped path".
    """
    root = get_settings().storage_path.resolve()
    candidate = (root / blob_path).resolve()
    if not candidate.is_relative_to(root) or not candidate.is_file():
        raise ApiError(404, "document_bytes_unavailable", _BYTES_UNAVAILABLE)
    return candidate


@router.post(
    "/tenders/{tender_id}/documents",
    response_model=g.Document,
    status_code=201,
    operation_id="upload_tender_document",
)
async def upload_tender_document(
    response: Response,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
    tender_id: str,
    file: Annotated[UploadFile, File()],
    kind: Annotated[Literal["pcap", "ppt", "other"] | None, Form()] = None,
    idempotency_key: str = Header(max_length=100),
) -> g.Document:
    # Real byte cap (same backend PDF limit); the +1 byte detects overflow.
    raw = await file.read(pdf_service.MAX_PDF_BYTES + 1)
    await file.close()
    if len(raw) > pdf_service.MAX_PDF_BYTES:
        raise pdf_service.PdfError(
            "pdf_too_large",
            f"upload is {len(raw)}+ bytes; limit is {pdf_service.MAX_PDF_BYTES}",
        )
    route = intake_service.documents_route_for(tender_id)
    # Canonical idempotency body: multipart boundaries vary per retry, so the
    # file hash plus kind identifies the intent, not the raw request bytes.
    canonical = f"{hashlib.sha256(raw).hexdigest()}\n{kind or 'other'}".encode()
    stored = idempotency.check(db, route, idempotency_key, canonical)
    if stored is not None:
        response.status_code = 200
        return g.Document.model_validate(stored)
    staged: dict[str, Any]
    staged, blob_abs = intake_service.stage_document_upload(db, tender_id, raw, file.filename, kind)
    winner = idempotency.store(db, route, idempotency_key, canonical, dict(staged))
    if winner is not None:
        response.status_code = 200
        return g.Document.model_validate(winner)
    blob_abs.parent.mkdir(parents=True, exist_ok=True)
    try:
        blob_abs.write_bytes(raw)
    except OSError:
        blob_abs.unlink(missing_ok=True)
        raise
    intake_service.render_staged_upload(
        get_settings().storage_path.resolve(),
        tender_id,
        str(staged["id"]),
        raw,
        str(staged["sha256"]),
    )
    return g.Document.model_validate(staged)


@router.get(
    "/documents/{document_id}/pages/{page_number}",
    response_model=g.PageText,
    operation_id="get_page",
)
def get_page(
    document_id: str,
    page_number: Annotated[int, Path(ge=1)],
    db: Annotated[Session, Depends(deps.get_db)],
) -> g.PageText:
    page = db.get(models.DocumentPage, (document_id, page_number))
    if page is None:
        raise ApiError(404, "page_not_found", f"unknown page {page_number} of {document_id}")
    return g.PageText.model_validate(workspace_service.page_to_dict(page))


@router.get("/documents/{document_id}/content", operation_id="get_document_content")
def get_content(document_id: str, db: Annotated[Session, Depends(deps.get_db)]) -> Response:
    doc = db.get(models.Document, document_id)
    if doc is None:
        raise ApiError(404, "document_not_found", f"unknown document {document_id}")
    if not doc.blob_path:
        raise ApiError(404, "document_bytes_unavailable", _BYTES_UNAVAILABLE)
    return FileResponse(
        _jailed_blob_path(doc.blob_path),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{doc.id}.pdf"'},
    )
