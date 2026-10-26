"""Offer evaluation: price, profit, score, anomaly, trace, curve.

Backend for the Pricing Lab. Pure computation over approved scope/rule/company
revisions; nothing is persisted here (T26 owns scenario storage).
"""

from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from bidlab import ENGINE_VERSION
from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.domain import anomaly as AD
from bidlab.domain import expressions as EX
from bidlab.domain import groups as GR
from bidlab.domain import money as MO
from bidlab.domain import scoring as SC
from bidlab.schemas import generated as g
from bidlab.services import workspace as WS

DISCOUNT_MAX = Decimal("0.40")


def _load_scope(session: Session, scope_id: str) -> models.Scope:
    scope = session.get(models.Scope, scope_id)
    if scope is None:
        raise ApiError(404, "scope_not_found", f"unknown scope {scope_id}")
    basis = scope.basis_json if isinstance(scope.basis_json, dict) else {}
    if basis.get("review_status") != "approved":
        raise ApiError(422, "basis_not_approved", f"scope {scope_id}: basis not approved")
    if scope.budget_net_cents is None:
        raise ApiError(422, "scope_without_budget", f"scope {scope_id}: no budget_net")
    return scope


def _load_rule(session: Session, rule_id: str, revision: int) -> models.RuleRevision:
    rule = session.get(models.RuleRevision, (rule_id, revision))
    if rule is None:
        raise ApiError(404, "rule_not_found", f"unknown rule {rule_id}:{revision}")
    if rule.review_status != "approved":
        raise ApiError(422, "rule_not_approved", f"rule {rule_id}:{revision} not approved")
    return rule


def _load_company(session: Session, company_id: str, revision: int) -> models.CompanyRevision:
    company = session.get(models.CompanyRevision, (company_id, revision))
    if company is None:
        raise ApiError(404, "company_not_found", f"unknown company {company_id}:{revision}")
    return company


def _expression(rule: dict[str, Any]) -> EX.Expr:
    stored = rule.get("expression")
    template_id = rule.get("template_id")
    if not isinstance(stored, dict) or not isinstance(template_id, str):
        raise ApiError(422, "rule_malformed", "rule lacks expression/template_id")
    try:
        parsed = EX.parse_expr(stored)
    except EX.ExprError as exc:
        raise ApiError(422, exc.code, f"stored expression invalid: {exc}") from exc
    try:
        canonical = EX.template_for(template_id)
    except EX.ExprError as exc:
        raise ApiError(422, exc.code, f"unknown template {template_id}") from exc
    if parsed != canonical:
        raise ApiError(422, "ast_template_mismatch", "stored AST differs from its template")
    return parsed


def _money(cents: int | None) -> Decimal | None:
    if cents is None:
        return None
    return Decimal(cents) / 100


def _score_dict(scored: SC.ScoreResult) -> dict[str, Any]:
    return {
        "status": scored.status,
        "value": scored.value_serialized,
        "max_points": MO.serialize_exact(scored.max_points),
        "unknown_variables": list(scored.unknown_variables),
        "reason_codes": list(scored.reason_codes),
    }


def _anomaly_unknown(policy_id: str, reasons: list[str]) -> dict[str, Any]:
    return {
        "status": "unknown",
        "policy_id": policy_id,
        "branch": None,
        "reference_mean_net": None,
        "threshold_net": None,
        "reference_offer_count": 0,
        "reason_codes": reasons,
    }


def _anomaly_dict(verdict: AD.AnomalyResult) -> dict[str, Any]:
    return {
        "status": verdict.status,
        "policy_id": verdict.policy_id,
        "branch": verdict.branch,
        "reference_mean_net": verdict.reference_mean_serialized,
        "threshold_net": verdict.threshold_serialized,
        "reference_offer_count": verdict.reference_offer_count,
        "reason_codes": list(verdict.reason_codes),
    }


def _source_hashes(session: Session, tender_id: str) -> tuple[list[str], list[str]]:
    hashes: list[str] = []
    warnings: list[str] = []
    notice = session.scalars(
        select(models.NoticeVersion)
        .where(models.NoticeVersion.tender_id == tender_id, models.NoticeVersion.tombstone == 0)
        .order_by(models.NoticeVersion.updated_utc.desc())
    ).first()
    if notice is not None:
        hashes.append(notice.raw_sha256)
    docs = session.scalars(
        select(models.Document)
        .where(models.Document.tender_id == tender_id)
        .order_by(models.Document.id)
    ).all()
    for doc in docs:
        hashes.append(doc.sha256)
        _, doc_warnings = WS.document_to_dict(doc)
        warnings.extend(doc_warnings)
    return hashes[:20], warnings


def _rival_offers(data: dict[str, Any]) -> tuple[list[GR.Offer], list[str]]:
    offers: list[GR.Offer] = []
    prices: list[str] = []
    for raw in data["rivals"]["offers"]:
        try:
            offers.append(
                GR.make_offer(
                    raw["price_net"], raw.get("group_id"), label=str(raw.get("label", ""))
                )
            )
        except GR.GroupsError as exc:
            raise ApiError(422, exc.code, str(exc)) from exc
        prices.append(str(raw["price_net"]))
    return offers, prices


