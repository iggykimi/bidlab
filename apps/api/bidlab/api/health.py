"""Liveness + readiness probes. Never checks Meta balance nor makes billable calls."""

from fastapi import APIRouter, Response

from bidlab import ENGINE_VERSION, SCHEMA_VERSION
from bidlab.db.session import quick_check
from bidlab.schemas import generated as g

router = APIRouter(tags=["health"])


@router.get("/health", response_model=g.Health, operation_id="health")
def get_health() -> g.Health:
    return g.Health(status="ok", engine_version=ENGINE_VERSION, schema_version=SCHEMA_VERSION)


@router.get("/ready", response_model=g.Ready, operation_id="readiness")
def get_readiness(response: Response) -> g.Ready:
    """Readiness: liveness plus a SQLite PRAGMA quick_check (503 when degraded)."""
    check = quick_check()
    if check != "ok":
        response.status_code = 503
    return g.Ready.model_validate(
        {"status": "ready" if check == "ok" else "degraded", "db_quick_check": check}
    )
