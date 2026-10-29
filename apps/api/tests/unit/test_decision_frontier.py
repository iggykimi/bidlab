"""Pareto classification over scenario economics (BL-V2-05). Pure unit tests."""

from bidlab.services.decision_frontier import FrontierCandidate, classify


def _candidate(
    scenario_id: str,
    name: str,
    profit: str | None,
    score: str | None,
    anomaly: str = "not_flagged_under_assumptions",
) -> FrontierCandidate:
    return FrontierCandidate(
        scenario_id=scenario_id,
        name=name,
        profit_net=profit,
        score_value=score,
        score_defined=score is not None,
        anomaly_status=anomaly,
    )


def test_frontier_motivo_states_exact_dominance_rule() -> None:
    verdicts = classify(
        [
            _candidate("a", "Alta", "200.00", "40.000000000000"),
            _candidate("b", "Baja", "100.00", "30.000000000000"),
        ]
    )
    by_id = {v.scenario_id: v for v in verdicts}
    assert by_id["a"].verdict == "en_frontera"
    assert by_id["a"].motivo == (
        "\u00abAlta\u00bb est\u00e1 en la frontera: ninguna otra iguala o supera "
        "sus puntos y beneficio y mejora al menos uno de los dos."
    )


def test_dominated_pair_names_dominator() -> None:
    verdicts = classify(
        [
            _candidate("a", "Baja 10%", "16502.40", "49.000000000000"),
            _candidate("b", "Baja 15%", "10585.60", "49.000000000000"),
        ]
    )
    by_id = {v.scenario_id: v for v in verdicts}
    assert by_id["a"].verdict == "en_frontera"
    assert by_id["b"].verdict == "dominada"
    assert "Baja 10%" in by_id["b"].motivo


def test_dominated_equal_score_names_same_points() -> None:
    verdicts = classify(
        [
            _candidate("a", "Baja 10%", "16502.40", "49.000000000000"),
            _candidate("b", "Baja 15%", "10585.60", "49.000000000000"),
        ]
    )
    by_id = {v.scenario_id: v for v in verdicts}
    assert by_id["b"].verdict == "dominada"
    assert "mismos puntos" in by_id["b"].motivo
    assert "menos puntos" not in by_id["b"].motivo


def test_dominated_equal_profit_names_same_profit() -> None:
    verdicts = classify(
        [
            _candidate("a", "Alta", "100.00", "40.000000000000"),
            _candidate("b", "Baja", "100.00", "30.000000000000"),
        ]
    )
    by_id = {v.scenario_id: v for v in verdicts}
    assert by_id["b"].verdict == "dominada"
    assert "mismo beneficio" in by_id["b"].motivo
    assert "menos beneficio" not in by_id["b"].motivo


def test_dominated_both_strict_names_both() -> None:
    verdicts = classify(
        [
            _candidate("a", "Alta", "200.00", "40.000000000000"),
            _candidate("b", "Baja", "100.00", "30.000000000000"),
        ]
    )
    by_id = {v.scenario_id: v for v in verdicts}
    assert by_id["b"].verdict == "dominada"
    assert "menos beneficio y menos puntos" in by_id["b"].motivo


def test_ties_all_stay_on_frontier() -> None:
    verdicts = classify(
        [
            _candidate("a", "Una", "100.00", "10.000000000000"),
            _candidate("b", "Otra", "100.00", "10.000000000000"),
        ]
    )
    assert [v.verdict for v in verdicts] == ["en_frontera", "en_frontera"]


def test_tradeoff_pair_both_frontier() -> None:
    verdicts = classify(
        [
            _candidate("a", "Puntos", "100.00", "40.000000000000"),
            _candidate("b", "Beneficio", "200.00", "30.000000000000"),
        ]
    )
    assert [v.verdict for v in verdicts] == ["en_frontera", "en_frontera"]


def test_unknown_figures_excluded_never_zero() -> None:
    verdicts = classify(
        [
            _candidate("a", "Completa", "100.00", "10.000000000000"),
            _candidate("b", "Sin coste", None, "10.000000000000"),
            _candidate("c", "Sin puntos", "100.00", None),
        ]
    )
    by_id = {v.scenario_id: v for v in verdicts}
    assert by_id["a"].verdict == "en_frontera"
    assert by_id["b"].verdict == "excluida"
    assert "beneficio" in by_id["b"].motivo
    assert by_id["c"].verdict == "excluida"
    assert "puntos" in by_id["c"].motivo


def test_flagged_scenario_excluded_with_motivo() -> None:
    verdicts = classify(
        [
            _candidate("a", "Limpia", "100.00", "10.000000000000"),
            _candidate(
                "b",
                "Sospechosa",
                "99999.00",
                "49.000000000000",
                "possible_justification_required",
            ),
        ]
    )
    by_id = {v.scenario_id: v for v in verdicts}
    assert by_id["a"].verdict == "en_frontera"
    assert by_id["b"].verdict == "excluida"
    assert "sospechosa" in by_id["b"].motivo


def test_excluded_never_dominate() -> None:
    # A flagged scenario with huge figures must not push a clean one out.
    verdicts = classify(
        [
            _candidate("a", "Limpia", "100.00", "10.000000000000"),
            _candidate(
                "b",
                "Sospechosa",
                "99999.00",
                "49.000000000000",
                "possible_justification_required",
            ),
        ]
    )
    assert verdicts[0].verdict == "en_frontera"


def test_input_order_preserved() -> None:
    verdicts = classify(
        [
            _candidate("b", "Segunda", "50.00", "5.000000000000"),
            _candidate("a", "Primera", "100.00", "10.000000000000"),
        ]
    )
    assert [v.scenario_id for v in verdicts] == ["b", "a"]
    assert verdicts[0].verdict == "dominada"
    assert verdicts[1].verdict == "en_frontera"
