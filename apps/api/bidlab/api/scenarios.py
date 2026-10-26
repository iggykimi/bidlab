"""Scenario evaluation + persistence routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request, Response
from sqlalchemy.orm import Session

from bidlab.api import deps
from bidlab.api.errors import ERROR_RESPONSES
from bidlab.schemas import generated as g
from bidlab.services import evaluation as evaluation_service
from bidlab.services import idempotency
from bidlab.services import scenarios as scenarios_service

router = APIRouter(responses=ERROR_RESPONSES, tags=["scenarios"])

SAVE_ROUTE = "POST /api/v1/scenarios"


@router.post(
    "/scenarios/evaluate", response_model=g.EvaluationResult, operation_id="evaluate_scenario"
)
def evaluate_scenario(
    payload: g.EvaluationRequest,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
) -> g.EvaluationResult:
    # Pure computation (no persistence), so no Idempotency-Key: nothing to deduplicate.
    return g.EvaluationResult.model_validate(evaluation_service.evaluate(db, payload))


@router.post("/scenarios", response_model=g.Scenario, status_code=201, operation_id="save_scenario")
async def save_scenario(
    payload: g.ScenarioCreate,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
    idempotency_key: str = Header(max_length=100),
) -> g.Scenario:
    body = await request.body()
    stored = idempotency.check(db, SAVE_ROUTE, idempotency_key, body)
    if stored is not None:
        response.status_code = 200
        return g.Scenario.model_validate(stored)
    saved = scenarios_service.save_scenario(db, payload.name, payload.input)
    winner = idempotency.store(db, SAVE_ROUTE, idempotency_key, body, saved)
    if winner is not None:
        response.status_code = 200
        return g.Scenario.model_validate(winner)
    return g.Scenario.model_validate(saved)


@router.get("/scenarios/{scenario_id}", response_model=g.Scenario, operation_id="get_scenario")
def get_scenario(scenario_id: str, db: Annotated[Session, Depends(deps.get_db)]) -> g.Scenario:
    return g.Scenario.model_validate(scenarios_service.get_scenario(db, scenario_id))
