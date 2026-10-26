"""Document page + content routes (uploads land in T14)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from bidlab.api import deps
from bidlab.api.errors import ERROR_RESPONSES, ApiError
from bidlab.db import models
from bidlab.schemas import generated as g
from bidlab.services import workspace as workspace_service

router = APIRouter(responses=ERROR_RESPONSES)


@router.get("/documents/{document_id}/pages/{page_number}", response_model=g.PageText)
def get_page(
    document_id: str,
    page_number: Annotated[int, Path(ge=1)],
    db: Annotated[Session, Depends(deps.get_db)],
) -> g.PageText:
    page = db.get(models.DocumentPage, (document_id, page_number))
    if page is None:
        raise ApiError(404, "page_not_found", f"unknown page {page_number} of {document_id}")
    return g.PageText.model_validate(workspace_service.page_to_dict(page))


@router.get("/documents/{document_id}/content")
def get_content(document_id: str, db: Annotated[Session, Depends(deps.get_db)]) -> Response:
    doc = db.get(models.Document, document_id)
    if doc is None:
        raise ApiError(404, "document_not_found", f"unknown document {document_id}")
    if not doc.blob_path:
        raise ApiError(
            404,
            "document_bytes_unavailable",
            "original bytes not redistributed; use source_url and curated excerpts",
        )
    return FileResponse(
        doc.blob_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{doc.id}.pdf"'},
    )
