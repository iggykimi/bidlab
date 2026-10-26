"""Scenario evaluation routes (persistence lands in T26)."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from bidlab.api import deps
from bidlab.schemas import generated as g
from bidlab.services import evaluation as evaluation_service

router = APIRouter()


@router.post("/scenarios/evaluate", response_model=g.EvaluationResult)
def evaluate_scenario(
    payload: g.EvaluationRequest,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
) -> dict[str, Any]:
    # Pure computation (no persistence), so no Idempotency-Key: nothing to deduplicate.
    return evaluation_service.evaluate(db, payload)
