"""Interpretation-review route: approve/correct proposals (200 Workspace).

The contract does not require Idempotency-Key here, so it stays optional:
when the client sends one, replays are deduplicated like other mutations.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from bidlab.api import deps
from bidlab.api.errors import ERROR_RESPONSES
from bidlab.schemas import generated as g
from bidlab.services import idempotency
from bidlab.services import review as review_service

router = APIRouter(responses=ERROR_RESPONSES)


@router.post("/tenders/{tender_id}/reviews", response_model=g.Workspace)
async def review_interpretation(
    payload: g.ReviewRequest,
    request: Request,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
    tender_id: str,
    idempotency_key: str | None = Header(default=None, max_length=100),
) -> g.Workspace:
    body = await request.body()
    route = review_service.route_for(tender_id)
    if idempotency_key is not None:
        stored = idempotency.check(db, route, idempotency_key, body)
        if stored is not None:
            return g.Workspace.model_validate(stored)
    reviewed = review_service.apply_review(db, tender_id, payload)
    if idempotency_key is not None:
        winner = idempotency.store(db, route, idempotency_key, body, reviewed)
        if winner is not None:
            return g.Workspace.model_validate(winner)
    return g.Workspace.model_validate(reviewed)
