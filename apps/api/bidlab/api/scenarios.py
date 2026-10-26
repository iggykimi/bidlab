"""Scenario evaluation + persistence routes."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Request, Response
from sqlalchemy.orm import Session

from bidlab.api import deps
from bidlab.schemas import generated as g
from bidlab.services import evaluation as evaluation_service
from bidlab.services import idempotency
from bidlab.services import scenarios as scenarios_service

router = APIRouter()

SAVE_ROUTE = "POST /api/v1/scenarios"


@router.post("/scenarios/evaluate", response_model=g.EvaluationResult)
def evaluate_scenario(
    payload: g.EvaluationRequest,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
) -> dict[str, Any]:
    # Pure computation (no persistence), so no Idempotency-Key: nothing to deduplicate.
    return evaluation_service.evaluate(db, payload)


@router.post("/scenarios", response_model=g.Scenario, status_code=201)
async def save_scenario(
    payload: g.ScenarioCreate,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
    idempotency_key: str = Header(max_length=100),
) -> dict[str, Any]:
    body = await request.body()
    stored = idempotency.check(db, SAVE_ROUTE, idempotency_key, body)
    if stored is not None:
        response.status_code = 200
        return stored
    saved = scenarios_service.save_scenario(db, payload.name, payload.input)
    winner = idempotency.store(db, SAVE_ROUTE, idempotency_key, body, saved)
    if winner is not None:
        response.status_code = 200
        return winner
    return saved


@router.get("/scenarios/{scenario_id}", response_model=g.Scenario)
def get_scenario(
    scenario_id: str, db: Annotated[Session, Depends(deps.get_db)]
) -> dict[str, Any]:
    return scenarios_service.get_scenario(db, scenario_id)
