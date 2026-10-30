"""Typed comparison of 2-3 saved scenarios over frozen snapshots.

Reads Scenario snapshots (frozen input/result/context) and never re-evaluates:
comparisons reuse frozen results, so a recalculation would create a new
scenario version instead. All arithmetic runs in Decimal; money and points
cross the API as strings, and every Spanish motivo explains nulls, dominance
and indicators in plain language.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import TYPE_CHECKING, Any

from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.domain import money as MO
from bidlab.services import scenarios as scenarios_service

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


@dataclass(frozen=True)
class LoadedScenario:
    """One scenario row plus the frozen fields comparison needs."""

    scenario_id: str
    name: str
    tender_id: str
    scope_id: str
    rule_id: str
    rule_revision: int
    company_id: str
    company_revision: int
    basis_key: tuple[str | None, str | None, str | None, str | None, str | None]
    budget_net: str
    rivals_fingerprint: str
    rivals_count: int
    discount_rate: str
    price_net: str
    profit_net: str | None
    score_value: str | None
    score_status: str
    anomaly_status: str


def _normalise_rivals(rivals: Any) -> tuple[str, int]:
    data = rivals if isinstance(rivals, dict) else {}
    raw_offers = data.get("offers", [])
    offers: list[dict[str, Any]] = []
    if isinstance(raw_offers, list):
        for offer in raw_offers:
            if isinstance(offer, dict):
                offers.append(
                    {
                        "group_id": offer.get("group_id"),
                        "label": str(offer.get("label", "")),
                        "price_net": str(offer.get("price_net", "")),
                    }
                )
    offers.sort(key=lambda o: (str(o["price_net"]), str(o["group_id"] or ""), str(o["label"])))
    canonical = {
        "complete": bool(data.get("complete", False)),
        "group_membership_confirmed": bool(data.get("group_membership_confirmed", False)),
        "offers": offers,
        "own_group_id": data.get("own_group_id"),
        "state": str(data.get("state", "")),
    }
    blob = json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest(), len(offers)


def _load(session: Session, scenario_id: str) -> LoadedScenario:
    row = session.get(models.Scenario, scenario_id)
    if row is None:
        raise ApiError(404, "scenario_not_found", f"unknown scenario {scenario_id}")
    full = scenarios_service.scenario_to_dict(row)  # validates the snapshot hash
    snapshot = row.snapshot_json if isinstance(row.snapshot_json, dict) else {}
    frozen_input = snapshot.get("input")
    result = snapshot.get("result")
    context = snapshot.get("context")
    if (
        not isinstance(frozen_input, dict)
        or not isinstance(result, dict)
        or not isinstance(context, dict)
    ):
        raise ApiError(500, "scenario_snapshot_incomplete", f"scenario {row.id}: bad snapshot")
    score = result.get("score")
    score = score if isinstance(score, dict) else {}
    anomaly = result.get("anomaly")
    anomaly = anomaly if isinstance(anomaly, dict) else {}
    basis = context.get("basis")
    basis = basis if isinstance(basis, dict) else {}
    scope = session.get(models.Scope, row.scope_id)
    if scope is None:
        raise ApiError(404, "scope_not_found", f"unknown scope {row.scope_id}")
    budget = basis.get("budget_net")
    budget_net = str(budget) if budget is not None else None
    if budget_net is None and scope.budget_net_cents is not None:
        budget_net = MO.serialize_money(Decimal(scope.budget_net_cents) / 100)
    if budget_net is None:
        raise ApiError(500, "scenario_snapshot_incomplete", f"scenario {row.id}: no budget_net")
    fingerprint, rivals_count = _normalise_rivals(frozen_input.get("rivals"))
    profit = result.get("profit_net")
    score_value = score.get("value")
    return LoadedScenario(
        scenario_id=row.id,
        name=str(full.get("name", row.id)),
        tender_id=scope.tender_id,
        scope_id=row.scope_id,
        rule_id=row.rule_id,
        rule_revision=row.rule_revision,
        company_id=row.company_id,
        company_revision=row.company_revision,
        basis_key=(
            str(basis.get("budget_net")) if basis.get("budget_net") is not None else None,
            (
                str(basis.get("scoring_reference_net"))
                if basis.get("scoring_reference_net") is not None
                else None
            ),
            str(basis.get("period_months")) if basis.get("period_months") is not None else None,
            str(basis.get("currency")) if basis.get("currency") is not None else None,
            str(basis.get("unit")) if basis.get("unit") is not None else None,
        ),
        budget_net=budget_net,
        rivals_fingerprint=fingerprint,
        rivals_count=rivals_count,
        discount_rate=str(frozen_input.get("discount_rate", "0")),
        price_net=str(result.get("price_net", "0.00")),
        profit_net=str(profit) if profit is not None else None,
        score_value=str(score_value) if score_value is not None else None,
        score_status=str(score.get("status", "unknown")),
        anomaly_status=str(anomaly.get("status", "unknown")),
    )


def _dimension_diffs(base: LoadedScenario, other: LoadedScenario) -> list[tuple[str, str]]:
    """Short labels + warning sentences for every context dimension that differs."""
    diffs: list[tuple[str, str]] = []
    if base.tender_id != other.tender_id:
        diffs.append(
            (
                "expediente",
                f"«{base.name}» y «{other.name}» son de expedientes distintos: "
                "no puedes compararlas como si fueran el mismo caso.",
            )
        )
    if base.scope_id != other.scope_id:
        diffs.append(
            (
                "ámbito",
                f"«{base.name}» y «{other.name}» son de ámbitos distintos: "
                "no puedes compararlas como si fueran el mismo caso.",
            )
        )
    if base.basis_key != other.basis_key:
        diffs.append(
            (
                "base o periodo",
                f"«{base.name}» y «{other.name}» usan distinta base o periodo: "
                "no puedes compararlas como si fueran el mismo caso.",
            )
        )
    if (base.rule_id, base.rule_revision) != (other.rule_id, other.rule_revision):
        diffs.append(
            (
                "fórmula",
                f"«{base.name}» y «{other.name}» usan distinta fórmula o revisión: "
                "no puedes compararlas como si fueran el mismo caso.",
            )
        )
    if (base.company_id, base.company_revision) != (other.company_id, other.company_revision):
        diffs.append(
            (
                "empresa",
                f"«{base.name}» y «{other.name}» usan distintos datos de empresa: "
                "no puedes compararlas como si fueran el mismo caso.",
            )
        )
    if base.rivals_fingerprint != other.rivals_fingerprint:
        diffs.append(
            (
                "rivales",
                f"Declaraste rivales distintos en «{base.name}» y «{other.name}»: "
                "no puedes comparar sus puntos.",
            )
        )
    return diffs


def _sub_money(a: str, b: str) -> str:
    with MO.arithmetic():
        diff = MO.parse_decimal(a, field="delta") - MO.parse_decimal(b, field="delta")
    return format(MO.quantize_money(diff), "f")


def _sub_score(a: str, b: str) -> str:
    with MO.arithmetic():
        diff = MO.parse_decimal(a, field="delta") - MO.parse_decimal(b, field="delta")
    return MO.serialize_12dp(diff)


def _group_thousands(integer: str) -> str:
    """Thousands dots, es-ES style, mirroring Intl es-ES default grouping."""
    grouped = ""
    while len(integer) > 3:
        grouped = "." + integer[-3:] + grouped
        integer = integer[:-3]
    return integer + grouped


def _abs_money_es(value: Decimal) -> str:
    """Absolute money for embedding in sentences: "11.833,60 €" (NBSP, like the frontend)."""
    text = format(MO.quantize_money(abs(value)), "f")
    integer, _, fraction = text.partition(".")
    return f"{_group_thousands(integer)},{fraction or '00'}\u00a0€"


def _abs_points_es(value: Decimal) -> str:
    """Absolute points for embedding in sentences: 1 decimal, comma ("2,6")."""
    with MO.arithmetic():
        quantized = abs(value).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    return format(quantized, "f").replace(".", ",")


def _score_defined(entry: LoadedScenario) -> bool:
    return entry.score_status == "defined" and entry.score_value is not None


def _missing_names(entries: list[LoadedScenario]) -> str:
    return " y ".join(f"«{entry.name}»" for entry in entries)


def _different_context_delta(
    base: LoadedScenario, other: LoadedScenario, labels: str
) -> dict[str, Any]:
    shared = f"«{base.name}» y «{other.name}» no comparten contexto ({labels})"
    return {
        "base_id": base.scenario_id,
        "other_id": other.scenario_id,
        "delta_price_net": None,
        "delta_price_motivo": f"{shared}: no calculamos la diferencia de precio.",
        "delta_profit_net": None,
        "delta_profit_motivo": f"{shared}: no calculamos la diferencia de beneficio.",
        "delta_score": None,
        "delta_score_motivo": f"{shared}: no calculamos la diferencia de puntos.",
        "cost_per_point_net": None,
        "cost_per_point_motivo": f"{shared}: no calculamos el coste por punto.",
        "dominant_id": None,
        "dominance_motivo": f"{shared}: no te decimos cuál te conviene más.",
        "indicator": "different_context",
        "indicator_motivo": (
            f"Son casos distintos ({labels}): míralas por separado, no frente a frente."
        ),
    }


def _cost_per_point(
    base: LoadedScenario,
    other: LoadedScenario,
    delta_profit: str | None,
    delta_score: str | None,
) -> tuple[str | None, str | None]:
    if delta_score is None:
        return None, ("Alguna prueba no tiene puntos: no calculamos el coste por punto.")
    if delta_profit is None:
        return None, ("Alguna prueba no tiene beneficio: no calculamos el coste por punto.")
    with MO.arithmetic():
        ds = MO.parse_decimal(delta_score, field="delta_score")
        dp = MO.parse_decimal(delta_profit, field="delta_profit")
    if ds == 0:
        return (
            None,
            f"«{base.name}» y «{other.name}» tienen los mismos puntos: "
            "no calculamos el coste por punto.",
        )
    with MO.arithmetic():
        profit_base = MO.parse_decimal(str(base.profit_net), field="profit_net")
        profit_other = MO.parse_decimal(str(other.profit_net), field="profit_net")
        score_base = MO.parse_decimal(str(base.score_value), field="score")
        score_other = MO.parse_decimal(str(other.score_value), field="score")
        value = (profit_base - profit_other) / (score_other - score_base)
    if not value.is_finite():
        return None, "No pudimos calcular el coste por punto con estos valores."
    euros = format(MO.quantize_money(value), "f")
    ds_s = _abs_points_es(ds)
    if ds > 0 and dp < 0:
        return euros, (
            f"«{other.name}» gana {ds_s} puntos y cede {_abs_money_es(dp)} de beneficio "
            f"frente a «{base.name}» (≈{_abs_money_es(value)} por punto)."
        )
    if ds < 0 and dp > 0:
        return euros, (
            f"«{other.name}» pierde {ds_s} puntos y conserva {_abs_money_es(dp)} más de beneficio "
            f"frente a «{base.name}» (≈{_abs_money_es(value)} por punto cedido)."
        )
    return euros, (
        f"Diferencia de {_abs_points_es(ds)} puntos y de {_abs_money_es(dp)} de beneficio "
        f"(≈{_abs_money_es(value)} por punto; el signo indica el sentido)."
    )


def _supera(winner: str, loser: str, more_profit: bool, more_score: bool) -> str:
    """Dominance sentence naming only the strictly-better dimensions (J4 F1)."""
    if more_profit and more_score:
        return f"«{winner}» supera a «{loser}» en beneficio y puntos en este caso."
    if more_profit:
        return f"«{winner}» supera a «{loser}» en beneficio, con los mismos puntos, en este caso."
    return f"«{winner}» supera a «{loser}» en puntos, con el mismo beneficio, en este caso."


def _dominance(
    base: LoadedScenario, other: LoadedScenario, profit_known: bool, score_known: bool
) -> tuple[str | None, str]:
    if not profit_known:
        missing = [e for e in (base, other) if e.profit_net is None]
        return None, (
            f"Beneficio sin determinar en {_missing_names(missing)}: "
            "no te decimos cuál te conviene más."
        )
    if not score_known:
        missing = [e for e in (base, other) if not _score_defined(e)]
        if len(missing) == 1:
            return None, (
                f"{_missing_names(missing)} no tiene puntos: no te decimos cuál te conviene más."
            )
        return None, (
            f"{_missing_names(missing)} no tienen puntos: no te decimos cuál te conviene más."
        )
    if base.anomaly_status != other.anomaly_status:
        return None, (
            f"«{base.name}» y «{other.name}» no coinciden en oferta sospechosa: "
            "no te decimos cuál te conviene más."
        )
    with MO.arithmetic():
        profit_base = MO.parse_decimal(str(base.profit_net), field="profit_net")
        profit_other = MO.parse_decimal(str(other.profit_net), field="profit_net")
        score_base = MO.parse_decimal(str(base.score_value), field="score")
        score_other = MO.parse_decimal(str(other.score_value), field="score")
    other_wins = (
        profit_other >= profit_base
        and score_other >= score_base
        and (profit_other > profit_base or score_other > score_base)
    )
    base_wins = (
        profit_base >= profit_other
        and score_base >= score_other
        and (profit_base > profit_other or score_base > score_other)
    )
    if other_wins:
        return other.scenario_id, _supera(
            other.name, base.name, profit_other > profit_base, score_other > score_base
        )
    if base_wins:
        return base.scenario_id, _supera(
            base.name, other.name, profit_base > profit_other, score_base > score_other
        )
    return None, "Ninguna prueba supera a la otra en beneficio y puntos en este caso."


def _indicator(
    base: LoadedScenario,
    other: LoadedScenario,
    delta_profit: str | None,
    delta_score: str | None,
) -> tuple[str, str]:
    if delta_profit is None or delta_score is None:
        missing = [e for e in (base, other) if e.profit_net is None or not _score_defined(e)]
        return "unknown", (
            f"A {_missing_names(missing)} le faltan el beneficio o los puntos: "
            "la comparación queda sin determinar."
        )
    with MO.arithmetic():
        dp = MO.parse_decimal(delta_profit, field="delta_profit")
        ds = MO.parse_decimal(delta_score, field="delta_score")
        d_price = MO.parse_decimal(_sub_money(other.price_net, base.price_net), field="delta_price")
    if d_price == 0 and ds == 0:
        return "same_price_score", (
            f"«{base.name}» y «{other.name}» tienen el mismo precio y los mismos puntos."
        )
    if ds == 0 and dp == 0:
        # Same economics through different prices: state the tie, never "more".
        return "same_price_score", (
            f"«{base.name}» y «{other.name}» tienen los mismos puntos y el mismo beneficio."
        )
    if ds == 0:
        winner = other.name if dp > 0 else base.name
        return "higher_profit_same_score", (
            f"«{winner}» conserva {_abs_money_es(dp)} más de beneficio con los mismos puntos."
        )
    ds_s = _abs_points_es(ds)
    if ds > 0 and dp < 0:
        return "tradeoff", (
            f"«{other.name}» gana {ds_s} puntos y cede {_abs_money_es(dp)} de beneficio "
            f"frente a «{base.name}»."
        )
    if ds < 0 and dp > 0:
        return "tradeoff", (
            f"«{other.name}» pierde {ds_s} puntos y conserva {_abs_money_es(dp)} más de beneficio "
            f"frente a «{base.name}»."
        )
    if dp == 0:
        winner, loser = (other.name, base.name) if ds > 0 else (base.name, other.name)
        return "tradeoff", f"«{winner}» gana {ds_s} puntos con el mismo beneficio que «{loser}»."
    if ds > 0:
        return "tradeoff", (
            f"«{other.name}» mejora a «{base.name}» en puntos ({ds_s}) "
            f"y en beneficio ({_abs_money_es(dp)})."
        )
    return "tradeoff", (
        f"«{base.name}» mejora a «{other.name}» en puntos ({ds_s}) "
        f"y en beneficio ({_abs_money_es(dp)})."
    )


def _pair_delta(base: LoadedScenario, other: LoadedScenario) -> dict[str, Any]:
    diffs = _dimension_diffs(base, other)
    if diffs:
        return _different_context_delta(base, other, ", ".join(label for label, _ in diffs))
    delta_price = _sub_money(other.price_net, base.price_net)
    if base.profit_net is None or other.profit_net is None:
        missing = [e for e in (base, other) if e.profit_net is None]
        delta_profit: str | None = None
        profit_motivo: str | None = (
            f"Beneficio sin determinar en {_missing_names(missing)}: aún no nos diste tu coste."
        )
    else:
        delta_profit = _sub_money(other.profit_net, base.profit_net)
        profit_motivo = None
    if not _score_defined(base) or not _score_defined(other):
        missing = [e for e in (base, other) if not _score_defined(e)]
        delta_score: str | None = None
        if len(missing) == 1:
            score_motivo = (
                f"{_missing_names(missing)} no tiene puntos: no calculamos la diferencia de puntos."
            )
        else:
            score_motivo = (
                f"{_missing_names(missing)} no tienen puntos: "
                "no calculamos la diferencia de puntos."
            )
    else:
        delta_score = _sub_score(str(other.score_value), str(base.score_value))
        score_motivo = None
    cost_value, cost_motivo = _cost_per_point(base, other, delta_profit, delta_score)
    dominant_id, dominance_motivo = _dominance(
        base, other, delta_profit is not None, delta_score is not None
    )
    indicator, indicator_motivo = _indicator(base, other, delta_profit, delta_score)
    return {
        "base_id": base.scenario_id,
        "other_id": other.scenario_id,
        "delta_price_net": delta_price,
        "delta_price_motivo": None,
        "delta_profit_net": delta_profit,
        "delta_profit_motivo": profit_motivo,
        "delta_score": delta_score,
        "delta_score_motivo": score_motivo,
        "cost_per_point_net": cost_value,
        "cost_per_point_motivo": cost_motivo,
        "dominant_id": dominant_id,
        "dominance_motivo": dominance_motivo,
        "indicator": indicator,
        "indicator_motivo": indicator_motivo,
    }


def _entry(entry: LoadedScenario) -> dict[str, Any]:
    return {
        "scenario_id": entry.scenario_id,
        "name": entry.name,
        "discount_rate": entry.discount_rate,
        "price_net": entry.price_net,
        "profit_net": entry.profit_net,
        "score_value": entry.score_value,
        "score_status": entry.score_status,
        "anomaly_status": entry.anomaly_status,
    }


def compare_loaded(loaded: list[LoadedScenario], primary_id: str) -> dict[str, Any]:
    """Pure comparison over loaded snapshots (no DB access; unit-testable)."""
    primary = next(entry for entry in loaded if entry.scenario_id == primary_id)
    others = [entry for entry in loaded if entry.scenario_id != primary_id]
    warnings: list[str] = []
    for other in others:
        warnings.extend(sentence for _, sentence in _dimension_diffs(primary, other))
    if warnings:
        status = "no_comparable"
    elif all(entry.profit_net is not None and _score_defined(entry) for entry in loaded):
        status = "comparable"
    else:
        status = "partial"
    return {
        "status": status,
        "scenario_ids": [entry.scenario_id for entry in loaded],
        "primary_id": primary_id,
        "context": {
            "tender_id": primary.tender_id,
            "scope_id": primary.scope_id,
            "budget_net": primary.budget_net,
            "rule_id": primary.rule_id,
            "rule_revision": primary.rule_revision,
            "company_id": primary.company_id,
            "company_revision": primary.company_revision,
            "rivals_fingerprint": primary.rivals_fingerprint,
            "rivals_count": primary.rivals_count,
        },
        "entries": [_entry(entry) for entry in loaded],
        "deltas": [_pair_delta(primary, other) for other in others],
        "warnings": warnings,
    }


def compare_scenarios(session: Session, scenario_ids: list[str], primary_id: str) -> dict[str, Any]:
    """Load 2-3 scenarios and compare them over their frozen snapshots."""
    if len(set(scenario_ids)) != len(scenario_ids):
        raise ApiError(422, "compare_invalid_request", "scenario_ids: duplicated ids")
    if primary_id not in scenario_ids:
        raise ApiError(422, "compare_invalid_request", "primary_id must be one of scenario_ids")
    loaded = [_load(session, scenario_id) for scenario_id in scenario_ids]
    return compare_loaded(loaded, primary_id)