def evaluate(session: Session, req: g.EvaluationRequest) -> dict[str, Any]:
    data = req.model_dump(mode="json")
    scope = _load_scope(session, str(data["scope_id"]))
    rule_row = _load_rule(session, str(data["pricing_rule_id"]), int(data["pricing_rule_revision"]))
    company = _load_company(session, str(data["company_id"]), int(data["company_revision"]))
    rule = rule_row.rule_json if isinstance(rule_row.rule_json, dict) else {}
    basis = scope.basis_json if isinstance(scope.basis_json, dict) else {}
    budget = Decimal(scope.budget_net_cents or 0) / 100

    discount = MO.parse_decimal(data["discount_rate"], field="discount_rate")
    if discount < 0 or discount > DISCOUNT_MAX:
        raise ApiError(422, "discount_out_of_scope", "discount_rate: P0 scope is 0 to 0.40")
    price = MO.derive_price(budget, discount)

    expr = _expression(rule)
    max_points = str(rule.get("max_points", "0"))
    rivals = data["rivals"]
    rival_offers, rival_prices = _rival_offers(data)
    complete = bool(rivals["complete"])
    reference = basis.get("scoring_reference_net")
    reference_price = str(reference) if reference is not None else None

    scored = SC.evaluate_score(
        expr, max_points, price, rival_prices, reference_price=reference_price, complete=complete
    )

    policy = rule.get("anomaly_policy")
    policy = policy if isinstance(policy, dict) else {}
    policy_id = str(policy.get("id", "unknown"))
    variant = str(policy.get("variant", "unsupported"))
    assumptions: list[str] = []
    if str(rivals.get("state")) == "assumed":
        assumptions.append("Precios rivales hipotéticos")
    else:
        assumptions.append("Conjunto rival sin calificar")
    assumptions.append(
        "Conjunto completo supuesto" if complete else "Conjunto incompleto: puntuación unknown"
    )
    if bool(rivals.get("group_membership_confirmed")):
        assumptions.append("Grupos independientes supuestos")
    else:
        assumptions.append("Pertenencia a grupos sin confirmar: anormalidad unknown")

    # T22-verified production mapping: the reviewed flag decides the n=3
    # absolute-25 close, except RGLCAP85 which never applies it in P0.
    close_override = bool(policy.get("three_bidder_absolute_25", True))
    close_override = close_override and variant != "rglcap85_standard"
    anomaly: dict[str, Any]
    if variant == "unsupported":
        anomaly = _anomaly_dict(
            AD.evaluate_anomaly(variant, price, [], budget, policy_id=policy_id)
        )
    elif bool(policy.get("percentage_reduction_one_third")):
        anomaly = _anomaly_unknown(policy_id, ["percentage_reduction_unsupported"])
    elif not complete:
        anomaly = _anomaly_unknown(policy_id, ["incomplete_rival_set"])
    else:
        try:
            resolved = GR.resolve_anomaly_references(
                price,
                rivals.get("own_group_id"),
                rival_offers,
                confirmed=bool(rivals.get("group_membership_confirmed")),
            )
        except GR.GroupsError as exc:
            raise ApiError(422, exc.code, str(exc)) from exc
        if resolved.status == "unknown":
            anomaly = _anomaly_unknown(policy_id, list(resolved.reason_codes))
        else:
            verdict = AD.evaluate_anomaly(
                variant,
                price,
                list(resolved.reference_offers),
                budget,
                policy_id=policy_id,
                three_bidder_absolute_25=close_override,
            )
            anomaly = _anomaly_dict(verdict)

    direct = _money(company.direct_cost_cents)
    overhead = _money(company.overhead_cents)
    cost = direct + overhead if direct is not None and overhead is not None else None
    profile = company.profile_json if isinstance(company.profile_json, dict) else {}
    if profile.get("synthetic"):
        assumptions.append("Coste de empresa sintética")
    if cost is None:
        assumptions.append("Sin coste computable: beneficio y margen unknown")
        cost_s: str | None = None
        profit_s: str | None = None
        margin_s: str | None = None
    else:
        cost_s = MO.serialize_money(cost)
        profit_s = MO.serialize_money(MO.profit(price, cost))
        margin_s = MO.serialize_12dp(MO.margin(price, cost))

    best = min([price, *(Decimal(p) for p in rival_prices)]) if rival_prices else price
    shown = [MO.serialize_money(price), *(MO.serialize_money(Decimal(p)) for p in rival_prices)]
    trace: list[dict[str, Any]] = [
        {
            "label": "Precio de oferta",
            "expression": f"{MO.serialize_money(budget)}*(1-{MO.serialize_12dp(discount)})",
            "value": MO.serialize_money(price),
        },
        {
            "label": "Mejor oferta incluyendo propia",
            "expression": f"min({','.join(shown)})",
            "value": MO.serialize_money(best),
        },
        {
            "label": "Puntuación económica",
            "expression": f"template {rule.get('template_id')} sobre {MO.serialize_money(price)}",
            "value": scored.value_serialized,
        },
        {
            "label": "Presunción de anormalidad",
            "expression": f"policy {policy_id} branch {anomaly['branch']}",
            "value": anomaly["threshold_net"],
        },
    ]
    if margin_s is not None and cost is not None:
        trace.append(
            {
                "label": "Margen sobre coste",
                "expression": (
                    f"({MO.serialize_money(price)}-{MO.serialize_money(cost)})"
                    f"/{MO.serialize_money(price)}"
                ),
                "value": margin_s,
            }
        )

    curve: list[dict[str, Any]] = []
    curve_req = data.get("curve")
    if curve_req is not None:
        curve = _curve(
            scope,
            rule_row,
            company,
            expr,
            max_points,
            reference_price,
            rivals,
            rival_offers,
            curve_req,
        )

    hashes, warnings = _source_hashes(session, scope.tender_id)
    return {
        "engine_version": ENGINE_VERSION,
        "scope_id": scope.id,
        "pricing_rule_id": rule_row.rule_id,
        "pricing_rule_revision": rule_row.revision,
        "company_revision": company.revision,
        "price_net": MO.serialize_money(price),
        "cost_net": cost_s,
        "profit_net": profit_s,
        "margin_rate": margin_s,
        "score": _score_dict(scored),
        "anomaly": anomaly,
        "assumptions": assumptions,
        "trace": trace,
        "curve": curve,
        "source_hashes": hashes,
        "warnings": warnings,
    }


