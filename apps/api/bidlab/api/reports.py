"""Report routes: decision record + printable HTML."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Query, Request, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from bidlab.api import deps
from bidlab.api.errors import ERROR_RESPONSES
from bidlab.schemas import generated as g
from bidlab.services import idempotency
from bidlab.services import reports as reports_service

router = APIRouter(responses=ERROR_RESPONSES, tags=["reports"])

CREATE_ROUTE = "POST /api/v1/reports"


@router.post("/reports", response_model=g.Report, status_code=201, operation_id="create_report")
async def create_report(
    payload: g.ReportCreate,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
    idempotency_key: str = Header(max_length=100),
) -> g.Report:
    body = await request.body()
    stored = idempotency.check(db, CREATE_ROUTE, idempotency_key, body)
    if stored is not None:
        response.status_code = 200
        return g.Report.model_validate(stored)
    created: dict[str, Any] = dict(
        reports_service.create_report(
            db, payload.scenario_id.root, str(payload.decision), payload.note
        )
    )
    winner = idempotency.store(db, CREATE_ROUTE, idempotency_key, body, created)
    if winner is not None:
        response.status_code = 200
        return g.Report.model_validate(winner)
    return g.Report.model_validate(created)


@router.get("/reports/{report_id}", response_model=g.Report, operation_id="get_report")
def get_report(report_id: str, db: Annotated[Session, Depends(deps.get_db)]) -> g.Report:
    return g.Report.model_validate(reports_service.get_report(db, report_id))


@router.get(
    "/tenders/{tender_id}/reports",
    response_model=g.ReportList,
    operation_id="list_tender_reports",
)
def list_tender_reports(
    tender_id: str,
    db: Annotated[Session, Depends(deps.get_db)],
    scope_id: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> g.ReportList:
    return g.ReportList.model_validate(
        reports_service.list_by_tender(db, tender_id, scope_id, page, page_size)
    )


@router.get("/reports/{report_id}/html", operation_id="get_report_html")
def get_report_html(report_id: str, db: Annotated[Session, Depends(deps.get_db)]) -> Response:
    reports_service.get_report(db, report_id)  # 404 envelope when missing
    path = reports_service.html_path(report_id)
    # S4: the template is static markup + inline <style> only (no scripts,
    # images or external refs), so the policy can deny everything else.
    return FileResponse(
        path,
        media_type="text/html",
        headers={
            "Content-Security-Policy": (
                "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
            ),
            "X-Content-Type-Options": "nosniff",
        },
    )
