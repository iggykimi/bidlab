"""Library + workspace + demo-session routes."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from bidlab.api import deps
from bidlab.api.errors import ERROR_RESPONSES
from bidlab.db import models
from bidlab.schemas import generated as g
from bidlab.services import demo as demo_service
from bidlab.services import idempotency
from bidlab.services import intake as intake_service
from bidlab.services import placsp_import as placsp
from bidlab.services import workspace as workspace_service
from bidlab.settings import get_settings

router = APIRouter(responses=ERROR_RESPONSES, tags=["tenders"])

CREATE_ROUTE = "POST /api/v1/tenders"
IMPORT_ROUTE = "POST /api/v1/tenders/import"
DEMO_ROUTE = "POST /api/v1/demo/sessions"


@router.get("/tenders", response_model=g.TenderList, operation_id="list_tenders")
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
        codes = data["cpv_codes"] if isinstance(data["cpv_codes"], list) else []
        haystack = f"{data['title']} {data['external_id']} {' '.join(str(c) for c in codes)}"
        if q and q.lower() not in haystack.lower():
            continue
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


@router.post("/tenders", response_model=g.Tender, status_code=201, operation_id="create_tender")
async def create_tender(
    payload: g.TenderCreate,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
    idempotency_key: str = Header(max_length=100),
) -> g.Tender:
    body = await request.body()
    stored = idempotency.check(db, CREATE_ROUTE, idempotency_key, body)
    if stored is not None:
        response.status_code = 200
        return g.Tender.model_validate(stored)
    created: dict[str, Any] = dict(intake_service.create_tender(db, payload))
    winner = idempotency.store(db, CREATE_ROUTE, idempotency_key, body, created)
    if winner is not None:
        response.status_code = 200
        return g.Tender.model_validate(winner)
    return g.Tender.model_validate(created)


@router.post(
    "/tenders/import", response_model=g.TenderImport, status_code=201, operation_id="import_tender"
)
async def import_tender(
    payload: g.TenderImportRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
    client: Annotated[placsp.PlacspClient, Depends(placsp.get_client)],
    idempotency_key: str = Header(max_length=100),
) -> g.TenderImport:
    """Import one PLACSP tender; see ``bidlab.services.placsp_import``."""
    body = await request.body()
    stored = idempotency.check(db, IMPORT_ROUTE, idempotency_key, body)
    if stored is not None:
        response.status_code = 200
        return g.TenderImport.model_validate(stored)
    ref = placsp.parse_reference(payload.url_or_id)
    existing = placsp.find_existing(db, ref)
    writes: list[placsp.PendingWrite] = []
    if existing is None:
        # Network work runs off the event loop and before any write.
        fetched = await run_in_threadpool(placsp.fetch_tender, ref, client)
        try:
            tender_id, writes = placsp.persist_import(db, fetched)
        except IntegrityError:
            # A concurrent import of the same tender won the unique key.
            db.rollback()
            existing = placsp.find_existing(db, ref)
            if existing is None:
                raise
            writes = []
    if existing is not None:
        result = placsp.import_payload(db, existing.id, already_imported=True)
        response.status_code = 200
    else:
        result = placsp.import_payload(db, tender_id, already_imported=False)
    winner = idempotency.store(db, IMPORT_ROUTE, idempotency_key, body, result)
    if winner is not None:
        response.status_code = 200
        return g.TenderImport.model_validate(winner)
    placsp.write_pending(writes)
    return g.TenderImport.model_validate(result)


@router.get("/tenders/{tender_id}", response_model=g.Tender, operation_id="get_tender")
def get_tender(tender_id: str, db: Annotated[Session, Depends(deps.get_db)]) -> g.Tender:
    return g.Tender.model_validate(workspace_service.tender_to_dict(db, tender_id))


@router.get(
    "/tenders/{tender_id}/workspace", response_model=g.Workspace, operation_id="get_workspace"
)
def get_workspace(tender_id: str, db: Annotated[Session, Depends(deps.get_db)]) -> g.Workspace:
    mode = get_settings().bidlab_mode
    return g.Workspace.model_validate(workspace_service.get_workspace(db, tender_id, mode))


@router.post(
    "/demo/sessions",
    response_model=g.DemoSession,
    status_code=201,
    operation_id="create_demo_session",
)
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
