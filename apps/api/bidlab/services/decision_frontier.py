"""Pareto frontier over 2-3 saved scenarios (BL-V2-05).

Reuses the public comparison service for loading and shared-context
validation, then classifies each entry with pure Decimal dominance:
an entry is on the frontier when no other entry is better-or-equal in
profit AND score with at least one strict dimension. Unknown figures
(null, never zero) and anomaly-flagged scenarios are excluded with an
explicit motivo instead of entering the frontier. Nothing is persisted.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from bidlab.api.errors import ApiError
from bidlab.domain import money as MO
from bidlab.services import compare as compare_service

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


@dataclass(frozen=True)
class FrontierCandidate:
    """Economics one entry needs; money/points as protocol strings or None."""

    scenario_id: str
    name: str
    profit_net: str | None
    score_value: str | None
    score_defined: bool
    anomaly_status: str


@dataclass(frozen=True)
class FrontierVerdict:
    scenario_id: str
    name: str
    verdict: str  # en_frontera | dominada | excluida
    motivo: str
    profit_net: str | None
    score_value: str | None
    anomaly_status: str


def _dominates(a_profit: str, a_score: str, b_profit: str, b_score: str) -> bool:
    with MO.arithmetic():
        profit_a = MO.parse_decimal(a_profit, field="profit_net")
        score_a = MO.parse_decimal(a_score, field="score")
        profit_b = MO.parse_decimal(b_profit, field="profit_net")
        score_b = MO.parse_decimal(b_score, field="score")
    return (
        profit_a >= profit_b and score_a >= score_b and (profit_a > profit_b or score_a > score_b)
    )


def _missing_dims(candidate: FrontierCandidate) -> str:
    missing: list[str] = []
    if candidate.profit_net is None:
        missing.append("el beneficio")
    if not candidate.score_defined or candidate.score_value is None:
        missing.append("los puntos")
    return " y ".join(missing)


def classify(candidates: list[FrontierCandidate]) -> list[FrontierVerdict]:
    """Pure Pareto classification. Input order is preserved in the output."""
    comparable = [
        c
        for c in candidates
        if c.profit_net is not None
        and c.score_defined
        and c.score_value is not None
        and c.anomaly_status != "possible_justification_required"
    ]
    verdicts: list[FrontierVerdict] = []
    for candidate in candidates:
        if (
            candidate.profit_net is None
            or not candidate.score_defined
            or candidate.score_value is None
        ):
            verdicts.append(
                FrontierVerdict(
                    scenario_id=candidate.scenario_id,
                    name=candidate.name,
                    verdict="excluida",
                    motivo=(
                        f"«{candidate.name}» queda fuera de la frontera: "
                        f"le falta {_missing_dims(candidate)}."
                    ),
                    profit_net=candidate.profit_net,
                    score_value=candidate.score_value,
                    anomaly_status=candidate.anomaly_status,
                )
            )
            continue
        if candidate.anomaly_status == "possible_justification_required":
            verdicts.append(
                FrontierVerdict(
                    scenario_id=candidate.scenario_id,
                    name=candidate.name,
                    verdict="excluida",
                    motivo=(
                        f"«{candidate.name}» queda fuera de la frontera: "
                        "es oferta sospechosa (presunción de anormalidad)."
                    ),
                    profit_net=candidate.profit_net,
                    score_value=candidate.score_value,
                    anomaly_status=candidate.anomaly_status,
                )
            )
            continue
        dominator = next(
            (
                other
                for other in comparable
                if other.scenario_id != candidate.scenario_id
                and _dominates(
                    str(other.profit_net),
                    str(other.score_value),
                    str(candidate.profit_net),
                    str(candidate.score_value),
                )
            ),
            None,
        )
        if dominator is None:
            verdicts.append(
                FrontierVerdict(
                    scenario_id=candidate.scenario_id,
                    name=candidate.name,
                    verdict="en_frontera",
                    motivo=(
                        f"«{candidate.name}» está en la frontera: ninguna otra "
                        "prueba la supera en beneficio y puntos a la vez."
                    ),
                    profit_net=candidate.profit_net,
                    score_value=candidate.score_value,
                    anomaly_status=candidate.anomaly_status,
                )
            )
        else:
            verdicts.append(
                FrontierVerdict(
                    scenario_id=candidate.scenario_id,
                    name=candidate.name,
                    verdict="dominada",
                    motivo=(
                        f"«{candidate.name}» queda dominada por «{dominator.name}»: "
                        "menos beneficio y puntos en este caso."
                    ),
                    profit_net=candidate.profit_net,
                    score_value=candidate.score_value,
                    anomaly_status=candidate.anomaly_status,
                )
            )
    return verdicts


def frontier_for(session: Session, scenario_ids: list[str]) -> dict[str, Any]:
    """Frontier over scenarios sharing one context; 422 otherwise."""
    compared = compare_service.compare_scenarios(session, scenario_ids, scenario_ids[0])
    if compared["status"] != "comparable":
        warnings = compared.get("warnings", [])
        detail = str(warnings[0]) if warnings else "distinto contexto"
        raise ApiError(422, "frontier_not_comparable", detail)
    candidates = [
        FrontierCandidate(
            scenario_id=str(entry["scenario_id"]),
            name=str(entry["name"]),
            profit_net=str(entry["profit_net"]) if entry["profit_net"] is not None else None,
            score_value=str(entry["score_value"]) if entry["score_value"] is not None else None,
            score_defined=entry["score_status"] == "defined",
            anomaly_status=str(entry["anomaly_status"]),
        )
        for entry in compared["entries"]
    ]
    verdicts = classify(candidates)
    return {
        "scenario_ids": compared["scenario_ids"],
        "context": compared["context"],
        "entries": [
            {
                "scenario_id": v.scenario_id,
                "name": v.name,
                "verdict": v.verdict,
                "motivo": v.motivo,
                "profit_net": v.profit_net,
                "score_value": v.score_value,
                "anomaly_status": v.anomaly_status,
            }
            for v in verdicts
        ],
        "warnings": compared.get("warnings", []),
    }
