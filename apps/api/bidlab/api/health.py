"""Liveness + readiness probes. Never checks Meta balance nor makes billable calls."""

from fastapi import APIRouter, Response

from bidlab import ENGINE_VERSION, SCHEMA_VERSION
from bidlab.db.session import quick_check
from bidlab.schemas import generated as g

router = APIRouter()


@router.get("/health", response_model=g.Health)
def get_health() -> g.Health:
    return g.Health(status="ok", engine_version=ENGINE_VERSION, schema_version=SCHEMA_VERSION)


@router.get("/ready")
def get_readiness(response: Response) -> dict[str, str]:
    """Readiness: liveness plus a SQLite PRAGMA quick_check (503 when degraded)."""
    check = quick_check()
    if check != "ok":
        response.status_code = 503
    return {"status": "ready" if check == "ok" else "degraded", "db_quick_check": check}
