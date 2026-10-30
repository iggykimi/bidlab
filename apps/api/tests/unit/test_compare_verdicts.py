"""Direct verdict tests for compare wording (BL-V3 P1-01).

Pins exact sentences for ties: equal points say "mismos puntos", equal
profit never claims "more". White-box on _indicator/_dominance because the
ds==0/dp==0 tie is unreachable through _pair_delta with equal costs.
"""

from bidlab.services.compare import LoadedScenario, _dominance, _indicator


def _entry(
    name: str,
    price: str,
    profit: str | None,
    score: str | None,
    anomaly: str = "not_flagged_under_assumptions",
) -> LoadedScenario:
    return LoadedScenario(
        scenario_id=f"id-{name}",
        name=name,
        tender_id="t1",
        scope_id="s1",
        rule_id="r1",
        rule_revision=1,
        company_id="c1",
        company_revision=1,
        basis_key=(None, None, None, None, None),
        budget_net="118336.00",
        rivals_fingerprint="fp",
        rivals_count=2,
        discount_rate="0.1000",
        price_net=price,
        profit_net=profit,
        score_value=score,
        score_status="defined" if score is not None else "unknown",
        anomaly_status=anomaly,
    )


def test_tie_same_score_same_profit_states_tie() -> None:
    code, text = _indicator(
        _entry("A", "100.00", "10.00", "49"), _entry("B", "110.00", "10.00", "49"), "0.00", "0"
    )
    assert code == "same_price_score"
    assert "mismos puntos" in text and "mismo beneficio" in text
    assert "más de beneficio" not in text


def test_same_score_higher_profit_keeps_golden_sentence() -> None:
    code, text = _indicator(
        _entry("Demo 15", "100585.60", "10585.60", "49"),
        _entry("Demo 10", "106502.40", "16502.40", "49"),
        "5916.80",
        "0",
    )
    assert code == "higher_profit_same_score"
    assert text == "«Demo 10» conserva 5.916,80\u00a0€ más de beneficio con los mismos puntos."


def test_same_profit_names_same_benefit() -> None:
    code, text = _indicator(
        _entry("A", "100.00", "10.00", "47"), _entry("B", "110.00", "10.00", "49"), "0.00", "2"
    )
    assert code == "tradeoff"
    assert "mismo beneficio" in text


def test_dominance_tie_names_no_winner() -> None:
    winner, text = _dominance(
        _entry("A", "100.00", "10.00", "49"), _entry("B", "110.00", "10.00", "49"), True, True
    )
    assert winner is None
    assert text == "Ninguna prueba supera a la otra en beneficio y puntos en este caso."