def _curve(
    scope: models.Scope,
    rule_row: models.RuleRevision,
    company: models.CompanyRevision,
    expr: EX.Expr,
    max_points: str,
    reference_price: str | None,
    rivals: dict[str, Any],
    rival_offers: list[GR.Offer],
    curve_req: dict[str, Any],
) -> list[dict[str, Any]]:
    rule = rule_row.rule_json if isinstance(rule_row.rule_json, dict) else {}
    policy = rule.get("anomaly_policy")
    policy = policy if isinstance(policy, dict) else {}
    policy_id = str(policy.get("id", "unknown"))
    variant = str(policy.get("variant", "unsupported"))
    budget = Decimal(scope.budget_net_cents or 0) / 100
    start = MO.parse_decimal(curve_req["from_discount_rate"], field="from_discount_rate")
    end = MO.parse_decimal(curve_req["to_discount_rate"], field="to_discount_rate")
    points = int(curve_req["points"])
    if start < 0 or end > DISCOUNT_MAX or start > end:
        raise ApiError(422, "curve_out_of_scope", "curve range must sit within 0 to 0.40")
    direct = _money(company.direct_cost_cents)
    overhead = _money(company.overhead_cents)
    cost = direct + overhead if direct is not None and overhead is not None else None
    with MO.arithmetic():
        step = (end - start) / (points - 1) if points > 1 else Decimal(0)
    out: list[dict[str, Any]] = []
    for index in range(points):
        with MO.arithmetic():
            discount = start + step * index
        price = MO.derive_price(budget, discount)
        rival_prices = [MO.serialize_money(offer.price) for offer in rival_offers]
        scored = SC.evaluate_score(
            expr,
            max_points,
            price,
            rival_prices,
            reference_price=reference_price,
            complete=bool(rivals["complete"]),
        )
        if cost is None:
            profit_s: str | None = None
            margin_s: str | None = None
        else:
            profit_s = MO.serialize_money(MO.profit(price, cost))
            margin_s = MO.serialize_12dp(MO.margin(price, cost))
        out.append(
            {
                "discount_rate": MO.serialize_12dp(discount),
                "price_net": MO.serialize_money(price),
                "profit_net": profit_s,
                "margin_rate": margin_s,
                "score": _score_dict(scored),
                "anomaly_status": _curve_anomaly(
                    price, budget, rivals, rival_offers, policy, policy_id, variant
                ),
            }
        )
    return out


def _curve_anomaly(
    price: Decimal,
    budget: Decimal,
    rivals: dict[str, Any],
    rival_offers: list[GR.Offer],
    policy: dict[str, Any],
    policy_id: str,
    variant: str,
) -> str:
    # Same dispatch order as evaluate(): unsupported short-circuits first with
    # the production not_applicable status (never curve-only unknown).
    if variant == "unsupported":
        return "not_applicable"
    if bool(policy.get("percentage_reduction_one_third")):
        return "unknown"
    if not bool(rivals["complete"]):
        return "unknown"
    resolved = GR.resolve_anomaly_references(
        price,
        rivals.get("own_group_id"),
        rival_offers,
        confirmed=bool(rivals.get("group_membership_confirmed")),
    )
    if resolved.status == "unknown":
        return "unknown"
    close_override = bool(policy.get("three_bidder_absolute_25", True))
    close_override = close_override and variant != "rglcap85_standard"
    verdict = AD.evaluate_anomaly(
        variant,
        price,
        list(resolved.reference_offers),
        budget,
        policy_id=policy_id,
        three_bidder_absolute_25=close_override,
    )
    return str(verdict.status)
