"""Company profiles + eligibility routes (contract: create/get/update, check)."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from bidlab.api import deps
from bidlab.schemas import generated as g
from bidlab.services import companies as companies_service
from bidlab.services import eligibility as eligibility_service

router = APIRouter()


@router.post("/companies", response_model=g.Company, status_code=201)
def create_company(
    payload: g.CompanyWrite,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
) -> dict[str, Any]:
    return companies_service.create_company(db, payload)


@router.get("/companies/{company_id}", response_model=g.Company)
def get_company(
    company_id: str, db: Annotated[Session, Depends(deps.get_db)]
) -> dict[str, Any]:
    return companies_service.get_company(db, company_id)


@router.put("/companies/{company_id}", response_model=g.Company)
def update_company(
    company_id: str,
    payload: g.CompanyUpdate,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
) -> dict[str, Any]:
    return companies_service.update_company(db, company_id, payload)


@router.post("/eligibility/check", response_model=g.EligibilityResult)
def check_eligibility(
    payload: g.EligibilityRequest,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
) -> dict[str, Any]:
    # Pure computation over pinned revisions (no persistence), so no Idempotency-Key.
    return eligibility_service.check(db, payload)
