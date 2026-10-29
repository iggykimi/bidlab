"""Reports: decision record over an immutable scenario + printable HTML."""

import datetime as dt
import re
import uuid
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
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


_MESES_ES = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
]

_DECISION_ES = {
    "study": "Seguir estudiándola",
    "prepare": "Preparar oferta",
    "discard": "Descartarla",
}

_ANOMALIA_ES = {
    "possible_justification_required": "Posible necesidad de justificación",
    "not_flagged_under_assumptions": "No, en este supuesto",
    "not_applicable": "No aplicable",
    "unknown": "Sin determinar",
}


def _decimal_or_none(value: object) -> Decimal | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = Decimal(value.strip())
    except InvalidOperation:
        return None
    return parsed if parsed.is_finite() else None


def fecha_es(value: object) -> str:
    """ISO instant -> "26 de octubre de 2026, 00:00 (UTC)". Invalid echoes back."""
    if not isinstance(value, str):
        return "sin determinar"
    text = value.strip().replace("Z", "+00:00")
    try:
        moment = dt.datetime.fromisoformat(text)
    except ValueError:
        return value
    if moment.tzinfo is not None:
        moment = moment.astimezone(dt.UTC)
        suffix = " (UTC)"
    else:
        suffix = ""
    return (
        f"{moment.day} de {_MESES_ES[moment.month - 1]} de {moment.year}, "
        f"{moment.hour:02d}:{moment.minute:02d}{suffix}"
    )


def _agrupar_miles(enteros: str) -> str:
    negatif = enteros.startswith("-")
    digitos = enteros[1:] if negatif else enteros
    grupos = []
    while len(digitos) > 3:
        grupos.append(digitos[-3:])
        digitos = digitos[:-3]
    grupos.append(digitos)
    return ("-" if negatif else "") + ".".join(reversed(grupos))


def euros_es(value: object) -> str:
    """Protocol money -> "100.585,60 €", exact. None/invalid -> "sin determinar"."""
    parsed = _decimal_or_none(value)
    if parsed is None:
        return "sin determinar"
    exact = parsed.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    entero, _, decimal = format(exact, "f").partition(".")
    return f"{_agrupar_miles(entero)},{decimal} €"


def puntos_es(value: object, max_points: object) -> str:
    """Score -> "49,0 de 49" (1 decimal display). None/invalid -> "sin determinar"."""
    parsed = _decimal_or_none(value)
    if parsed is None:
        return "sin determinar"
    shown = parsed.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    texto = format(shown, "f").replace(".", ",")
    maximo = _decimal_or_none(max_points)
    if maximo is None:
        return texto
    enteros = int(maximo.to_integral_value(rounding=ROUND_HALF_UP))
    return f"{texto} de {enteros}"


def margen_es(value: object) -> str:
    """Sales-margin rate -> "10,5 %" (1 decimal display). None/invalid -> "sin determinar"."""
    parsed = _decimal_or_none(value)
    if parsed is None:
        return "sin determinar"
    pct = (parsed * 100).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    return f"{format(pct, 'f').replace('.', ',')} %"


def decision_es(value: object) -> str:
    return _DECISION_ES.get(str(value), "Sin determinar")


def anomalia_es(value: object) -> str:
    return _ANOMALIA_ES.get(str(value), str(value))


def render_html(report: dict[str, Any], mode: str, doc_names: dict[str, str] | None = None) -> str:
    template = _jinja_env().get_template("report.html.jinja")
    return template.render(
        report=report,
        mode=mode,
        generated_at=_now(),
        doc_names=doc_names or {},
        fecha_es=fecha_es,
        euros_es=euros_es,
        puntos_es=puntos_es,
        margen_es=margen_es,
        decision_es=decision_es,
        anomalia_es=anomalia_es,
    )


def _document_names(session: Session, scenario: dict[str, Any]) -> dict[str, str]:
    """Document id -> display name for the report Fuentes block (ids stay fallback)."""
    context = scenario.get("context", {})
    tender_id = context.get("tender_id") if isinstance(context, dict) else None
    if not isinstance(tender_id, str) or not tender_id:
        return {}
    rows = session.execute(
        select(models.Document).where(models.Document.tender_id == tender_id)
    ).scalars()
    return {row.id: row.display_name for row in rows}


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
    names = _document_names(session, scenario)
    html_abs.write_text(
        render_html(payload, settings.bidlab_mode, doc_names=names), encoding="utf-8"
    )
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
