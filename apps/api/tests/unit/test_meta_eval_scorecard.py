"""Local unit tests for the standalone eval aggregator, not for Meta itself."""

import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "scripts"))
from meta_eval_scorecard import (  # type: ignore[import-not-found]  # noqa: E402
    ScorecardError,
    evaluate,
    template,
)


def _gold():
    return {
        "schema_version": "1",
        "cases": [
            {
                "id": "S01",
                "expected_field_page_values": [
                    {"field": "budget_net", "value": "100.00", "physical_page": 1},
                ],
            },
            {"id": "S02", "expected_field_page_values": []},
        ],
    }


def test_empty_template_is_blocked_and_has_no_accuracy() -> None:
    result = evaluate(_gold(), template(_gold()))
    assert result["evaluated_cases"] == 0
    assert result["blocked_cases"] == 2
    assert result["field_precision"] is None
    assert result["field_recall"] is None


def test_mixed_case_scores_and_citation_review() -> None:
    notes = template(_gold())
    notes["cases"][0].update(
        status="evaluated",
        observations=[
            {
                "field": "budget_net",
                "value": "100",
                "physical_page": 1,
                "citation_verified_by_human": True,
            },
            {
                "field": "period_months",
                "value": "24",
                "physical_page": 1,
                "citation_verified_by_human": False,
            },
        ],
        manual_critical_errors=[],
    )
    result = evaluate(_gold(), notes)
    assert result["tp"] == 1
    assert result["fp"] == 1
    assert result["fn"] == 0
    assert result["field_precision"] == 0.5
    assert result["citation_valid_rate"] == 0.5
    assert result["blocked_cases"] == 1


def test_misreported_citation_must_have_manual_check() -> None:
    notes = template(_gold())
    notes["cases"][0].update(
        status="evaluated",
        observations=[{"field": "budget_net", "value": "100", "physical_page": 1}],
        manual_critical_errors=[],
    )
    with pytest.raises(ScorecardError, match="human citation"):
        evaluate(_gold(), notes)


def test_unknown_case_rejected() -> None:
    notes = template(_gold())
    notes["cases"].append({"id": "S999", "status": "blocked"})
    with pytest.raises(ScorecardError, match="unknown"):
        evaluate(_gold(), notes)
