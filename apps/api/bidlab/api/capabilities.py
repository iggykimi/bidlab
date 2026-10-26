"""Effective capabilities. Reports configuration, never the API key."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from bidlab.schemas import generated as g
from bidlab.settings import Settings, get_settings

router = APIRouter()

PDF_MAX_BYTES = 20 * 1024 * 1024
PDF_MAX_PAGES = 120
CURVE_MAX_POINTS = 201


@router.get("/capabilities", response_model=g.Capabilities)
def get_capabilities(
    settings: Annotated[Settings, Depends(get_settings)],
) -> g.Capabilities:
    limitations: list[str] = []
    if settings.bidlab_mode == "demo":
        limitations.append("curated_demo: figures come from the reviewed seed, not live extraction")
    if not settings.live_ready:
        limitations.append("meta_live_unavailable: needs mode=live and a configured model API key")
    if not settings.bidlab_history_enabled:
        limitations.append("history_disabled")
    payload: dict[str, Any] = {
        "mode": settings.bidlab_mode,
        "meta_configured": settings.live_ready,
        "meta_model": settings.meta_model,
        "history_enabled": settings.bidlab_history_enabled,
        "limits": {
            "pdf_bytes": PDF_MAX_BYTES,
            "pdf_pages": PDF_MAX_PAGES,
            "curve_points": CURVE_MAX_POINTS,
        },
        "limitations": limitations,
    }
    return g.Capabilities.model_validate(payload)
