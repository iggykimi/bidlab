"""Reports: decision record over an immutable scenario + printable HTML."""

import datetime as dt
import re
import uuid
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import select
from sqlalchemy.orm import Session

from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.services import scenarios as scenarios_service
from bidlab.settings import get_settings

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"

# create_report() ids are uuid4().hex; anything else never matches a file and
# must not reach the filesystem (path traversal shape).
_REPORT_ID_RE = re.compile(r"[0-9a-f]{32}")

_jinja: Environment | None = None


def _jinja_env() -> Environment:
    global _jinja
    if _jinja is None:
        _jinja = Environment(
            loader=FileSystemLoader(str(TEMPLATES_DIR)),
            autoescape=select_autoescape(["html", "jinja"]),
        )
    return _jinja


def _now() -> str:
    return dt.datetime.now(dt.UTC).isoformat()


def render_html(report: dict[str, Any], mode: str) -> str:
    template = _jinja_env().get_template("report.html.jinja")
    return template.render(report=report, mode=mode, generated_at=_now())


def create_report(session: Session, scenario_id: str, decision: str, note: str) -> dict[str, Any]:
    scenario = scenarios_service.get_scenario(session, scenario_id)
    context = scenario.get("context", {})
    pending = context.get("pending_items", []) if isinstance(context, dict) else []
    report_id = uuid.uuid4().hex
    html_rel = f"reports/{report_id}.html"
    payload: dict[str, Any] = {
        "id": report_id,
        "scenario": scenario,
        "decision": decision,
        "note": note,
        "pending_items": pending,
        "html_path": html_rel,
        "created_at": _now(),
    }
    settings = get_settings()
    html_abs = settings.storage_path / html_rel
    html_abs.parent.mkdir(parents=True, exist_ok=True)
    html_abs.write_text(render_html(payload, settings.bidlab_mode), encoding="utf-8")
    session.add(
        models.Report(
            id=report_id,
            scenario_id=scenario_id,
            report_json=payload,
            created_at=payload["created_at"],
        )
    )
    session.flush()
    return payload


def get_report(session: Session, report_id: str) -> dict[str, Any]:
    row = session.get(models.Report, report_id)
    if row is None:
        raise ApiError(404, "report_not_found", f"unknown report {report_id}")
    if not isinstance(row.report_json, dict):
        raise ApiError(500, "report_corrupt", f"report {report_id}: invalid payload")
    return row.report_json


def list_by_tender(
    session: Session, tender_id: str, scope_id: str | None, page: int, page_size: int
) -> dict[str, Any]:
    """Paginated light report items for one tender in stable (created_at, id) order."""
    scope_ids = scenarios_service.resolve_tender_scopes(session, tender_id, scope_id)
    rows = (
        session.scalars(
            select(models.Report)
            .join(models.Scenario, models.Report.scenario_id == models.Scenario.id)
            .where(models.Scenario.scope_id.in_(scope_ids))
            .order_by(models.Report.created_at, models.Report.id)
        ).all()
        if scope_ids
        else []
    )
    scenario_rows = (
        session.scalars(
            select(models.Scenario).where(models.Scenario.id.in_([row.scenario_id for row in rows]))
        ).all()
        if rows
        else []
    )
    by_id = {row.id: row for row in scenario_rows}
    start = (page - 1) * page_size
    items: list[dict[str, Any]] = []
    for row in rows[start : start + page_size]:
        payload = row.report_json if isinstance(row.report_json, dict) else {}
        scenario = by_id.get(row.scenario_id)
        if scenario is None:
            raise ApiError(500, "report_corrupt", f"report {row.id}: scenario missing")
        core = scenario.snapshot_json if isinstance(scenario.snapshot_json, dict) else {}
        items.append(
            {
                "id": row.id,
                "scenario_id": row.scenario_id,
                "scenario_name": core.get("name"),
                "scope_id": scenario.scope_id,
                "decision": payload.get("decision"),
                "created_at": row.created_at,
            }
        )
    return {"items": items, "page": page, "page_size": page_size, "total": len(rows)}


def html_path(report_id: str) -> Path:
    if _REPORT_ID_RE.fullmatch(report_id) is None:
        raise ApiError(404, "report_not_found", f"unknown report {report_id}")
    settings = get_settings()
    row_path = settings.storage_path / f"reports/{report_id}.html"
    if not row_path.exists():
        raise ApiError(404, "report_html_missing", f"report {report_id}: html not found")
    return row_path
