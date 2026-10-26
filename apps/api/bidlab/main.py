"""BidLab API entrypoint. Loopback only; no multi-user auth (see ARCHITECTURE)."""

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from bidlab.api import (
    capabilities,
    companies,
    documents,
    health,
    jobs,
    reports,
    review,
    scenarios,
    tenders,
)
from bidlab.api.errors import new_request_id, register_handlers
from bidlab.services import seed as seed_service


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Fresh installs get tables on boot (no seed: demo stays explicit).
    seed_service.migrate()
    yield


app = FastAPI(title="BidLab", version="0.1.0", lifespan=_lifespan)

register_handlers(app)


@app.middleware("http")
async def _request_id(request: Request, call_next):  # type: ignore[no-untyped-def]
    request.state.request_id = new_request_id()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["127.0.0.1", "localhost", "::1", "testserver"],
)

# Same-origin in production; exact Vite dev origin otherwise. No wildcard.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-BidLab-Client", "Idempotency-Key"],
    allow_credentials=False,
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(capabilities.router, prefix="/api/v1")
app.include_router(tenders.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(scenarios.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(review.router, prefix="/api/v1")
app.include_router(companies.router, prefix="/api/v1")

# TODO(T19): serve apps/web/dist from / when built.
