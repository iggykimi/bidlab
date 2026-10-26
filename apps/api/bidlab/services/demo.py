"""Demo sessions: ensure the curated seed is present, return DemoSession payload."""

from sqlalchemy.orm import Session

from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.services import seed as seed_service

TENDER_ID = "tias"
SCOPE_ID = "tias-whole"
COMPANY_ID = "company-demo"


def ensure_demo(session: Session) -> dict[str, str]:
    seed_service.migrate()  # no-op when current; tables must exist before reads
    if session.get(models.Tender, TENDER_ID) is None:
        seed_service.seed()
        session.rollback()  # drop the pre-seed snapshot; the seeder commits itself
    tender = session.get(models.Tender, TENDER_ID)
    scope = session.get(models.Scope, SCOPE_ID)
    company = session.get(models.Company, COMPANY_ID)
    if tender is None or scope is None or company is None:
        raise ApiError(
            503,
            "demo_seed_incomplete",
            "demo seed missing; run python scripts/demo.py --reset-demo",
        )
    return {"tender_id": TENDER_ID, "scope_id": SCOPE_ID, "company_id": COMPANY_ID, "mode": "demo"}
