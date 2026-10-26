"""U11: group minima for anomaly references; scoring keeps every declared offer."""

from __future__ import annotations

from decimal import Decimal

import pytest
from bidlab.domain.anomaly import evaluate_tias
from bidlab.domain.expressions import template_for
from bidlab.domain.groups import (
    GroupsError,
    make_offer,
    offers_for_scoring,
    resolve_anomaly_references,
)
from bidlab.domain.scoring import evaluate_score


def test_minimum_per_group() -> None:
    rivals = [
        make_offer("100", "g1", "A1"),
        make_offer("90", "g1", "A2"),
        make_offer("95", "g2", "B"),
    ]
    result = resolve_anomaly_references("100", "own", rivals, confirmed=True)
    assert result.status == "resolved"
    assert result.reference_offers == (Decimal("90"), Decimal("95"), Decimal("100"))
    assert result.reference_offer_count == 3
    assert len(result.trace) == 3
    assert "group 'g1'" in result.trace[0]


def test_same_group_not_two_observations() -> None:
    rivals = [
        make_offer("60", "g", "A1"),
        make_offer("61", "g", "A2"),
        make_offer("100", "h", "B"),
    ]
    resolved = resolve_anomaly_references("100", "own", rivals, confirmed=True)
    assert resolved.reference_offers == (Decimal("60"), Decimal("100"), Decimal("100"))
    anomaly = evaluate_tias("100", resolved.reference_offers, "100")
    assert anomaly.branch == "n3_trimmed"
    assert anomaly.reference_offer_count == 2
    assert anomaly.reference_mean_serialized == "80.000000000000"
    assert anomaly.status == "not_flagged_under_assumptions"


def test_scoring_keeps_all_declared_offers() -> None:
    rivals = [
        make_offer("60", "g", "A1"),
        make_offer("61", "g", "A2"),
        make_offer("100", "h", "B"),
    ]
    all_offers = offers_for_scoring("100", rivals)
    assert all_offers == (Decimal("100"), Decimal("60"), Decimal("61"), Decimal("100"))
    result = evaluate_score(
        template_for("proportional_inverse"),
        "49",
        all_offers[0],
        all_offers[1:],
        complete=True,
    )
    assert result.status == "defined"
    assert result.value_serialized == "29.400000000000"


def test_unknown_group_keeps_score_defined() -> None:
    rivals = [
        make_offer("90", "g1", "A"),
        make_offer("95", None, "B"),
    ]
    resolved = resolve_anomaly_references("100", "own", rivals, confirmed=True)
    assert resolved.status == "unknown"
    assert resolved.reference_offers == ()
    assert resolved.reason_codes == ("incomplete_group_data",)
    scored = evaluate_score(
        template_for("proportional_inverse"),
        "49",
        "100",
        [offer.price for offer in rivals],
        complete=True,
    )
    assert scored.status == "defined"
    assert scored.value_serialized == "44.100000000000"


def test_unconfirmed_or_blank_groups() -> None:
    rivals = [make_offer("90", "g1", "A")]
    pending = resolve_anomaly_references("100", "own", rivals, confirmed=False)
    assert pending.status == "unknown"
    assert pending.reason_codes == ("group_membership_unconfirmed",)
    no_own = resolve_anomaly_references("100", None, rivals, confirmed=True)
    assert no_own.status == "unknown"
    blank = resolve_anomaly_references("100", "  ", rivals, confirmed=True)
    assert blank.status == "unknown"


def test_invalid_offer_prices() -> None:
    with pytest.raises(GroupsError):
        make_offer("0", "g", "A")
    with pytest.raises(GroupsError):
        make_offer("-5", "g", "A")
    with pytest.raises(GroupsError):
        resolve_anomaly_references("0", "own", [], confirmed=True)
