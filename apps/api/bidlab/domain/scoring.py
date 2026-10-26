"""Scoring: best offer always includes the own offer; unknown when incomplete.

Money inputs are quantized to cents BEFORE scoring. An offer flagged as
presumably abnormal is never auto-removed from scoring. Out-of-range results
without an authorized clamp are unsupported, never silently corrected.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Literal

from bidlab.domain import expressions as E
from bidlab.domain.money import (
    DecimalInput,
    parse_decimal,
    quantize_money,
    serialize_12dp,
)

if TYPE_CHECKING:
    from collections.abc import Sequence
    from decimal import Decimal

MAX_RIVALS = 20

ScoreStatus = Literal["defined", "unknown", "unsupported"]


class ScoringError(ValueError):
    """Invalid scoring input (API maps these to 422)."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class ScoreResult:
    status: ScoreStatus
    value: Decimal | None
    max_points: Decimal
    unknown_variables: tuple[str, ...] = ()
    reason_codes: tuple[str, ...] = field(default_factory=tuple)

    @property
    def value_serialized(self) -> str | None:
        if self.value is None:
            return None
        return serialize_12dp(self.value)


def best_price(own_price: Decimal, rivals: Sequence[Decimal]) -> Decimal:
    """Minimum of own + rivals. Callers must pass quantized money (see below)."""
    return min((own_price, *rivals))


def validate_offers(
    own_price: DecimalInput, rivals: Sequence[DecimalInput]
) -> tuple[Decimal, tuple[Decimal, ...]]:
    """Parse, quantize BEFORE scoring, and validate the declared offer set."""
    if len(rivals) > MAX_RIVALS:
        raise ScoringError("too_many_rivals", f"rivals: at most {MAX_RIVALS} offers")
    own = quantize_money(parse_decimal(own_price, field="own_price"))
    if own <= 0:
        raise ScoringError("offer_not_positive", "own_price: must be > 0")
    checked: list[Decimal] = []
    for index, raw in enumerate(rivals):
        price = quantize_money(parse_decimal(raw, field=f"rivals[{index}]"))
        if price <= 0:
            raise ScoringError("offer_not_positive", f"rivals[{index}]: must be > 0")
        checked.append(price)
    return own, tuple(checked)


def evaluate_score(
    expression: E.Expr,
    max_points: DecimalInput,
    own_price: DecimalInput,
    rivals: Sequence[DecimalInput] | None,
    reference_price: DecimalInput | None = None,
    *,
    complete: bool,
    clamp: tuple[Decimal, Decimal] | None = None,
) -> ScoreResult:
    """Score an offer set. Incomplete scenarios yield unknown, never a guess.

    clamp applies ONLY when the approved template authorizes it; otherwise an
    out-of-range value is unsupported.
    """
    weight = parse_decimal(max_points, field="max_points")
    if weight <= 0:
        raise ScoringError("max_points_not_positive", "max_points: must be > 0")
    E.validate_expr(expression)
    needed = E.required_vars(expression)
    if not complete or rivals is None:
        missing = sorted(needed - {"max_points"})
        return ScoreResult(
            status="unknown",
            value=None,
            max_points=weight,
            unknown_variables=tuple(missing),
            reason_codes=("incomplete_scenario",),
        )
    own, checked = validate_offers(own_price, rivals)
    variables: dict[str, DecimalInput] = {
        "own_price": own,
        "best_price": best_price(own, checked),
        "max_points": weight,
    }
    if reference_price is not None:
        reference = quantize_money(parse_decimal(reference_price, field="reference_price"))
        if reference <= 0:
            raise ScoringError("reference_not_positive", "reference_price: must be > 0")
        variables["reference_price"] = reference
    absent = sorted(needed - variables.keys())
    if absent:
        return ScoreResult(
            status="unknown",
            value=None,
            max_points=weight,
            unknown_variables=tuple(absent),
            reason_codes=("missing_variable",),
        )
    outcome = E.evaluate(expression, variables)
    if isinstance(outcome, E.EvalUnknown):
        return ScoreResult(
            status="unknown",
            value=None,
            max_points=weight,
            unknown_variables=(),
            reason_codes=(outcome.reason,),
        )
    value = outcome.value
    if clamp is not None:
        low, high = clamp
        value = min(max(value, low), high)
    elif value < 0 or value > weight:
        return ScoreResult(
            status="unsupported",
            value=None,
            max_points=weight,
            unknown_variables=(),
            reason_codes=("out_of_range",),
        )
    return ScoreResult(
        status="defined",
        value=value,
        max_points=weight,
        unknown_variables=(),
        reason_codes=(),
    )
