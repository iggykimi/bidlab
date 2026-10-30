"""Clarification-draft routes: draft one question (live) + list stored drafts."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Response
from sqlalchemy.orm import Session

from bidlab.api import deps
from bidlab.api.errors import ERROR_RESPONSES
from bidlab.schemas import generated as g
from bidlab.services import clarification as clarification_service
from bidlab.services import idempotency

router = APIRouter(responses=ERROR_RESPONSES, tags=["clarifications"])


@router.post(
    "/tenders/{tender_id}/clarifications",
    response_model=g.ClarificationDraft,
    status_code=201,
    operation_id="draft_clarification",
)
def draft_clarification(
    payload: g.ClarificationRequest,
    response: Response,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
    tender_id: str,
    idempotency_key: str = Header(max_length=100),
) -> g.ClarificationDraft:
    # Sync on purpose: the provider call blocks a threadpool worker, never
    # the event loop. The canonical payload stands in for the raw body.
    body = payload.model_dump_json().encode("utf-8")
    route = clarification_service.route_for(tender_id)
    stored = idempotency.check(db, route, idempotency_key, body)
    if stored is not None:
        response.status_code = 200
        return g.ClarificationDraft.model_validate(stored)
    created = clarification_service.draft(db, tender_id, payload)
    winner = idempotency.store(db, route, idempotency_key, body, created)
    if winner is not None:
        response.status_code = 200
        return g.ClarificationDraft.model_validate(winner)
    return g.ClarificationDraft.model_validate(created)


@router.get(
    "/tenders/{tender_id}/clarifications",
    response_model=g.ClarificationList,
    operation_id="list_clarifications",
)
def list_clarifications(
    tender_id: str, db: Annotated[Session, Depends(deps.get_db)]
) -> g.ClarificationList:
    return g.ClarificationList.model_validate(clarification_service.list_drafts(db, tender_id))
