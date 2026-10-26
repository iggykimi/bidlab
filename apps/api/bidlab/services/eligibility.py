"""Company-vs-requirements eligibility checks.

Pure three-valued evaluation of a tender requirements tree against one pinned
company revision: every leaf yields met / not_met / unknown with reason codes
and evidence refs (requirement citation ids plus matched company references).
Unknown is preserved wherever rule review, evidence, units, period, or values
are insufficient; a pass is never invented. Overall verdict folds the tree
with the domain AND/OR logic. Deterministic: same revisions, same result.
"""

from datetime import date
from decimal import Decimal
from typing import Any

from pydantic import ValidationError
from sqlalchemy.orm import Session

from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.domain import eligibility as EL
from bidlab.domain.money import MoneyError, parse_decimal
from bidlab.schemas import generated as g
from bidlab.services import companies as companies_service

MAX_ITEMS = 100
MAX_REFS = 20

THREE_YEAR_FIELDS = frozenset(
    {"annual_turnover_best_3y_net", "annual_similar_services_best_3y_net"}
)
MIN_THREE_YEAR_DAYS = 3 * 365

_MET_REASONS = {
    "gte": "value_meets_threshold",
    "lte": "value_meets_threshold",
    "eq": "value_meets_threshold",
    "contains": "text_found",
}
_NOT_MET_REASONS = {
    "gte": "value_below_threshold",
    "lte": "value_above_threshold",
    "eq": "value_differs",
    "contains": "text_not_found",
}


def _span_days(evidence: dict[str, Any]) -> int | None:
    try:
        start = date.fromisoformat(str(evidence["period_from"]))
        end = date.fromisoformat(str(evidence["period_to"]))
    except (KeyError, TypeError, ValueError):
        return None
    return (end - start).days


def _decimal(raw: Any) -> Decimal | None:
    """Strict decimal parse; non-finite/exponent/locale text is unparseable."""
    if not isinstance(raw, str):
        return None
    try:
        return parse_decimal(raw, field="decimal")
    except MoneyError:
        return None


def _leaf_ref(leaf: dict[str, Any]) -> str:
    raw = leaf.get("id", "leaf")
    return str(raw) if isinstance(raw, str) else "leaf"


def _citation_ids(leaf: dict[str, Any]) -> list[str]:
    raw = leaf.get("evidence_ids", [])
    if not isinstance(raw, list):
        return []
    return [str(e) for e in raw if isinstance(e, str)][:MAX_REFS]


def _company_ref(evidence: dict[str, Any], field: str) -> str:
    ref = evidence.get("reference")
    if isinstance(ref, str) and ref:
        return ref[:1000]
    return field


def _compare(operator: str, value: Decimal, threshold: Decimal) -> bool:
    if operator == "gte":
        return value >= threshold
    if operator == "lte":
        return value <= threshold
    return value == threshold  # eq


def _evaluate_leaf(
    leaf: dict[str, Any], company_evidence: list[dict[str, Any]]
) -> tuple[EL.Leaf, dict[str, Any]]:
    leaf_id = _leaf_ref(leaf)
    citations = _citation_ids(leaf)

    def item(verdict: EL.Verdict, reasons: list[str], refs: list[str]) -> dict[str, Any]:
        return {
            "requirement_id": leaf_id,
            "verdict": verdict.value,
            "reason_codes": reasons,
            "evidence_refs": refs[:MAX_REFS],
        }

    if leaf.get("review_status") != "approved":
        unknown = EL.Leaf(EL.Verdict.UNKNOWN)
        return unknown, item(EL.Verdict.UNKNOWN, ["rule_not_approved"], citations)
    field = leaf.get("company_field")
    operator = leaf.get("operator")
    if field == "manual" or operator == "manual":
        return (
            EL.Leaf(EL.Verdict.UNKNOWN),
            item(EL.Verdict.UNKNOWN, ["manual_review_required"], citations),
        )
    if not isinstance(field, str) or operator not in _MET_REASONS:
        raise ApiError(500, "requirements_tree_corrupt", f"leaf {leaf_id}: bad field/operator")
    threshold_raw = leaf.get("threshold")

    candidates = [e for e in company_evidence if e.get("field_key") == field]
    if not candidates:
        return (
            EL.Leaf(EL.Verdict.UNKNOWN),
            item(EL.Verdict.UNKNOWN, ["missing_company_evidence"], citations),
        )
    reviewed = [e for e in candidates if e.get("reviewed") is True]
    if not reviewed:
        return (
            EL.Leaf(EL.Verdict.UNKNOWN),
            item(EL.Verdict.UNKNOWN, ["evidence_not_reviewed"], citations),
        )
    leaf_unit = leaf.get("unit")
    usable = [e for e in reviewed if leaf_unit is None or e.get("unit") == leaf_unit]
    if not usable:
        return EL.Leaf(EL.Verdict.UNKNOWN), item(EL.Verdict.UNKNOWN, ["unit_mismatch"], citations)
    if field in THREE_YEAR_FIELDS:
        # Dated entries must span 3y; undated ones rest on the reviewed flag
        # (the strict transport schema only admits null periods over JSON).
        dated_ok = [e for e in usable if (_span_days(e) or 0) >= MIN_THREE_YEAR_DAYS]
        undated = [e for e in usable if _span_days(e) is None]
        usable = dated_ok + undated
        if not usable:
            return (
                EL.Leaf(EL.Verdict.UNKNOWN),
                item(EL.Verdict.UNKNOWN, ["insufficient_period"], citations),
            )
    if threshold_raw is None:
        return (
            EL.Leaf(EL.Verdict.UNKNOWN),
            item(EL.Verdict.UNKNOWN, ["missing_threshold"], citations),
        )

    if operator == "contains":
        needle = threshold_raw if isinstance(threshold_raw, str) else None
        if not needle:
            return (
                EL.Leaf(EL.Verdict.UNKNOWN),
                item(EL.Verdict.UNKNOWN, ["missing_threshold"], citations),
            )
        hits = [e for e in usable if needle in str(e.get("value", ""))]
        refs = citations + sorted({_company_ref(e, field) for e in usable})
        if hits:
            return EL.Leaf(EL.Verdict.MET), item(EL.Verdict.MET, ["text_found"], refs)
        return EL.Leaf(EL.Verdict.NOT_MET), item(EL.Verdict.NOT_MET, ["text_not_found"], refs)

    threshold = _decimal(threshold_raw)
    if threshold is None:
        return (
            EL.Leaf(EL.Verdict.UNKNOWN),
            item(EL.Verdict.UNKNOWN, ["threshold_unparseable"], citations),
        )
    parsed: list[tuple[dict[str, Any], Decimal]] = []
    for entry in usable:
        value = _decimal(entry.get("value"))
        if value is not None:
            parsed.append((entry, value))
    if not parsed:
        return (
            EL.Leaf(EL.Verdict.UNKNOWN),
            item(EL.Verdict.UNKNOWN, ["value_unparseable"], citations),
        )
    matches = [(e, v) for e, v in parsed if _compare(operator, v, threshold)]
    if matches:
        refs = citations + sorted({_company_ref(e, field) for e, _ in matches})
        return (
            EL.Leaf(EL.Verdict.MET),
            item(EL.Verdict.MET, [_MET_REASONS[operator]], refs),
        )
    refs = citations + sorted({_company_ref(e, field) for e, _ in parsed})
    return (
        EL.Leaf(EL.Verdict.NOT_MET),
        item(EL.Verdict.NOT_MET, [_NOT_MET_REASONS[operator]], refs),
    )


