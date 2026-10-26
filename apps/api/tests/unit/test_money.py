"""U01-U02: money oracles from examples/math_vectors.json (external, never engine-made)."""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

import pytest
from bidlab.domain.money import (
    MoneyError,
    check_ceiling,
    derive_price,
    historic_drop,
    margin,
    margin_or_none,
    parse_decimal,
    profit,
    profit_or_none,
    quantize_money,
    serialize_12dp,
    serialize_exact,
    serialize_money,
    target_price,
    validate_discount,
)
from hypothesis import given, settings
from hypothesis import strategies as st


def _examples() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "examples" / "math_vectors.json"
        if candidate.exists():
            return parent / "examples"
    raise FileNotFoundError("examples/math_vectors.json not found")


VECTORS = json.loads((_examples() / "math_vectors.json").read_text(encoding="utf-8"))
BUDGET = "118336.00"
COST = "90000.00"


def test_parse_strict_formats() -> None:
    assert parse_decimal("112419.20") == Decimal("112419.20")
    assert parse_decimal("  49 ") == Decimal("49")
    assert parse_decimal(49) == Decimal("49")
    assert parse_decimal(Decimal("0.05")) == Decimal("0.05")
    for bad in ["", "1.000,00", "1,000.00", "1e3", "1E3", "1_000", "NaN", "Infinity", "-Infinity"]:
        with pytest.raises(MoneyError):
            parse_decimal(bad)
    for bad_float in [0.05, 112419.20, float("nan")]:
        with pytest.raises(MoneyError) as exc:
            parse_decimal(bad_float)  # type: ignore[arg-type]
        assert exc.value.code == "float_forbidden"
    with pytest.raises(MoneyError):
        parse_decimal(True)
    with pytest.raises(MoneyError):
        parse_decimal(Decimal("NaN"))
    with pytest.raises(MoneyError):
        parse_decimal(Decimal("Infinity"))


def test_quantize_half_up_not_float() -> None:
    assert quantize_money(Decimal("2.675")) == Decimal("2.68")
    assert quantize_money(Decimal("1.005")) == Decimal("1.01")
    assert quantize_money(Decimal("1.004")) == Decimal("1.00")
    assert serialize_money("112419.2") == "112419.20"


@pytest.mark.parametrize("case", VECTORS["tias_demo"])
def test_tias_demo_oracle(case: dict[str, str]) -> None:
    price = derive_price(BUDGET, case["discount_rate"])
    assert serialize_money(price) == case["expected_price_net"]
    assert serialize_exact(profit(price, COST)) == case["expected_profit_net"]
    assert serialize_12dp(margin(price, COST)) == case["expected_margin_rate"]


def test_discount_scope_boundaries() -> None:
    assert derive_price("100.00", "0") == Decimal("100.00")
    assert derive_price("100.00", "0.40") == Decimal("60.00")
    assert validate_discount("0.400000000000") == Decimal("0.40")
    for bad in ["-0.01", "0.400001", "0.41", "1"]:
        with pytest.raises(MoneyError) as exc:
            validate_discount(bad)
        assert exc.value.code == "discount_out_of_range"


def test_derive_rejects_bad_budget() -> None:
    for bad in ["0", "0.00", "-5"]:
        with pytest.raises(MoneyError):
            derive_price(bad, "0.05")


def test_cost_rules() -> None:
    with pytest.raises(MoneyError) as exc:
        profit("100.00", "-1")
    assert exc.value.code == "cost_negative"
    with pytest.raises(MoneyError):
        margin("100.00", "-1")
    assert profit_or_none("100.00", None) is None
    assert margin_or_none("100.00", None) is None
    assert profit("100.00", "0") == Decimal("100.00")
    assert serialize_12dp(margin("100.00", "0")) == "1.000000000000"
    with pytest.raises(MoneyError):
        margin("0.00", "10.00")


def test_margin_is_on_sales_not_markup() -> None:
    assert serialize_12dp(margin("100.00", "90.00")) == "0.100000000000"
    with pytest.raises(MoneyError):
        profit("100.00", "-0.01")


def test_ceiling() -> None:
    assert check_ceiling("90.00", "100.00") == Decimal("90.00")
    assert check_ceiling("100.00", "100.00") == Decimal("100.00")
    assert check_ceiling("100.00", None) == Decimal("100.00")
    with pytest.raises(MoneyError) as exc:
        check_ceiling("100.01", "100.00")
    assert exc.value.code == "ceiling_exceeded"


def test_target_price() -> None:
    assert target_price("90000.00", "0.1") == Decimal("100000.00")
    assert target_price("90000.00", "0") == Decimal("90000.00")
    assert target_price("0", "0.5") == Decimal("0.00")
    for bad in ["1", "1.5", "-0.1"]:
        with pytest.raises(MoneyError):
            target_price("90000.00", bad)
    with pytest.raises(MoneyError):
        target_price("-5", "0.1")


def test_historic_drop_comparable_pair() -> None:
    assert serialize_12dp(historic_drop("775000", "663269.40")) == "0.144168516129"
    with pytest.raises(MoneyError):
        historic_drop("0", "10")
    with pytest.raises(MoneyError):
        historic_drop("100", "-10")


def test_serialize_12dp_rounding() -> None:
    assert serialize_12dp(Decimal("46.421052631578947368421")) == "46.421052631579"
    assert serialize_12dp(Decimal("49")) == "49.000000000000"
    assert serialize_12dp(Decimal("-0.0864946303019")) == "-0.086494630302"


@given(
    cost=st.decimals(min_value=Decimal("0"), max_value=Decimal("100000"), places=2),
    low=st.decimals(min_value=Decimal("0.01"), max_value=Decimal("100000"), places=2),
    bump=st.decimals(min_value=Decimal("0.01"), max_value=Decimal("100000"), places=2),
)
@settings(max_examples=40)
def test_profit_rises_with_price(cost: Decimal, low: Decimal, bump: Decimal) -> None:
    assert profit(low + bump, cost) > profit(low, cost)
