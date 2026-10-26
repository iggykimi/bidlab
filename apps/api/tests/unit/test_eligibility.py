"""U12-U13: three-valued eligibility truth tables and leaf rules."""

from __future__ import annotations

import pytest
from bidlab.domain.eligibility import (
    And,
    Leaf,
    Not,
    Or,
    Verdict,
    evaluate,
    leaf_from_review,
    leaf_missing_document,
)

MET = Verdict.MET
NOT_MET = Verdict.NOT_MET
UNKNOWN = Verdict.UNKNOWN

AND_TABLE: dict[tuple[Verdict, Verdict], Verdict] = {
    (MET, MET): MET,
    (MET, NOT_MET): NOT_MET,
    (MET, UNKNOWN): UNKNOWN,
    (NOT_MET, MET): NOT_MET,
    (NOT_MET, NOT_MET): NOT_MET,
    (NOT_MET, UNKNOWN): NOT_MET,
    (UNKNOWN, MET): UNKNOWN,
    (UNKNOWN, NOT_MET): NOT_MET,
    (UNKNOWN, UNKNOWN): UNKNOWN,
}

OR_TABLE: dict[tuple[Verdict, Verdict], Verdict] = {
    (MET, MET): MET,
    (MET, NOT_MET): MET,
    (MET, UNKNOWN): MET,
    (NOT_MET, MET): MET,
    (NOT_MET, NOT_MET): NOT_MET,
    (NOT_MET, UNKNOWN): UNKNOWN,
    (UNKNOWN, MET): MET,
    (UNKNOWN, NOT_MET): UNKNOWN,
    (UNKNOWN, UNKNOWN): UNKNOWN,
}


@pytest.mark.parametrize(("left", "right", "expected"), [
    (left, right, expected) for (left, right), expected in AND_TABLE.items()
])
def test_and_truth_table(left: Verdict, right: Verdict, expected: Verdict) -> None:
    assert evaluate(And(children=(Leaf(left), Leaf(right)))) is expected


@pytest.mark.parametrize(("left", "right", "expected"), [
    (left, right, expected) for (left, right), expected in OR_TABLE.items()
])
def test_or_truth_table(left: Verdict, right: Verdict, expected: Verdict) -> None:
    assert evaluate(Or(children=(Leaf(left), Leaf(right)))) is expected


@pytest.mark.parametrize(("given", "expected"), [
    (MET, NOT_MET),
    (NOT_MET, MET),
    (UNKNOWN, UNKNOWN),
])
def test_not_truth_table(given: Verdict, expected: Verdict) -> None:
    assert evaluate(Not(child=Leaf(given))) is expected


def test_named_matrix_rows() -> None:
    assert evaluate(Or(children=(Leaf(MET), Leaf(UNKNOWN)))) is MET
    assert evaluate(Or(children=(Leaf(NOT_MET), Leaf(UNKNOWN)))) is UNKNOWN
    assert evaluate(And(children=(Leaf(MET), Leaf(UNKNOWN)))) is UNKNOWN


def test_nested_composition() -> None:
    assert evaluate(And(children=(
        Or(children=(Leaf(NOT_MET), Leaf(UNKNOWN))), Leaf(MET),
    ))) is UNKNOWN
    assert evaluate(Or(children=(
        And(children=(Leaf(MET), Leaf(UNKNOWN))), Leaf(NOT_MET),
    ))) is UNKNOWN
    assert evaluate(And(children=(
        Or(children=(Leaf(NOT_MET), Leaf(UNKNOWN))), Leaf(NOT_MET),
    ))) is NOT_MET
    assert evaluate(Not(child=And(children=(Leaf(MET),)))) is NOT_MET


def test_empty_groups_are_vacuous() -> None:
    assert evaluate(And(children=())) is MET
    assert evaluate(Or(children=())) is NOT_MET


@pytest.mark.parametrize(("approved", "sufficient", "met", "expected"), [
    (True, True, True, MET),
    (True, True, False, NOT_MET),
    (True, True, None, UNKNOWN),
    (True, False, True, UNKNOWN),
    (True, False, False, UNKNOWN),
    (False, True, True, UNKNOWN),
    (False, False, None, UNKNOWN),
])
def test_leaf_from_review(
    approved: bool, sufficient: bool, met: bool | None, expected: Verdict
) -> None:
    leaf = leaf_from_review(rule_approved=approved, evidence_sufficient=sufficient, value_met=met)
    assert leaf.verdict is expected


def test_missing_document_is_unknown_never_not_met() -> None:
    assert leaf_missing_document().verdict is UNKNOWN
    assert evaluate(leaf_from_review(
        rule_approved=True, evidence_sufficient=False, value_met=False
    )) is UNKNOWN
