"""Stress mesh endpoints: run the declared grid, fetch its snapshot."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from bidlab.api import deps
from bidlab.api.errors import ERROR_RESPONSES
from bidlab.schemas import generated as g
from bidlab.services import stress

router = APIRouter(responses=ERROR_RESPONSES, tags=["stress"])


@router.post(
    "/scopes/{scope_id}/stress-tests",
    response_model=g.StressTestResult,
    operation_id="run_stress_test",
)
def run_stress(
    scope_id: str,
    payload: g.StressTestRequest,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
) -> g.StressTestResult:
    return g.StressTestResult.model_validate(stress.run_stress(db, scope_id, payload))


@router.get(
    "/stress-tests/{stress_id}",
    response_model=g.StressTestResult,
    operation_id="get_stress_test",
)
def get_stress(
    stress_id: str, db: Annotated[Session, Depends(deps.get_db)]
) -> g.StressTestResult:
    return g.StressTestResult.model_validate(stress.get_stress(db, stress_id))
