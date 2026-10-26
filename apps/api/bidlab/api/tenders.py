"""Library + workspace + demo-session routes."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from bidlab.api import deps
from bidlab.api.errors import ERROR_RESPONSES
from bidlab.db import models
from bidlab.schemas import generated as g
from bidlab.services import demo as demo_service
from bidlab.services import idempotency
from bidlab.services import workspace as workspace_service
from bidlab.settings import get_settings

router = APIRouter(responses=ERROR_RESPONSES)

DEMO_ROUTE = "POST /api/v1/demo/sessions"


@router.get("/tenders", response_model=g.TenderList)
def list_tenders(
    db: Annotated[Session, Depends(deps.get_db)],
    q: str | None = Query(default=None, max_length=200),
    cpv: str | None = Query(default=None, max_length=12),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> g.TenderList:
    rows = db.scalars(select(models.Tender).order_by(models.Tender.id)).all()
    items: list[dict[str, Any]] = []
    for tender in rows:
        data = workspace_service.tender_to_dict(db, tender.id)
        if q and q.lower() not in f"{data['title']} {data['external_id']}".lower():
            continue
        codes = data["cpv_codes"] if isinstance(data["cpv_codes"], list) else []
        if cpv and cpv not in codes:
            continue
        items.append(data)
    start = (page - 1) * page_size
    return g.TenderList.model_validate(
        {
            "items": items[start : start + page_size],
            "page": page,
            "page_size": page_size,
            "total": len(items),
        }
    )


@router.get("/tenders/{tender_id}", response_model=g.Tender)
def get_tender(tender_id: str, db: Annotated[Session, Depends(deps.get_db)]) -> g.Tender:
    return g.Tender.model_validate(workspace_service.tender_to_dict(db, tender_id))


@router.get("/tenders/{tender_id}/workspace", response_model=g.Workspace)
def get_workspace(tender_id: str, db: Annotated[Session, Depends(deps.get_db)]) -> g.Workspace:
    mode = get_settings().bidlab_mode
    return g.Workspace.model_validate(workspace_service.get_workspace(db, tender_id, mode))


@router.post("/demo/sessions", response_model=g.DemoSession, status_code=201)
async def create_demo_session(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
    idempotency_key: str = Header(max_length=100),
) -> g.DemoSession:
    body = await request.body()
    # Seed first: on an empty DB the idempotency table itself does not exist yet.
    payload: dict[str, Any] = dict(demo_service.ensure_demo(db))
    stored = idempotency.check(db, DEMO_ROUTE, idempotency_key, body)
    if stored is not None:
        response.status_code = 200
        return g.DemoSession.model_validate(stored)
    winner = idempotency.store(db, DEMO_ROUTE, idempotency_key, body, payload)
    if winner is not None:
        response.status_code = 200
        return g.DemoSession.model_validate(winner)
    return g.DemoSession.model_validate(payload)
