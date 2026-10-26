"""Effective capabilities. Reports configuration, never the API key."""

from typing import Annotated

from fastapi import APIRouter, Depends

from bidlab.settings import Settings, get_settings

router = APIRouter()

PDF_MAX_BYTES = 20 * 1024 * 1024
PDF_MAX_PAGES = 120
CURVE_MAX_POINTS = 201


@router.get("/capabilities")
def get_capabilities(
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, object]:
    limitations: list[str] = []
    if settings.bidlab_mode == "demo":
        limitations.append("curated_demo: figures come from the reviewed seed, not live extraction")
    if not settings.live_ready:
        limitations.append("meta_live_unavailable: needs mode=live and a configured model API key")
    if not settings.bidlab_history_enabled:
        limitations.append("history_disabled")
    return {
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
