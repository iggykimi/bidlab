"""Money primitives for the deterministic rule engine.

All arithmetic runs under a local Decimal context with precision 34.
Money derived for scoring is quantized to 0.01 (ROUND_HALF_UP) before any
points are computed. Float inputs are rejected everywhere: no Decimal(float).
"""

from __future__ import annotations

import re
from contextlib import contextmanager
from decimal import ROUND_HALF_UP, Decimal, DivisionByZero, InvalidOperation, Overflow, localcontext
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Iterator

PRECISION = 34
CENT = Decimal("0.01")
UNIT_12DP = Decimal("0.000000000001")
MAX_DISCOUNT_RATE = Decimal("0.40")

DecimalInput = str | int | Decimal

_NUMERIC_RE = re.compile(r"[+-]?\d+(\.\d+)?")


class MoneyError(ValueError):
    """Domain rejection with a machine-readable code (API maps these to 422)."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@contextmanager
def arithmetic() -> Iterator[None]:
    """Local Decimal context: precision 34, no traps (non-finite is checked)."""
    with localcontext() as ctx:
        ctx.prec = PRECISION
        ctx.traps[InvalidOperation] = False
        ctx.traps[DivisionByZero] = False
        ctx.traps[Overflow] = False
        yield


def parse_decimal(value: DecimalInput, *, field: str = "value") -> Decimal:
    """Parse a strict base-10 input. Rejects float, bool, NaN/Infinity, locale text."""
    if isinstance(value, bool):
        raise MoneyError("bool_forbidden", f"{field}: bool is not a numeric input")
    if isinstance(value, float):
        raise MoneyError("float_forbidden", f"{field}: float input forbidden, use str")
    if isinstance(value, int):
        return Decimal(value)
    if isinstance(value, Decimal):
        result = value
    elif isinstance(value, str):
        text = value.strip()
        if _NUMERIC_RE.fullmatch(text) is None:
            raise MoneyError("bad_format", f"{field}: invalid numeric string {value!r}")
        try:
            result = Decimal(text)
        except InvalidOperation:
            raise MoneyError("bad_format", f"{field}: invalid numeric string {value!r}") from None
    else:  # pragma: no cover - defensive; type rejects this statically
        raise MoneyError("bad_type", f"{field}: unsupported numeric type")
    if not result.is_finite():
        raise MoneyError("non_finite", f"{field}: non-finite value")
    return result


def quantize_money(value: DecimalInput) -> Decimal:
    """Quantize money to 0.01 with ROUND_HALF_UP."""
    amount = parse_decimal(value, field="money")
    with arithmetic():
        result = amount.quantize(CENT, rounding=ROUND_HALF_UP)
    if not result.is_finite():
        raise MoneyError("non_finite", "money: quantization overflow")
    return result


def serialize_money(value: DecimalInput) -> str:
    """Money as a 2dp string (e.g. 112419.20)."""
    return format(quantize_money(value), "f")


def serialize_12dp(value: DecimalInput) -> str:
    """Score/ratio/mean/threshold as a max-12dp string (ROUND_HALF_UP)."""
    amount = parse_decimal(value, field="decimal")
    with arithmetic():
        result = amount.quantize(UNIT_12DP, rounding=ROUND_HALF_UP)
    if not result.is_finite():
        raise MoneyError("non_finite", "decimal: quantization overflow")
    return format(result, "f")


def serialize_exact(value: DecimalInput) -> str:
    """Exact fixed-point rendering without changing precision (e.g. 49, 22419.20)."""
    return format(parse_decimal(value, field="decimal"), "f")


def validate_discount(discount: DecimalInput) -> Decimal:
    """Discount rate within the P0 API scope 0 <= d <= 0.40 (scope, not law)."""
    rate = parse_decimal(discount, field="discount_rate")
    if rate < 0 or rate > MAX_DISCOUNT_RATE:
        raise MoneyError(
            "discount_out_of_range",
            f"discount_rate: {serialize_exact(rate)} outside P0 scope 0..0.40",
        )
    return rate


def derive_price(budget: DecimalInput, discount: DecimalInput) -> Decimal:
    """P = B * (1 - d), quantized to cents BEFORE scoring. Requires B > 0, P > 0."""
    base = parse_decimal(budget, field="budget_net")
    if base <= 0:
        raise MoneyError("budget_not_positive", "budget_net: must be > 0")
    rate = validate_discount(discount)
    with arithmetic():
        price = (base * (Decimal(1) - rate)).quantize(CENT, rounding=ROUND_HALF_UP)
    if not price.is_finite() or price <= 0:
        raise MoneyError("price_not_positive", "price_net: must be > 0")
    return price


def require_positive(value: DecimalInput, *, field: str) -> Decimal:
    """Parse and require a strictly positive amount."""
    amount = parse_decimal(value, field=field)
    if amount <= 0:
        raise MoneyError("not_positive", f"{field}: must be > 0")
    return amount


def check_ceiling(price: DecimalInput, ceiling: DecimalInput | None) -> Decimal:
    """Enforce an approved ceiling C (P <= C); None means no ceiling approved."""
    amount = parse_decimal(price, field="price_net")
    if ceiling is None:
        return amount
    cap = parse_decimal(ceiling, field="ceiling_net")
    if amount > cap:
        raise MoneyError("ceiling_exceeded", "price_net: above approved ceiling")
    return amount


def profit(price: DecimalInput, cost: DecimalInput) -> Decimal:
    """Benefit P - K. Negative cost is rejected (422); use profit_or_none for null cost."""
    amount = parse_decimal(price, field="price_net")
    direct = parse_decimal(cost, field="cost_net")
    if direct < 0:
        raise MoneyError("cost_negative", "cost_net: negative cost rejected")
    with arithmetic():
        return amount - direct


def margin(price: DecimalInput, cost: DecimalInput) -> Decimal:
    """Margin on sales (P - K) / P at full precision; serialize separately."""
    amount = require_positive(price, field="price_net")
    direct = parse_decimal(cost, field="cost_net")
    if direct < 0:
        raise MoneyError("cost_negative", "cost_net: negative cost rejected")
    with arithmetic():
        result = (amount - direct) / amount
    if not result.is_finite():
        raise MoneyError("non_finite", "margin_rate: non-finite result")
    return result


def cost_ceiling(price: DecimalInput, min_profit: DecimalInput) -> Decimal | None:
    """Highest cost K with P - K >= M, i.e. K = P - M. None when negative.

    Pure Decimal boundary for a FIXED price: costs never change the price
    score, so one cent above the ceiling breaks only the profit condition.
    Same base required (period, tax basis, currency); unknown stays null.
    """
    amount = parse_decimal(price, field="price_net")
    floor = parse_decimal(min_profit, field="min_profit_net")
    if amount < 0:
        raise MoneyError("price_negative", "price_net: negative price rejected")
    if floor < 0:
        raise MoneyError("profit_negative", "min_profit_net: negative minimum rejected")
    with arithmetic():
        ceiling = amount - floor
    if not ceiling.is_finite():
        raise MoneyError("non_finite", "max_cost_net: non-finite result")
    return ceiling if ceiling >= 0 else None


def profit_or_none(price: DecimalInput, cost: DecimalInput | None) -> Decimal | None:
    """profit() that maps a null cost to null (price/points stay computable)."""
    if cost is None:
        return None
    return profit(price, cost)


def margin_or_none(price: DecimalInput, cost: DecimalInput | None) -> Decimal | None:
    """margin() that maps a null cost to null (price/points stay computable)."""
    if cost is None:
        return None
    return margin(price, cost)


def target_price(cost: DecimalInput, margin_rate: DecimalInput) -> Decimal:
    """Reference price K / (1 - m) for a target margin 0 <= m < 1 (user reference)."""
    direct = parse_decimal(cost, field="cost_net")
    if direct < 0:
        raise MoneyError("cost_negative", "cost_net: negative cost rejected")
    target = parse_decimal(margin_rate, field="margin_rate")
    if target < 0 or target >= 1:
        raise MoneyError("margin_out_of_range", "margin_rate: must satisfy 0 <= m < 1")
    with arithmetic():
        price = (direct / (Decimal(1) - target)).quantize(CENT, rounding=ROUND_HALF_UP)
    if not price.is_finite():
        raise MoneyError("non_finite", "target_price: non-finite result")
    return price


def historic_drop(budget: DecimalInput, awarded: DecimalInput) -> Decimal:
    """Awarded drop (B - A) / B at full precision; only for a comparable pair."""
    base = parse_decimal(budget, field="budget_net")
    if base <= 0:
        raise MoneyError("budget_not_positive", "budget_net: must be > 0")
    final = parse_decimal(awarded, field="awarded_net")
    if final < 0:
        raise MoneyError("awarded_negative", "awarded_net: negative award rejected")
    with arithmetic():
        result = (base - final) / base
    if not result.is_finite():
        raise MoneyError("non_finite", "historic_drop: non-finite result")
    return result
