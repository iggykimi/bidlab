"""U03-U06: scoring oracles from examples/math_vectors.json (external reference)."""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

import pytest
from bidlab.domain.expressions import Const, template_for
from bidlab.domain.money import derive_price
from bidlab.domain.scoring import ScoringError, best_price, evaluate_score
from hypothesis import given, settings
from hypothesis import strategies as st


def _examples() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "examples" / "math_vectors.json"
        if candidate.exists():
            return parent / "examples"
    raise FileNotFoundError("examples/math_vectors.json not found")


VECTORS = json.loads((_examples() / "math_vectors.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", VECTORS["scoring"])
def test_scoring_vectors(case: dict[str, object]) -> None:
    expr = template_for(str(case["template"]))
    reference = case["reference_price"]
    result = evaluate_score(
        expr,
        str(case["max_points"]),
        str(case["own_price"]),
        [str(r) for r in case["rivals"]],  # type: ignore[union-attr]
        str(reference) if reference is not None else None,
        complete=True,
    )
    expected = case["expected_score"]
    if expected is None:
        assert result.status == "unknown"
        assert result.value is None
        assert "zero_denominator" in result.reason_codes
    else:
        assert result.status == "defined"
        assert result.value_serialized == expected


def test_matrix_inverse_rows() -> None:
    expr = template_for("proportional_inverse")
    own_min = evaluate_score(expr, "49", "85", ["90", "93"], complete=True)
    assert own_min.status == "defined"
    assert own_min.value_serialized == "49.000000000000"
    not_min = evaluate_score(expr, "49", "95", ["90", "93"], complete=True)
    assert not_min.status == "defined"
    assert not_min.value_serialized == "46.421052631579"


def test_best_includes_own_across_curve() -> None:
    expr = template_for("proportional_inverse")
    rivals = ["100", "110"]
    seen: list[Decimal] = []
    for own in ["120", "100", "90", "80"]:
        result = evaluate_score(expr, "49", own, rivals, complete=True)
        assert result.status == "defined"
        assert result.value is not None
        seen.append(result.value)
    assert seen[0] < seen[1] == seen[2] == seen[3] == Decimal("49")
    assert best_price(Decimal("80"), [Decimal("100")]) == Decimal("80")


def test_incomplete_scenario_is_unknown_but_money_flows() -> None:
    expr = template_for("proportional_inverse")
    result = evaluate_score(expr, "49", "112419.20", ["106502.40"], complete=False)
    assert result.status == "unknown"
    assert result.value is None
    assert "best_price" in result.unknown_variables
    assert derive_price("118336.00", "0.05") == Decimal("112419.20")


def test_complete_single_bidder_and_missing_rivals() -> None:
    expr = template_for("proportional_inverse")
    single = evaluate_score(expr, "49", "100", [], complete=True)
    assert single.status == "defined"
    assert single.value_serialized == "49.000000000000"
    missing = evaluate_score(expr, "49", "100", None, complete=True)
    assert missing.status == "unknown"
    assert missing.value is None


def test_missing_reference_is_unknown() -> None:
    expr = template_for("linear_discount")
    result = evaluate_score(expr, "35", "100", ["90"], None, complete=True)
    assert result.status == "unknown"
    assert "reference_price" in result.unknown_variables


def test_invalid_offers_rejected() -> None:
    expr = template_for("proportional_inverse")
    with pytest.raises(ScoringError):
        evaluate_score(expr, "49", "0", ["90"], complete=True)
    with pytest.raises(ScoringError):
        evaluate_score(expr, "49", "95", ["-90"], complete=True)
    with pytest.raises(ScoringError) as exc:
        evaluate_score(expr, "49", "95", ["90"] * 21, complete=True)
    assert exc.value.code == "too_many_rivals"
    with pytest.raises(ScoringError):
        evaluate_score(expr, "0", "95", ["90"], complete=True)


def test_out_of_range_unsupported_without_clamp() -> None:
    linear = template_for("linear_discount")
    bad = evaluate_score(linear, "35", "110", ["90"], "100", complete=True)
    assert bad.status == "unsupported"
    assert bad.value is None
    assert bad.reason_codes == ("out_of_range",)
    clamped = evaluate_score(
        linear,
        "35",
        "110",
        ["90"],
        "100",
        complete=True,
        clamp=(Decimal(0), Decimal(35)),
    )
    assert clamped.status == "defined"
    assert clamped.value_serialized == "0.000000000000"
    const_high = evaluate_score(Const(value=Decimal(100)), "49", "95", ["90"], complete=True)
    assert const_high.status == "unsupported"


@given(
    weight=st.decimals(min_value=Decimal("1"), max_value=Decimal("100"), places=0),
    own=st.decimals(min_value=Decimal("0.01"), max_value=Decimal("500000"), places=2),
    rival=st.decimals(min_value=Decimal("0.01"), max_value=Decimal("500000"), places=2),
)
@settings(max_examples=40, deadline=None)
def test_inverse_score_in_range(weight: Decimal, own: Decimal, rival: Decimal) -> None:
    result = evaluate_score(
        template_for("proportional_inverse"), weight, own, [rival], complete=True
    )
    assert result.status == "defined"
    assert result.value is not None
    assert Decimal(0) <= result.value <= weight


@given(
    own_low=st.decimals(min_value=Decimal("0.01"), max_value=Decimal("500000"), places=2),
    bump=st.decimals(min_value=Decimal("0.01"), max_value=Decimal("500000"), places=2),
    rival=st.decimals(min_value=Decimal("0.01"), max_value=Decimal("500000"), places=2),
)
@settings(max_examples=40, deadline=None)
def test_inverse_monotone_in_own_price(own_low: Decimal, bump: Decimal, rival: Decimal) -> None:
    expr = template_for("proportional_inverse")
    cheaper = evaluate_score(expr, "49", own_low, [rival], complete=True)
    dearer = evaluate_score(expr, "49", own_low + bump, [rival], complete=True)
    assert cheaper.value is not None and dearer.value is not None
    assert cheaper.value >= dearer.value
