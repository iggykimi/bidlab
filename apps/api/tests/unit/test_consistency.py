"""PKG-T20: radar de incoherencias con dos evidencias (comparador puro)."""

from typing import Any

import pytest
from bidlab.schemas import observations as obs
from bidlab.services import consistency as co

DOC_A = "a" * 64
DOC_B = "b" * 64


def _qualifier(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "scope_id": "scope-1",
        "unit": "EUR",
        "currency": "EUR",
        "tax_basis": "net",
        "period_segment": "initial",
        "reference_kind": "pbl",
    }
    base.update(overrides)
    return base


def _source(doc_id: str, sha: str, page: int) -> dict[str, Any]:
    return {
        "document_id": doc_id,
        "document_sha256": sha,
        "physical_page": page,
        "verbatim_excerpt": f"cita {doc_id} p.{page}",
        "image_id": None,
        "image_sha256": None,
        "bbox_0_1000": None,
    }


def _observation(
    item_id: str,
    field: str,
    value: Any,
    doc_id: str = "doc-a",
    sha: str = DOC_A,
    page: int = 10,
    **qualifier: Any,
) -> obs.Observation:
    return obs.Observation.model_validate(
        {
            "id": item_id,
            "field": field,
            "value": value,
            "qualifier": _qualifier(**qualifier),
            "source": _source(doc_id, sha, page),
            "status": "proposed",
        }
    )


def test_net_vs_gross_never_compared() -> None:
    first = _observation("o1", "budget_net", "100.00", tax_basis="net")
    second = _observation("o2", "budget_net", "121.00", tax_basis="gross")
    result = co.compare_pair(first, second)
    assert result.verdict == "not_comparable"
    assert result.reason == "dimension_tax_basis"
    assert result.question is None


def test_pbl_vs_estimated_never_compared() -> None:
    first = _observation("o1", "budget_net", "118336.00", reference_kind="pbl")
    second = _observation("o2", "budget_net", "295840.00", reference_kind="estimated")
    result = co.compare_pair(first, second)
    assert result.verdict == "not_comparable"
    assert result.reason == "dimension_reference_kind"


def test_different_lots_never_compared() -> None:
    first = _observation("o1", "budget_net", "100.00", scope_id="lot-1")
    second = _observation("o2", "budget_net", "200.00", scope_id="lot-2")
    result = co.compare_pair(first, second)
    assert result.verdict == "not_comparable"
    assert result.reason == "dimension_scope_id"


def test_initial_vs_extension_never_compared() -> None:
    first = _observation("o1", "period_months", "24", period_segment="initial")
    second = _observation("o2", "period_months", "12", period_segment="extension")
    result = co.compare_pair(first, second)
    assert result.verdict == "not_comparable"
    assert result.reason == "dimension_period_segment"


def test_null_vs_value_is_incompatible() -> None:
    first = _observation("o1", "budget_net", "100.00", tax_basis=None)
    second = _observation("o2", "budget_net", "100.00", tax_basis="net")
    result = co.compare_pair(first, second)
    assert result.verdict == "not_comparable"
    assert result.reason == "dimension_tax_basis"


def test_unit_and_currency_gaps_block() -> None:
    unit_a = _observation("o1", "budget_net", "100.00", unit="EUR")
    unit_b = _observation("o2", "budget_net", "100.00", unit="lump_sum")
    assert co.compare_pair(unit_a, unit_b).reason == "dimension_unit"
    cur_a = _observation("o1", "budget_net", "100.00", currency="EUR")
    cur_b = _observation("o2", "budget_net", "100.00", currency="USD")
    assert co.compare_pair(cur_a, cur_b).reason == "dimension_currency"


def test_different_fields_never_compared() -> None:
    first = _observation("o1", "budget_net", "24")
    second = _observation("o2", "period_months", "24")
    result = co.compare_pair(first, second)
    assert result.verdict == "not_comparable"
    assert result.reason == "different_field"


def test_missing_value_is_not_comparable_not_zero() -> None:
    first = _observation("o1", "budget_net", None)
    second = _observation("o2", "budget_net", "0.00")
    result = co.compare_pair(first, second)
    assert result.verdict == "not_comparable"
    assert result.reason == "missing_value"


def test_unparseable_money_is_not_comparable() -> None:
    first = _observation("o1", "budget_net", "ciento dieciocho mil")
    second = _observation("o2", "budget_net", "118336.00")
    result = co.compare_pair(first, second)
    assert result.verdict == "not_comparable"
    assert result.reason == "unparseable_value"


def test_money_uses_decimal_equality() -> None:
    first = _observation("o1", "budget_net", "118336.00")
    second = _observation("o2", "budget_net", "118336")
    assert co.compare_pair(first, second).verdict == "match"


def test_mismatch_carries_both_sources_and_neutral_question() -> None:
    first = _observation("o1", "budget_net", "118336.00", page=10)
    second = _observation("o2", "budget_net", "120000.00", doc_id="doc-b", sha=DOC_B, page=20)
    result = co.compare_pair(first, second)
    assert result.verdict == "mismatch"
    assert result.reason is None
    assert result.same_document is False
    assert result.question is not None
    lowered = result.question.lower()
    assert "pcap" not in lowered and "ppt" not in lowered
    assert "prevalece" not in lowered and "correcto" not in lowered
    finding = co.finding_dict(first.field, first, second, result.question, synthetic=False)
    assert finding["evidence_a"]["verbatim_excerpt"] == "cita doc-a p.10"
    assert finding["evidence_b"]["verbatim_excerpt"] == "cita doc-b p.20"
    assert finding["evidence_a"]["physical_page"] == 10
    assert finding["evidence_b"]["physical_page"] == 20
    assert finding["synthetic"] is False


def test_same_document_pairs_are_comparable() -> None:
    first = _observation("o1", "period_months", "24", page=10)
    second = _observation("o2", "period_months", "12", page=20)
    result = co.compare_pair(first, second)
    assert result.verdict == "mismatch"
    assert result.same_document is True


def test_scan_only_reports_mismatches() -> None:
    items = [
        _observation("o1", "period_months", "24", page=10),
        _observation("o2", "period_months", "12", page=20),
        _observation("o3", "period_months", "24", page=21),
        _observation("o4", "budget_net", "100.00", page=10),
    ]
    findings = co.scan_pairs(items)
    assert len(findings) == 2  # (o1,o2) and (o2,o3); (o1,o3) matches
    assert all(item["synthetic"] is False for item in findings)
    assert all(item["question"] for item in findings)


def test_synthetic_example_is_a_genuine_comparator_output() -> None:
    first, second = co.synthetic_pair()
    direct = co.compare_pair(first, second)
    assert direct.verdict == "mismatch"
    example = co.synthetic_example()
    assert example["synthetic"] is True
    assert example["field"] == "period_months"
    assert example["question"] == direct.question
    assert example["evidence_a"]["value"] == "24"
    assert example["evidence_b"]["value"] == "12"


def test_build_report_shape() -> None:
    report = co.build_report(())
    assert report["items"] == []
    assert report["synthetic_example"]["synthetic"] is True


@pytest.mark.parametrize(
    "field",
    [
        "budget_net",
        "period_months",
        "max_price_points",
        "pricing_formula_literal",
        "anomaly_literal",
        "other_requirement",
    ],
)
def test_every_field_has_a_neutral_question(field: str) -> None:
    assert field in co.QUESTIONS
    assert "?" in co.QUESTIONS[field]
