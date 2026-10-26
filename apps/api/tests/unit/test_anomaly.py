"""U08-U10: Tias 18.5 branches incl. equality-not-triggering and variants."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from bidlab.domain.anomaly import AnomalyError, evaluate_anomaly, evaluate_tias


def _examples() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "examples" / "evaluation_response.json").exists():
            return parent / "examples"
    raise FileNotFoundError("examples/evaluation_response.json not found")


def test_n1_boundary() -> None:
    exact = evaluate_tias("75", ["75"], "100")
    assert exact.branch == "n1"
    assert exact.status == "not_flagged_under_assumptions"
    assert exact.threshold_serialized == "75.000000000000"
    assert exact.reference_offer_count == 1
    below = evaluate_tias("74.99", ["74.99"], "100")
    assert below.status == "possible_justification_required"
    assert below.reason_codes == ("below_threshold",)


def test_n2_boundary() -> None:
    exact = evaluate_tias("80", ["80", "100"], "100")
    assert exact.branch == "n2"
    assert exact.status == "not_flagged_under_assumptions"
    assert exact.threshold_serialized == "80.000000000000"
    below = evaluate_tias("79.99", ["79.99", "100"], "100")
    assert below.status == "possible_justification_required"
    higher = evaluate_tias("100", ["80", "100"], "100")
    assert higher.status == "not_flagged_under_assumptions"
    tie = evaluate_tias("90", ["90", "90"], "100")
    assert tie.status == "not_flagged_under_assumptions"


def test_n3_prune() -> None:
    result = evaluate_tias("70", ["70", "90", "100"], "100")
    assert result.branch == "n3_trimmed"
    assert result.reference_offer_count == 2
    assert result.reference_mean_serialized == "80.000000000000"
    assert result.threshold_serialized == "72.000000000000"
    assert result.status == "possible_justification_required"
    assert "below_relative_threshold" in result.reason_codes


def test_n3_no_trim_on_exact_limit_and_equality() -> None:
    result = evaluate_tias("90", ["90", "100", "110"], "100")
    assert result.branch == "n3_no_trim"
    assert result.reference_mean_serialized == "100.000000000000"
    assert result.threshold_serialized == "90.000000000000"
    assert result.status == "not_flagged_under_assumptions"
    just_below = evaluate_tias("89.99", ["89.99", "105", "105.01"], "200")
    assert just_below.branch == "n3_no_trim"
    assert just_below.threshold_serialized == "90.000000000000"
    assert just_below.status == "possible_justification_required"


def test_n3_absolute_close_tias_only() -> None:
    tias = evaluate_tias("74", ["74", "75", "76"], "100")
    assert tias.status == "possible_justification_required"
    assert "absolute_25_close" in tias.reason_codes
    alfresco = evaluate_tias(
        "74", ["74", "75", "76"], "100", three_bidder_absolute_25=False
    )
    assert alfresco.status == "not_flagged_under_assumptions"
    edge = evaluate_tias("75", ["75", "75", "76"], "100")
    assert edge.status == "not_flagged_under_assumptions"


def test_n4_prune() -> None:
    result = evaluate_tias("50", ["50", "60", "70", "100"], "100")
    assert result.branch == "n4_trimmed"
    assert result.reference_offer_count == 3
    assert result.reference_mean_serialized == "60.000000000000"
    assert result.threshold_serialized == "54.000000000000"
    assert result.status == "possible_justification_required"
    assert result.reason_codes == ("below_relative_threshold",)


def test_n4_fallback_lowest3() -> None:
    result = evaluate_tias("40", ["40", "41", "100", "100"], "100")
    assert result.branch == "n4_fallback_lowest3"
    assert result.reference_offer_count == 3
    assert result.reference_mean_serialized == "60.333333333333"
    assert result.threshold_serialized == "54.300000000000"
    assert result.status == "possible_justification_required"
    equality = evaluate_tias("54.30", ["40", "41", "100", "100"], "100")
    assert equality.threshold_serialized == "54.300000000000"
    assert equality.status == "not_flagged_under_assumptions"


def test_n4_no_trim() -> None:
    result = evaluate_tias("90", ["90", "95", "100", "105"], "100")
    assert result.branch == "n4_no_trim"
    assert result.reference_offer_count == 4
    assert result.reference_mean_serialized == "97.500000000000"
    assert result.threshold_serialized == "87.750000000000"
    assert result.status == "not_flagged_under_assumptions"
    exact_limit = evaluate_tias("90", ["90", "100", "100", "110"], "100")
    assert exact_limit.branch == "n4_no_trim"


def test_prune_runs_once_not_iteratively() -> None:
    result = evaluate_tias("10", ["10", "95", "100", "105", "400"], "100")
    assert result.branch == "n4_trimmed"
    assert result.reference_offer_count == 4
    assert result.reference_mean_serialized == "77.500000000000"


def test_variants_and_reduction() -> None:
    alfresco = evaluate_anomaly(
        "alfresco_18_5", "74", ["74", "75", "76"], "100", policy_id="alfresco-18-5"
    )
    assert alfresco.status == "not_flagged_under_assumptions"
    rglcap = evaluate_anomaly(
        "rglcap85_standard", "74", ["74", "75", "76"], "100", policy_id="rglcap-85"
    )
    assert rglcap.status == "possible_justification_required"
    reduced = evaluate_tias("40", ["40", "41", "100", "100"], "100",
                            percentage_reduction_one_third=True)
    assert reduced.status == "unknown"
    assert reduced.branch is None
    assert reduced.reason_codes == ("unsupported_percentage_reduction",)
    unsupported = evaluate_anomaly(
        "unsupported", "40", ["40", "41"], "100", policy_id="mixed"
    )
    assert unsupported.status == "unknown"
    with pytest.raises(AnomalyError):
        evaluate_anomaly("made_up", "40", ["40"], "100", policy_id="x")


def test_invalid_inputs_rejected() -> None:
    with pytest.raises(AnomalyError):
        evaluate_tias("0", ["0"], "100")
    with pytest.raises(AnomalyError):
        evaluate_tias("50", ["50", "-60"], "100")
    with pytest.raises(AnomalyError):
        evaluate_tias("50", ["50"], "0")
    with pytest.raises(AnomalyError):
        evaluate_tias("50", [], "100")


def test_evaluation_response_oracle() -> None:
    examples = _examples()
    request = json.loads((examples / "evaluation_request.json").read_text(encoding="utf-8"))
    response = json.loads((examples / "evaluation_response.json").read_text(encoding="utf-8"))
    demo = json.loads((examples / "demo_expected.json").read_text(encoding="utf-8"))
    own = response["price_net"]
    offers = [own, *(offer["price_net"] for offer in request["rivals"]["offers"])]
    result = evaluate_tias(own, offers, demo["budget_net"])
    expected = response["anomaly"]
    assert result.status == expected["status"]
    assert result.branch == expected["branch"]
    assert result.reference_mean_serialized == expected["reference_mean_net"]
    assert result.threshold_serialized == expected["threshold_net"]
    assert result.reference_offer_count == expected["reference_offer_count"]