def _build_tree(
    node: Any,
    company_evidence: list[dict[str, Any]],
    items: list[dict[str, Any]],
    depth: int = 0,
) -> EL.Node:
    if depth > EL.MAX_TREE_DEPTH:
        raise ApiError(
            422,
            "requirements_tree_too_deep",
            f"requirements tree exceeds depth {EL.MAX_TREE_DEPTH}",
        )
    if not isinstance(node, dict):
        raise ApiError(500, "requirements_tree_corrupt", "requirements node is not an object")
    kind = node.get("kind")
    if kind == "leaf":
        leaf, item = _evaluate_leaf(node, company_evidence)
        items.append(item)
        return leaf
    if kind == "group":
        children = node.get("children")
        operator = node.get("operator")
        if not isinstance(children, list) or operator not in ("AND", "OR"):
            raise ApiError(500, "requirements_tree_corrupt", "requirements group malformed")
        built = tuple(_build_tree(child, company_evidence, items, depth + 1) for child in children)
        if operator == "AND":
            return EL.And(children=built)
        return EL.Or(children=built)
    raise ApiError(500, "requirements_tree_corrupt", f"unknown requirements kind {kind!r}")


def check(session: Session, req: g.EligibilityRequest) -> dict[str, Any]:
    data = req.model_dump(mode="json")
    tender_id = str(data["tender_id"])
    scope_id = str(data["scope_id"])
    if session.get(models.Tender, tender_id) is None:
        raise ApiError(404, "tender_not_found", f"unknown tender {tender_id}")
    scope = session.get(models.Scope, scope_id)
    if scope is None:
        raise ApiError(404, "scope_not_found", f"unknown scope {scope_id}")
    if scope.tender_id != tender_id:
        raise ApiError(422, "scope_tender_mismatch", f"scope {scope_id} is not in {tender_id}")
    company = companies_service.get_revision(
        session, str(data["company_id"]), int(data["company_revision"])
    )
    if company.scope_id != scope_id:
        raise ApiError(422, "company_scope_mismatch", f"company is scoped to {company.scope_id}")
    interp = session.get(
        models.InterpretationRevision, (tender_id, int(data["interpretation_revision"]))
    )
    if interp is None:
        raise ApiError(
            404,
            "interpretation_not_found",
            f"unknown interpretation {tender_id}:{data['interpretation_revision']}",
        )
    profile = company.profile_json if isinstance(company.profile_json, dict) else {}
    hypothetical = bool(profile.get("synthetic", False))
    raw_evidence = profile.get("evidence", [])
    company_evidence = (
        [e for e in raw_evidence if isinstance(e, dict)] if isinstance(raw_evidence, list) else []
    )
    reviewed = interp.reviewed_json if isinstance(interp.reviewed_json, dict) else {}
    tree = reviewed.get("requirements_tree")
    if not isinstance(tree, dict):
        payload: dict[str, Any] = {
            "verdict": EL.Verdict.UNKNOWN.value,
            "items": [],
            "assessed_count": 0,
            "unassessed_count": 0,
            "hypothetical_company": hypothetical,
        }
        return payload
    items: list[dict[str, Any]] = []
    verdict = EL.evaluate(_build_tree(tree, company_evidence, items))
    assessed = sum(1 for i in items if i["verdict"] in ("met", "not_met"))
    payload = {
        "verdict": verdict.value,
        "items": items[:MAX_ITEMS],
        "assessed_count": assessed,
        "unassessed_count": len(items) - assessed,
        "hypothetical_company": hypothetical,
    }
    try:
        g.EligibilityResult.model_validate(payload)
    except ValidationError as exc:
        raise ApiError(500, "eligibility_unserializable", "eligibility result invalid") from exc
    return payload
