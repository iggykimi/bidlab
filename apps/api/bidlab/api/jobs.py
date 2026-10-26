"""Analysis-job routes: start extraction (202 + Location) + poll job state."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Request, Response
from sqlalchemy.orm import Session

from bidlab.api import deps
from bidlab.schemas import generated as g
from bidlab.services import idempotency
from bidlab.services import jobs as jobs_service

router = APIRouter()


@router.post("/tenders/{tender_id}/analysis", response_model=g.Job, status_code=202)
async def start_analysis(
    payload: g.AnalysisRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
    tender_id: str,
    idempotency_key: str = Header(max_length=100),
) -> dict[str, Any]:
    body = await request.body()
    route = jobs_service.route_for(tender_id)
    stored = idempotency.check(db, route, idempotency_key, body)
    if stored is not None:
        response.status_code = 202
        response.headers["Location"] = f"/api/v1/jobs/{stored['id']}"
        return stored
    job = jobs_service.start_analysis(db, tender_id, payload)
    created = jobs_service.job_to_dict(job)
    idempotency.store(db, route, idempotency_key, body, created)
    response.headers["Location"] = f"/api/v1/jobs/{job.id}"
    return created


@router.get("/jobs/{job_id}", response_model=g.Job)
def get_job(
    job_id: str, db: Annotated[Session, Depends(deps.get_db)]
) -> dict[str, Any]:
    return jobs_service.job_to_dict(jobs_service.get_job_or_404(db, job_id))
