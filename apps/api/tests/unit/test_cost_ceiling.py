"""PKG-T21 unit: exact cost-ceiling boundary (pure Decimal, no engine)."""

from decimal import Decimal

import pytest
from bidlab.domain.money import MoneyError, cost_ceiling, profit

PRICE = "104135.68"
MIN_PROFIT = "8000.00"
CEILING = "96135.68"


def test_ceiling_exact_boundary() -> None:
    assert cost_ceiling(PRICE, MIN_PROFIT) == Decimal(CEILING)


def test_one_cent_above_breaks_only_the_profit_condition() -> None:
    assert profit(PRICE, CEILING) == Decimal(MIN_PROFIT)
    assert profit(PRICE, CEILING) >= Decimal(MIN_PROFIT)
    assert profit(PRICE, "96135.69") == Decimal("7999.99")
    assert profit(PRICE, "96135.69") < Decimal(MIN_PROFIT)


def test_negative_ceiling_is_null_never_zero() -> None:
    assert cost_ceiling("5000.00", MIN_PROFIT) is None
    assert cost_ceiling(MIN_PROFIT, MIN_PROFIT) == Decimal("0.00")


def test_negative_inputs_rejected() -> None:
    with pytest.raises(MoneyError):
        cost_ceiling("-1.00", MIN_PROFIT)
    with pytest.raises(MoneyError):
        cost_ceiling(PRICE, "-1.00")
    with pytest.raises(MoneyError):
        cost_ceiling(0.12, MIN_PROFIT)  # type: ignore[arg-type]
