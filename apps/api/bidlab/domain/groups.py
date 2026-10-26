"""Group-aware anomaly references (LCSP 149.3 minima per group).

Anomaly references use the lowest offer of each confirmed group; two rivals in
the same group are not two independent observations. Scoring keeps every
declared offer and never dedups by group. Unknown group data yields unknown
anomaly references while scoring stays defined.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Literal

from bidlab.domain.money import DecimalInput, parse_decimal

GroupStatus = Literal["resolved", "unknown"]


class GroupsError(ValueError):
    """Invalid group input (API maps these to 422)."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class Offer:
    price: Decimal
    group_id: str | None
    label: str = ""


@dataclass(frozen=True)
class GroupResolution:
    status: GroupStatus
    reference_offers: tuple[Decimal, ...]
    reference_offer_count: int
    reason_codes: tuple[str, ...] = field(default_factory=tuple)
    trace: tuple[str, ...] = field(default_factory=tuple)


def make_offer(
    price: DecimalInput, group_id: str | None, label: str = ""
) -> Offer:
    """Build a validated declared offer (price must be > 0)."""
    amount = parse_decimal(price, field=label or "price_net")
    if amount <= 0:
        raise GroupsError("offer_not_positive", f"{label or 'offer'}: must be > 0")
    return Offer(price=amount, group_id=group_id, label=label)


def _normalize_group(group_id: str | None) -> str | None:
    if group_id is None:
        return None
    stripped = group_id.strip()
    return stripped or None


def resolve_anomaly_references(
    own_price: DecimalInput,
    own_group_id: str | None,
    rivals: Sequence[Offer],
    *,
    confirmed: bool,
) -> GroupResolution:
    """Lowest offer per confirmed group, sorted ascending, with group trace."""
    own = parse_decimal(own_price, field="own_price")
    if own <= 0:
        raise GroupsError("offer_not_positive", "own_price: must be > 0")
    for offer in rivals:
        if offer.price <= 0:
            raise GroupsError("offer_not_positive", f"{offer.label or 'rival'}: must be > 0")
    if not confirmed:
        return GroupResolution(
            status="unknown",
            reference_offers=(),
            reference_offer_count=0,
            reason_codes=("group_membership_unconfirmed",),
            trace=("group membership not confirmed; anomaly needs review",),
        )
    groups: dict[str, list[Decimal]] = {}
    own_group = _normalize_group(own_group_id)
    if own_group is None:
        return GroupResolution(
            status="unknown",
            reference_offers=(),
            reference_offer_count=0,
            reason_codes=("incomplete_group_data",),
            trace=("own group unknown; scoring stays defined",),
        )
    groups.setdefault(own_group, []).append(own)
    for offer in rivals:
        group = _normalize_group(offer.group_id)
        if group is None:
            return GroupResolution(
                status="unknown",
                reference_offers=(),
                reference_offer_count=0,
                reason_codes=("incomplete_group_data",),
                trace=(f"group unknown for {offer.label or 'a rival'}; scoring stays defined",),
            )
        groups.setdefault(group, []).append(offer.price)
    minima: list[Decimal] = []
    steps: list[str] = []
    for group in sorted(groups):
        members = groups[group]
        lowest = min(members)
        minima.append(lowest)
        rendered = ", ".join(format(p, "f") for p in sorted(members))
        steps.append(f"group '{group}': min({rendered}) = {format(lowest, 'f')}")
    ordered = tuple(sorted(minima))
    return GroupResolution(
        status="resolved",
        reference_offers=ordered,
        reference_offer_count=len(ordered),
        reason_codes=(),
        trace=tuple(steps),
    )


def offers_for_scoring(
    own_price: DecimalInput, rivals: Sequence[Offer]
) -> tuple[Decimal, ...]:
    """Every declared offer including own; scoring never dedups by group."""
    own = parse_decimal(own_price, field="own_price")
    return (own, *(offer.price for offer in rivals))
