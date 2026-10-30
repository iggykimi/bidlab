"""Unit tests for the typed scenario comparison (pure compare_loaded)."""

from decimal import ROUND_HALF_UP, Decimal
from typing import Any

import pytest
from bidlab.api.errors import ApiError
from bidlab.schemas import generated as g
from bidlab.services import compare as compare_service
from bidlab.services.compare import LoadedScenario

NOT_FLAGGED = "not_flagged_under_assumptions"


def _loaded(scenario_id: str, name: str, **overrides: Any) -> LoadedScenario:
    fields: dict[str, Any] = {
        "scenario_id": scenario_id,
        "name": name,
        "tender_id": "tias",
        "scope_id": "tias-whole",
        "rule_id": "tias-price-r1",
        "rule_revision": 1,
        "company_id": "company-demo",
        "company_revision": 1,
        "basis_key": ("118336.00", None, "24", "EUR", "lump_sum"),
        "budget_net": "118336.00",
        "rivals_fingerprint": "f" * 64,
        "rivals_count": 2,
        "discount_rate": "0.1000",
        "price_net": "106502.40",
        "profit_net": "16502.40",
        "score_value": "49.000000000000",
        "score_status": "defined",
        "anomaly_status": NOT_FLAGGED,
    }
    fields.update(overrides)
    return LoadedScenario(**fields)


def _fifteen() -> LoadedScenario:
    return _loaded(
        "scn-15",
        "Baja 15%",
        discount_rate="0.1500",
        price_net="100585.60",
        profit_net="10585.60",
    )


def _ten() -> LoadedScenario:
    return _loaded("scn-10", "Baja 10%")


def test_golden_10_vs_15_same_score_profit_delta() -> None:
    """10% vs 15%: same 49pts, +5916.80 profit for the cheaper alternative."""
    result = compare_service.compare_loaded([_fifteen(), _ten()], "scn-15")
    plain = g.CompareResult.model_validate(result).model_dump(mode="json")
    assert plain["status"] == "comparable"
    assert plain["warnings"] == []
    assert plain["context"]["budget_net"] == "118336.00"
    assert [entry["score_value"] for entry in plain["entries"]] == [
        "49.000000000000",
        "49.000000000000",
    ]
    (delta,) = plain["deltas"]
    assert delta["base_id"] == "scn-15"
    assert delta["other_id"] == "scn-10"
    assert delta["delta_price_net"] == "5916.80"
    assert delta["delta_profit_net"] == "5916.80"
    assert delta["delta_score"] == "0.000000000000"
    assert delta["cost_per_point_net"] is None
    assert delta["cost_per_point_motivo"] is not None
    assert "mismos puntos" in delta["cost_per_point_motivo"]
    assert delta["dominant_id"] == "scn-10"
    assert "supera" in delta["dominance_motivo"]
    # J4 F1: tied points must never read as superiority in points.
    assert "con los mismos puntos" in delta["dominance_motivo"]
    assert "en beneficio y puntos" not in delta["dominance_motivo"]
    assert delta["indicator"] == "higher_profit_same_score"
    assert "5.916,80\u00a0€" in delta["indicator_motivo"]


def test_primary_10_other_15_negative_delta() -> None:
    result = compare_service.compare_loaded([_ten(), _fifteen()], "scn-10")
    plain = g.CompareResult.model_validate(result).model_dump(mode="json")
    (delta,) = plain["deltas"]
    assert delta["delta_profit_net"] == "-5916.80"
    assert delta["delta_score"] == "0.000000000000"
    assert delta["dominant_id"] == "scn-10"
    assert delta["indicator"] == "higher_profit_same_score"


