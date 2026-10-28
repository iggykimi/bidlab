"""Stress mesh: a declared grid of discounts x hypotheses over the
deterministic evaluator. No new arithmetic: price/score/anomaly come from
evaluation.evaluate(), profit from the engine's money.profit() with the
hypothesis cost. Unknown cells never enter the selection; anomaly never
excludes, it only warns."""

import datetime as dt
import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.domain import money as MO
from bidlab.schemas import generated as g
from bidlab.services import evaluation as evaluation_service
from bidlab.services.scenarios import snapshot_hash


def _now() -> str:
    return dt.datetime.now(dt.UTC).isoformat()


def _load_scope(session: Session, scope_id: str) -> models.Scope:
    scope = session.get(models.Scope, scope_id)
    if scope is None:
        raise ApiError(404, "scope_not_found", f"scope {scope_id}: not found")
    if scope.budget_net_cents is None:
        raise ApiError(422, "scope_without_budget", f"scope {scope_id}: no budget_net")
    basis = scope.basis_json if isinstance(scope.basis_json, dict) else {}
    if basis.get("review_status") != "approved":
        raise ApiError(422, "basis_not_approved", f"scope {scope_id}: basis not reviewed")
    return scope


def _load_rule(session: Session, rule_id: str, revision: int, scope_id: str) -> models.RuleRevision:
    row = session.get(models.RuleRevision, (rule_id, revision))
    if row is None or row.scope_id != scope_id:
        raise ApiError(404, "rule_not_found", f"rule {rule_id} r{revision}: not found")
    if row.review_status != "approved":
        raise ApiError(422, "rule_not_approved", f"rule {rule_id} r{revision}: not reviewed")
    return row


def _load_company(
    session: Session, company_id: str, revision: int, scope_id: str
) -> models.CompanyRevision:
    row = session.get(models.CompanyRevision, (company_id, revision))
    if row is None:
        raise ApiError(404, "company_not_found", f"company {company_id} r{revision}: not found")
    if row.scope_id != scope_id:
        raise ApiError(422, "company_scope_mismatch", f"company {company_id} is scoped elsewhere")
    return row


def _check_period(hypothesis_period: int, basis: dict[str, Any], scope_id: str) -> None:
    """Same P0-2 rule as evaluation: known vs known mismatch fails the cell."""
    scope_period = basis.get("period_months")
    if isinstance(scope_period, int) and hypothesis_period != scope_period:
        raise ApiError(
            422,
            "period_mismatch",
            f"hypothesis costs {hypothesis_period} months"
            f" but scope {scope_id} runs {scope_period} months",
        )


def _rivals_payload(h: g.StressHypothesisInput) -> dict[str, Any]:
    return {
        "state": "assumed",
        "complete": h.rival_set_complete,
        "group_membership_confirmed": h.independent_groups_assumed,
        "own_group_id": "own",
        "offers": [
            {"label": "Rival A", "price_net": h.rival_a_net.root, "group_id": "a"},
            {"label": "Rival B", "price_net": h.rival_b_net.root, "group_id": "b"},
        ],
    }


