"""Company profiles: versioned CRUD over Company + CompanyRevision.

Each update appends a new CompanyRevision; stored scenarios keep pointing at
the revision they snapshotted. Money travels as contract strings and persists
as integer cents; the full profile (incl. evidence) lives in profile_json.
"""

import datetime as dt
import uuid
from contextlib import suppress
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.schemas import generated as g

DEMO_COMPANY_ID = "company-demo"


def _now() -> str:
    return dt.datetime.now(dt.UTC).isoformat()


def _cents(money: str | None) -> int | None:
    if money is None:
        return None
    try:
        return int(Decimal(money) * 100)
    except InvalidOperation as exc:
        raise ApiError(422, "money_unparseable", f"money value invalid: {money}") from exc


def _money(cents: int | None) -> str | None:
    if cents is None:
        return None
    return f"{cents // 100}.{cents % 100:02d}"


def latest_revision(session: Session, company_id: str) -> int | None:
    return session.scalar(
        select(func.max(models.CompanyRevision.revision)).where(
            models.CompanyRevision.company_id == company_id
        )
    )


def get_revision(session: Session, company_id: str, revision: int) -> models.CompanyRevision:
    row = session.get(models.CompanyRevision, (company_id, revision))
    if row is None:
        raise ApiError(404, "company_not_found", f"unknown company {company_id}:{revision}")
    return row


def _require_scope(session: Session, scope_id: str) -> models.Scope:
    scope = session.get(models.Scope, scope_id)
    if scope is None:
        raise ApiError(404, "scope_not_found", f"unknown scope {scope_id}")
    return scope


def _normalize_evidence(evidence: Any) -> Any:
    """Restore date objects persisted as ISO strings (strict schema needs dates)."""
    if not isinstance(evidence, list):
        return evidence
    out: list[Any] = []
    for entry in evidence:
        if not isinstance(entry, dict):
            out.append(entry)
            continue
        fixed = dict(entry)
        for key in ("period_from", "period_to"):
            raw = fixed.get(key)
            if isinstance(raw, str):
                with suppress(ValueError):
                    fixed[key] = date.fromisoformat(raw)
        out.append(fixed)
    return out


def company_to_dict(company_id: str, row: models.CompanyRevision) -> dict[str, Any]:
    profile = row.profile_json if isinstance(row.profile_json, dict) else {}
    payload: dict[str, Any] = {
        "id": company_id,
        "revision": row.revision,
        "name": profile.get("name"),
        "synthetic": bool(profile.get("synthetic", False)),
        "scope_id": row.scope_id,
        "period_months": profile.get("period_months"),
        "direct_cost_net": _money(row.direct_cost_cents),
        "overhead_net": _money(row.overhead_cents),
        "target_margin_rate": profile.get("target_margin_rate"),
        "evidence": _normalize_evidence(profile.get("evidence", [])),
    }
    try:
        g.Company.model_validate(payload)
    except ValidationError as exc:
        raise ApiError(
            500, "company_profile_corrupt", f"company {company_id}:{row.revision} unreadable"
        ) from exc
    return payload


def create_company(session: Session, payload: g.CompanyWrite) -> dict[str, Any]:
    data = payload.model_dump(mode="json")
    _require_scope(session, str(data["scope_id"]))
    company_id = uuid.uuid4().hex
    created = _now()
    session.add(models.Company(id=company_id, created_at=created))
    session.flush()
    session.add(
        models.CompanyRevision(
            company_id=company_id,
            revision=1,
            scope_id=str(data["scope_id"]),
            direct_cost_cents=_cents(data["direct_cost_net"]),
            overhead_cents=_cents(data["overhead_net"]),
            profile_json={
                "id": company_id,
                "revision": 1,
                "name": data["name"],
                "synthetic": data["synthetic"],
                "scope_id": data["scope_id"],
                "period_months": data["period_months"],
                "direct_cost_net": data["direct_cost_net"],
                "overhead_net": data["overhead_net"],
                "target_margin_rate": data["target_margin_rate"],
                "evidence": data["evidence"],
            },
            created_at=created,
        )
    )
    session.flush()
    return company_to_dict(company_id, get_revision(session, company_id, 1))


def get_company(session: Session, company_id: str) -> dict[str, Any]:
    if session.get(models.Company, company_id) is None:
        raise ApiError(404, "company_not_found", f"unknown company {company_id}")
    latest = latest_revision(session, company_id)
    if latest is None:
        raise ApiError(500, "company_without_revision", f"company {company_id} has no revision")
    return company_to_dict(company_id, get_revision(session, company_id, latest))


def update_company(session: Session, company_id: str, payload: g.CompanyUpdate) -> dict[str, Any]:
    if session.get(models.Company, company_id) is None:
        raise ApiError(404, "company_not_found", f"unknown company {company_id}")
    data = payload.model_dump(mode="json")
    latest = latest_revision(session, company_id)
    if latest is None:
        raise ApiError(500, "company_without_revision", f"company {company_id} has no revision")
    expected = int(data["expected_revision"])
    if expected != latest:
        raise ApiError(
            409,
            "stale_revision",
            f"company {company_id}:{expected} is not latest ({latest})",
        )
    _require_scope(session, str(data["scope_id"]))
    revision = latest + 1
    session.add(
        models.CompanyRevision(
            company_id=company_id,
            revision=revision,
            scope_id=str(data["scope_id"]),
            direct_cost_cents=_cents(data["direct_cost_net"]),
            overhead_cents=_cents(data["overhead_net"]),
            profile_json={
                "id": company_id,
                "revision": revision,
                "name": data["name"],
                "synthetic": data["synthetic"],
                "scope_id": data["scope_id"],
                "period_months": data["period_months"],
                "direct_cost_net": data["direct_cost_net"],
                "overhead_net": data["overhead_net"],
                "target_margin_rate": data["target_margin_rate"],
                "evidence": data["evidence"],
            },
            created_at=_now(),
        )
    )
    session.flush()
    return company_to_dict(company_id, get_revision(session, company_id, revision))
