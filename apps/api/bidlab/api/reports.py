"""Report routes: decision record + printable HTML."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Request, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from bidlab.api import deps
from bidlab.schemas import generated as g
from bidlab.services import idempotency
from bidlab.services import reports as reports_service

router = APIRouter()

CREATE_ROUTE = "POST /api/v1/reports"


@router.post("/reports", response_model=g.Report, status_code=201)
async def create_report(
    payload: g.ReportCreate,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
    idempotency_key: str = Header(max_length=100),
) -> dict[str, Any]:
    body = await request.body()
    stored = idempotency.check(db, CREATE_ROUTE, idempotency_key, body)
    if stored is not None:
        response.status_code = 200
        return stored
    created: dict[str, Any] = dict(
        reports_service.create_report(db, payload.scenario_id, str(payload.decision), payload.note)
    )
    winner = idempotency.store(db, CREATE_ROUTE, idempotency_key, body, created)
    if winner is not None:
        response.status_code = 200
        return winner
    return created


@router.get("/reports/{report_id}", response_model=g.Report)
def get_report(
    report_id: str, db: Annotated[Session, Depends(deps.get_db)]
) -> dict[str, Any]:
    return reports_service.get_report(db, report_id)


@router.get("/reports/{report_id}/html")
def get_report_html(
    report_id: str, db: Annotated[Session, Depends(deps.get_db)]
) -> Response:
    reports_service.get_report(db, report_id)  # 404 envelope when missing
    path = reports_service.html_path(report_id)
    return FileResponse(path, media_type="text/html")