def run_stress(session: Session, scope_id: str, payload: g.StressTestRequest) -> dict[str, Any]:
    scope = _load_scope(session, scope_id)
    rule_row = _load_rule(
        session, payload.pricing_rule_id.root, payload.pricing_rule_revision, scope_id
    )
    company = _load_company(session, payload.company_id.root, payload.company_revision, scope_id)
    basis = scope.basis_json if isinstance(scope.basis_json, dict) else {}

    discounts: list[str] = []
    for index, raw in enumerate(payload.candidate_discounts):
        # Same shape as evaluation: parse, then scope-check with the field
        # position attached (validate_discount would lose the index).
        rate = MO.parse_decimal(raw.root, field="discount_rate")
        if rate < 0 or rate > evaluation_service.DISCOUNT_MAX:
            raise ApiError(
                422,
                "discount_out_of_scope",
                "candidate discount outside 0 to 0.40",
                details=[f"candidate_discounts[{index}]"],
            )
        text = format(rate, "f")
        if text not in discounts:
            discounts.append(text)

    min_points = MO.parse_decimal(
        payload.constraints.min_price_points.root, field="min_price_points"
    )
    min_profit = MO.parse_decimal(payload.constraints.min_profit_net.root, field="min_profit_net")
    bad_constraints = [
        name
        for name, value in (
            ("constraints.min_price_points", min_points),
            ("constraints.min_profit_net", min_profit),
        )
        if value <= 0
    ]
    if bad_constraints:
        raise ApiError(
            422,
            "stress_constraints_invalid",
            "constraints must be greater than zero",
            details=bad_constraints,
        )

    hyps: list[tuple[g.StressHypothesisInput, Decimal]] = []
    for index, h in enumerate(payload.hypotheses):
        cost = MO.parse_decimal(h.cost_net.root, field="cost_net")
        if cost <= 0:
            raise ApiError(
                422,
                "stress_cost_invalid",
                f"hypothesis {h.label!r}: cost must be > 0",
                details=[f"hypotheses[{index}].cost_net"],
            )
        hyps.append((h, cost))

    # One evaluator call per (discount, rivals) shape; profit varies by cost.
    evaluated: dict[str, dict[str, Any] | ApiError | ValueError] = {}

    def _shape_key(discount: str, h: g.StressHypothesisInput) -> str:
        parts = [
            discount,
            h.rival_a_net.root,
            h.rival_b_net.root,
            str(h.rival_set_complete),
            str(h.independent_groups_assumed),
        ]
        return "|".join(parts)

    def _evaluate_shape(
        discount: str, h: g.StressHypothesisInput
    ) -> dict[str, Any] | ApiError | ValueError:
        key = _shape_key(discount, h)
        if key not in evaluated:
            req = g.EvaluationRequest.model_validate(
                {
                    "scope_id": scope_id,
                    "pricing_rule_id": payload.pricing_rule_id.root,
                    "pricing_rule_revision": payload.pricing_rule_revision,
                    "company_id": payload.company_id.root,
                    "company_revision": payload.company_revision,
                    "discount_rate": discount,
                    "rivals": _rivals_payload(h),
                    "curve": None,
                }
            )
            try:
                evaluated[key] = evaluation_service.evaluate(session, req)
            except (ApiError, ValueError) as exc:
                evaluated[key] = exc
        return evaluated[key]

    cells: list[dict[str, Any]] = []
    anomaly_hits = 0
    non_comparable_labels: set[str] = set()
    for discount in discounts:
        for h, cost in hyps:
            cell: dict[str, Any] = {
                "discount_rate": discount,
                "hypothesis_label": h.label,
                "price_net": None,
                "score": None,
                "profit_net": None,
                "feasible": False,
                "reason": "no_comparable",
            }
            try:
                _check_period(h.period_months.root, basis, scope_id)
            except ApiError as exc:
                cell["reason"] = exc.code
                cells.append(cell)
                continue
            outcome = _evaluate_shape(discount, h)
            if isinstance(outcome, ApiError):
                cell["reason"] = outcome.code
                cells.append(cell)
                continue
            if isinstance(outcome, ValueError):
                cell["reason"] = "invalid_cell"
                cells.append(cell)
                continue
            price = MO.parse_decimal(outcome["price_net"], field="price_net")
            profit = MO.profit(price, cost)
            score_raw = outcome["score"]["value"]
            score = MO.parse_decimal(score_raw, field="score") if score_raw is not None else None
            cell["price_net"] = MO.serialize_money(price)
            cell["profit_net"] = MO.serialize_money(profit)
            cell["score"] = MO.serialize_12dp(score) if score is not None else None
            if outcome["anomaly"]["status"] == "possible_justification_required":
                anomaly_hits += 1
            if score is None:
                non_comparable_labels.add(h.label)
                cells.append(cell)
                continue
            if score >= min_points and profit >= min_profit:
                cell["feasible"] = True
                cell["reason"] = "meets_limits"
            else:
                cell["reason"] = "below_limits"
            cells.append(cell)

    by_discount: list[dict[str, Any]] = []
    for discount in discounts:
        group = [c for c in cells if c["discount_rate"] == discount]
        comparable = [c for c in group if c["score"] is not None and c["profit_net"] is not None]
        worst_score = min((Decimal(str(c["score"])) for c in comparable), default=None)
        worst_profit = min((Decimal(str(c["profit_net"])) for c in comparable), default=None)
        by_discount.append(
            {
                "discount_rate": discount,
                "worst_score": MO.serialize_12dp(worst_score) if worst_score is not None else None,
                "worst_profit_net": MO.serialize_money(worst_profit)
                if worst_profit is not None
                else None,
                "all_feasible": len(group) > 0 and all(c["feasible"] for c in group),
                "comparable_count": len(comparable),
            }
        )

    feasible_rows = [row for row in by_discount if row["all_feasible"]]
    selection: dict[str, Any] | None = None
    if feasible_rows:
        best = max(
            feasible_rows,
            key=lambda r: (
                Decimal(str(r["worst_profit_net"])),
                Decimal(str(r["worst_score"])),
                -Decimal(str(r["discount_rate"])),
            ),
        )
        selection = {
            "discount_rate": best["discount_rate"],
            "worst_profit_net": best["worst_profit_net"],
            "worst_score": best["worst_score"],
            "feasible_count": len(feasible_rows),
        }
        selection_reason = "maximize worst profit among feasible tested discounts"
    else:
        selection_reason = "no tested discount meets the limits under every hypothesis"

    warnings: list[str] = []
    for label in sorted(non_comparable_labels):
        warnings.append(
            f"hypothesis {label!r}: some cells are not comparable and never enter the selection"
        )
    if anomaly_hits:
        warnings.append(
            f"presumption flagged in {anomaly_hits} cells (informative only, never excludes)"
        )

    result: dict[str, Any] = {
        "id": uuid.uuid4().hex,
        "scope_id": scope_id,
        "interpretation_revision": rule_row.interpretation_revision,
        "basis_sha256": snapshot_hash(basis),
        "rule": {"id": rule_row.rule_id, "revision": rule_row.revision},
        "company": {"id": company.company_id, "base_revision": company.revision},
        "tested_candidates": len(discounts),
        "tested_hypotheses": len(hyps),
        "hypotheses_echo": [{"label": h.label} for h, _ in hyps],
        "cells": cells,
        "by_discount": by_discount,
        "selection": selection,
        "selection_reason": selection_reason,
        "warnings": warnings,
        "created_at": _now(),
    }
    row = models.StressTest(
        id=result["id"],
        scope_id=scope_id,
        rule_id=rule_row.rule_id,
        rule_revision=rule_row.revision,
        company_id=company.company_id,
        request_json=payload.model_dump(mode="json"),
        result_json=result,
        result_sha256=snapshot_hash(result),
        created_at=result["created_at"],
    )
    session.add(row)
    session.flush()
    return result


def get_stress(session: Session, stress_id: str) -> dict[str, Any]:
    row = session.get(models.StressTest, stress_id)
    if row is None:
        raise ApiError(404, "stress_not_found", f"stress test {stress_id}: not found")
    result = row.result_json if isinstance(row.result_json, dict) else {}
    if snapshot_hash(result) != row.result_sha256:
        raise ApiError(500, "snapshot_corrupt", f"stress test {stress_id}: hash mismatch")
    return result
