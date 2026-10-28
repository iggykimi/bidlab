"""Scenario persistence: evaluate-once snapshots with integrity hash."""

import datetime as dt
import hashlib
import json
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.domain.eligibility import MAX_TREE_DEPTH as MAX_TREE_DEPTH
from bidlab.schemas import generated as g
from bidlab.services import evaluation as evaluation_service
from bidlab.services import workspace as workspace_service


def _now() -> str:
    return dt.datetime.now(dt.UTC).isoformat()


def snapshot_hash(core: dict[str, Any]) -> str:
    canonical = json.dumps(core, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _latest_rule_revision(session: Session, rule_id: str) -> int | None:
    return session.scalar(
        select(func.max(models.RuleRevision.revision)).where(models.RuleRevision.rule_id == rule_id)
    )


def _latest_company_revision(session: Session, company_id: str) -> int | None:
    return session.scalar(
        select(func.max(models.CompanyRevision.revision)).where(
            models.CompanyRevision.company_id == company_id
        )
    )


def _manual_leaves(tree: Any, out: list[str], depth: int = 0) -> None:
    if depth > MAX_TREE_DEPTH:
        raise ApiError(
            422,
            "requirements_tree_too_deep",
            f"requirements tree exceeds depth {MAX_TREE_DEPTH}",
        )
    if not isinstance(tree, dict):
        return
    if tree.get("kind") == "leaf":
        if tree.get("company_field") == "manual" or tree.get("operator") == "manual":
            label = tree.get("label", tree.get("id", "leaf"))
            out.append(f"Pendiente de revisión manual: {label}")
        return
    children = tree.get("children", [])
    if isinstance(children, list):
        for child in children:
            _manual_leaves(child, out, depth + 1)


def _pending_items(
    session: Session,
    scope: models.Scope,
    input_data: dict[str, Any],
    result: dict[str, Any],
) -> list[str]:
    pending: list[str] = []
    score = result.get("score", {})
    if isinstance(score, dict):
        if score.get("status") == "unknown":
            reasons = ",".join(score.get("reason_codes", []))
            pending.append(f"Puntuación sin determinar ({reasons}): no usar para decidir")
        elif score.get("status") == "unsupported":
            pending.append("Puntuación no soportada: plantilla fuera del rango autorizado")
    anomaly = result.get("anomaly", {})
    if isinstance(anomaly, dict):
        if anomaly.get("status") == "unknown":
            reasons = ",".join(anomaly.get("reason_codes", []))
            pending.append(f"Anormalidad sin determinar ({reasons}): conjunto insuficiente")
        elif anomaly.get("status") == "possible_justification_required":
            pending.append("Posible anormalidad: preparar justificación de costes")
    rivals = input_data.get("rivals", {})
    if isinstance(rivals, dict):
        if not rivals.get("complete", True):
            pending.append("Conjunto rival incompleto: hipótesis parcial")
        if not rivals.get("group_membership_confirmed", True):
            pending.append("Pertenencia a grupos sin confirmar")
    interp = session.scalars(
        select(models.InterpretationRevision)
        .where(models.InterpretationRevision.tender_id == scope.tender_id)
        .order_by(models.InterpretationRevision.revision.desc())
    ).first()
    if interp is not None and isinstance(interp.reviewed_json, dict):
        _manual_leaves(interp.reviewed_json.get("requirements_tree"), pending)
    docs = session.scalars(
        select(models.Document).where(models.Document.tender_id == scope.tender_id)
    ).all()
    if any(not doc.blob_path for doc in docs):
        pending.append("PDF original no redistribuido: verificado solo por extractos")
    return [item[:1000] for item in pending[:100]]


def _citations_for(session: Session, evidence_ids: list[str]) -> list[dict[str, Any]]:
    if not evidence_ids:
        return []
    rows = session.scalars(
        select(models.Citation)
        .where(models.Citation.id.in_(evidence_ids))
        .order_by(models.Citation.document_id, models.Citation.page_number, models.Citation.id)
    ).all()
    by_id = {cit.id: workspace_service.citation_to_dict(cit) for cit in rows}
    return [by_id[cid] for cid in evidence_ids if cid in by_id][:100]


def save_scenario(session: Session, name: str, req: g.EvaluationRequest) -> dict[str, Any]:
    input_data = req.model_dump(mode="json")
    rule_id = str(input_data["pricing_rule_id"])
    rule_rev = int(input_data["pricing_rule_revision"])
    company_id = str(input_data["company_id"])
    company_rev = int(input_data["company_revision"])
    latest_rule = _latest_rule_revision(session, rule_id)
    latest_company = _latest_company_revision(session, company_id)
    if latest_rule is not None and rule_rev < latest_rule:
        raise ApiError(
            409, "stale_revision", f"rule {rule_id}:{rule_rev} is not latest ({latest_rule})"
        )
    if latest_company is not None and company_rev < latest_company:
        raise ApiError(
            409,
            "stale_revision",
            f"company {company_id}:{company_rev} is not latest ({latest_company})",
        )
    result = evaluation_service.evaluate(session, req)
    scope = session.get(models.Scope, str(input_data["scope_id"]))
    rule_row = session.get(models.RuleRevision, (rule_id, rule_rev))
    company_row = session.get(models.CompanyRevision, (company_id, company_rev))
    if scope is None or rule_row is None or company_row is None:
        raise ApiError(500, "scenario_snapshot_incomplete", "referenced rows vanished mid-save")
    rule = rule_row.rule_json if isinstance(rule_row.rule_json, dict) else {}
    basis = scope.basis_json if isinstance(scope.basis_json, dict) else {}
    profile = company_row.profile_json if isinstance(company_row.profile_json, dict) else {}
    evidence: list[str] = []
    for key in ("evidence_ids",):
        items = basis.get(key, [])
        if isinstance(items, list):
            evidence.extend(str(e) for e in items)
        items = rule.get(key, [])
        if isinstance(items, list):
            evidence.extend(str(e) for e in items)
    anomaly_policy = rule.get("anomaly_policy")
    if isinstance(anomaly_policy, dict):
        items = anomaly_policy.get("evidence_ids", [])
        if isinstance(items, list):
            evidence.extend(str(e) for e in items)
    ordered: list[str] = []
    seen: set[str] = set()
    for e in evidence:
        if e not in seen:
            seen.add(e)
            ordered.append(e)
    rest = session.scalars(
        select(models.Citation.id)
        .where(
            models.Citation.document_id.in_(
                select(models.Document.id).where(models.Document.tender_id == scope.tender_id)
            )
        )
        .order_by(models.Citation.document_id, models.Citation.page_number, models.Citation.id)
    ).all()
    for cid in rest:
        if cid not in seen:
            seen.add(cid)
            ordered.append(cid)
    ordered = ordered[:100]
    if profile.get("synthetic"):
        pending_seed = ["Coste de empresa sintética: sustituir por el coste real"]
    else:
        pending_seed = []
    context = {
        "basis": basis,
        "rule": rule,
        "company": profile,
        "citations": _citations_for(session, ordered),
        "tender_title": "",
        "source_url": "",
        "source_updated_at": "",
        "pending_items": [],
    }
    tender = session.get(models.Tender, scope.tender_id)
    if tender is not None:
        context["tender_title"] = tender.title
        context["source_url"] = tender.source_url
        context["source_updated_at"] = tender.source_updated_at
    context["pending_items"] = pending_seed + _pending_items(session, scope, input_data, result)
    core = {"name": name, "input": input_data, "result": result, "context": context}
    digest = snapshot_hash(core)
    row = models.Scenario(
        id=uuid.uuid4().hex,
        scope_id=scope.id,
        rule_id=rule_id,
        rule_revision=rule_rev,
        company_id=company_id,
        company_revision=company_rev,
        snapshot_json=core,
        snapshot_sha256=digest,
        created_at=_now(),
    )
    session.add(row)
    session.flush()
    return scenario_to_dict(row)


def scenario_to_dict(row: models.Scenario) -> dict[str, Any]:
    core = row.snapshot_json if isinstance(row.snapshot_json, dict) else {}
    if snapshot_hash(core) != row.snapshot_sha256:
        raise ApiError(500, "snapshot_corrupt", f"scenario {row.id}: hash mismatch")
    return {
        "context": core.get("context"),
        "id": row.id,
        "name": core.get("name"),
        "input": core.get("input"),
        "result": core.get("result"),
        "snapshot_sha256": row.snapshot_sha256,
        "created_at": row.created_at,
    }


def get_scenario(session: Session, scenario_id: str) -> dict[str, Any]:
    row = session.get(models.Scenario, scenario_id)
    if row is None:
        raise ApiError(404, "scenario_not_found", f"unknown scenario {scenario_id}")
    return scenario_to_dict(row)


def resolve_tender_scopes(session: Session, tender_id: str, scope_id: str | None) -> list[str]:
    """Scope ids visible under a tender, optionally narrowed to one scope."""
    if session.get(models.Tender, tender_id) is None:
        raise ApiError(404, "tender_not_found", f"unknown tender {tender_id}")
    if scope_id is not None:
        scope = session.get(models.Scope, scope_id)
        if scope is None:
            raise ApiError(404, "scope_not_found", f"unknown scope {scope_id}")
        if scope.tender_id != tender_id:
            raise ApiError(422, "scope_tender_mismatch", f"scope {scope_id} is not in {tender_id}")
        return [scope_id]
    return list(
        session.scalars(
            select(models.Scope.id)
            .where(models.Scope.tender_id == tender_id)
            .order_by(models.Scope.id)
        ).all()
    )


def scenario_summary(row: models.Scenario) -> dict[str, Any]:
    """Light collection item: headline figures without the full snapshot."""
    full = scenario_to_dict(row)  # validates the snapshot hash
    result = full.get("result", {})
    result = result if isinstance(result, dict) else {}
    score = result.get("score", {})
    score = score if isinstance(score, dict) else {}
    anomaly = result.get("anomaly", {})
    anomaly = anomaly if isinstance(anomaly, dict) else {}
    profit = result.get("profit_net")
    score_value = score.get("value")
    return {
        "id": row.id,
        "name": full.get("name"),
        "scope_id": row.scope_id,
        "rule_id": row.rule_id,
        "rule_revision": row.rule_revision,
        "company_id": row.company_id,
        "company_revision": row.company_revision,
        "price_net": result.get("price_net"),
        "profit_net": profit,
        "score_value": score_value,
        "score_status": score.get("status"),
        "anomaly_status": anomaly.get("status"),
        "snapshot_sha256": row.snapshot_sha256,
        "created_at": row.created_at,
    }


def list_by_tender(
    session: Session, tender_id: str, scope_id: str | None, page: int, page_size: int
) -> dict[str, Any]:
    """Paginated light items for one tender in stable (created_at, id) order."""
    scope_ids = resolve_tender_scopes(session, tender_id, scope_id)
    rows = (
        session.scalars(
            select(models.Scenario)
            .where(models.Scenario.scope_id.in_(scope_ids))
            .order_by(models.Scenario.created_at, models.Scenario.id)
        ).all()
        if scope_ids
        else []
    )
    start = (page - 1) * page_size
    return {
        "items": [scenario_summary(row) for row in rows[start : start + page_size]],
        "page": page,
        "page_size": page_size,
        "total": len(rows),
    }
