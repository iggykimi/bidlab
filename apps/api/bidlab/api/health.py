"""Liveness probe. Never checks Meta balance nor makes billable calls."""

from fastapi import APIRouter

from bidlab import ENGINE_VERSION, SCHEMA_VERSION

router = APIRouter()


@router.get("/health")
def get_health() -> dict[str, str]:
    return {"status": "ok", "engine_version": ENGINE_VERSION, "schema_version": SCHEMA_VERSION}