def test_tradeoff_5_vs_10_cost_per_point() -> None:
    five = _loaded(
        "scn-05",
        "Baja 5%",
        discount_rate="0.0500",
        price_net="112419.20",
        profit_net="22419.20",
        score_value="46.421052631579",
    )
    result = compare_service.compare_loaded([five, _ten()], "scn-05")
    plain = g.CompareResult.model_validate(result).model_dump(mode="json")
    assert plain["status"] == "comparable"
    (delta,) = plain["deltas"]
    assert delta["delta_score"] == "2.578947368421"
    assert delta["delta_profit_net"] == "-5916.80"
    assert delta["dominant_id"] is None
    assert delta["indicator"] == "tradeoff"
    expected = (
        (Decimal("22419.20") - Decimal("16502.40"))
        / (Decimal("49.000000000000") - Decimal("46.421052631579"))
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    assert delta["cost_per_point_net"] == format(expected, "f")
    assert delta["cost_per_point_motivo"] is not None
    assert "€ por punto" in delta["cost_per_point_motivo"]


def test_same_price_score_no_dominance_without_strict() -> None:
    twin = _loaded("scn-10b", "Baja 10% copia")
    result = compare_service.compare_loaded([_ten(), twin], "scn-10")
    plain = g.CompareResult.model_validate(result).model_dump(mode="json")
    (delta,) = plain["deltas"]
    assert delta["delta_price_net"] == "0.00"
    assert delta["indicator"] == "same_price_score"
    assert delta["dominant_id"] is None
    assert "Ninguna prueba supera" in delta["dominance_motivo"]


def test_anomaly_difference_blocks_dominance() -> None:
    loss = _loaded(
        "scn-30",
        "Baja 30%",
        discount_rate="0.3000",
        price_net="82835.20",
        profit_net="-7164.80",
        anomaly_status="possible_justification_required",
    )
    result = compare_service.compare_loaded([_ten(), loss], "scn-10")
    plain = g.CompareResult.model_validate(result).model_dump(mode="json")
    assert plain["status"] == "comparable"
    (delta,) = plain["deltas"]
    assert delta["indicator"] == "higher_profit_same_score"
    assert delta["dominant_id"] is None
    assert "oferta sospechosa" in delta["dominance_motivo"]


@pytest.mark.parametrize(
    ("field", "value", "keyword"),
    [
        ("tender_id", "other", "expediente"),
        ("scope_id", "other-scope", "ámbito"),
        ("basis_key", ("100.00", None, "24", "EUR", "lump_sum"), "base"),
        ("rule_revision", 2, "revisión"),
        ("company_revision", 2, "empresa"),
        ("rivals_fingerprint", "0" * 64, "rivales"),
    ],
)
def test_context_difference_warns_without_dominance(field: str, value: Any, keyword: str) -> None:
    other = _loaded("scn-10b", "Baja 10% otra", **{field: value})
    result = compare_service.compare_loaded([_ten(), other], "scn-10")
    plain = g.CompareResult.model_validate(result).model_dump(mode="json")
    assert plain["status"] == "no_comparable"
    assert len(plain["warnings"]) == 1
    assert keyword in plain["warnings"][0]
    (delta,) = plain["deltas"]
    assert delta["delta_price_net"] is None
    assert delta["delta_profit_net"] is None
    assert delta["delta_score"] is None
    assert delta["dominant_id"] is None
    assert delta["indicator"] == "different_context"


@pytest.mark.parametrize("score_status", ["unknown", "unsupported"])
def test_unknown_score_partial_null_with_motivo(score_status: str) -> None:
    other = _loaded("scn-10b", "Baja 10% sin rivales", score_value=None, score_status=score_status)
    result = compare_service.compare_loaded([_ten(), other], "scn-10")
    plain = g.CompareResult.model_validate(result).model_dump(mode="json")
    assert plain["status"] == "partial"
    assert plain["warnings"] == []
    (delta,) = plain["deltas"]
    assert delta["delta_price_net"] == "0.00"
    assert delta["delta_profit_net"] == "0.00"
    assert delta["delta_score"] is None
    assert delta["delta_score_motivo"] is not None
    assert "no calculamos la diferencia de puntos" in delta["delta_score_motivo"]
    assert delta["cost_per_point_net"] is None
    assert delta["dominant_id"] is None
    assert delta["indicator"] == "unknown"


def test_unknown_profit_partial_null_with_motivo() -> None:
    other = _loaded("scn-10b", "Baja 10% sin coste", profit_net=None)
    result = compare_service.compare_loaded([_ten(), other], "scn-10")
    plain = g.CompareResult.model_validate(result).model_dump(mode="json")
    assert plain["status"] == "partial"
    (delta,) = plain["deltas"]
    assert delta["delta_profit_net"] is None
    assert delta["delta_profit_motivo"] is not None
    assert "Beneficio sin determinar" in delta["delta_profit_motivo"]
    assert delta["delta_score"] == "0.000000000000"
    assert delta["dominant_id"] is None
    assert delta["indicator"] == "unknown"


def test_three_scenarios_compare_against_primary() -> None:
    five = _loaded(
        "scn-05",
        "Baja 5%",
        discount_rate="0.0500",
        price_net="112419.20",
        profit_net="22419.20",
        score_value="46.421052631579",
    )
    result = compare_service.compare_loaded([_fifteen(), _ten(), five], "scn-15")
    plain = g.CompareResult.model_validate(result).model_dump(mode="json")
    assert plain["status"] == "comparable"
    assert [delta["other_id"] for delta in plain["deltas"]] == ["scn-10", "scn-05"]
    assert all(delta["base_id"] == "scn-15" for delta in plain["deltas"])


def test_duplicated_ids_rejected() -> None:
    with pytest.raises(ApiError) as exc:
        compare_service.compare_scenarios(None, ["a", "a"], "a")  # type: ignore[arg-type]
    assert exc.value.status_code == 422
    assert exc.value.code == "compare_invalid_request"


def test_primary_outside_list_rejected() -> None:
    with pytest.raises(ApiError) as exc:
        compare_service.compare_scenarios(None, ["a", "b"], "c")  # type: ignore[arg-type]
    assert exc.value.status_code == 422
    assert exc.value.code == "compare_invalid_request"
