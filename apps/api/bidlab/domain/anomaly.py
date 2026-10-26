"""Abnormality presumption: Tias 18.5 branches (exact) plus close variants.

Implements an objective presumption condition only; it never declares
inadmission/exclusion. Strict comparators throughout (threshold equality never
triggers). Means/thresholds are compared at full Decimal precision, never
quantized to cents first. Pruning runs once, never iteratively.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import TYPE_CHECKING, Literal

from bidlab.domain.money import DecimalInput, arithmetic, parse_decimal, serialize_12dp

if TYPE_CHECKING:
    from collections.abc import Sequence

AnomalyStatus = Literal[
    "unknown",
    "not_applicable",
    "possible_justification_required",
    "not_flagged_under_assumptions",
]

AnomalyVariant = Literal["tias_18_5", "alfresco_18_5", "rglcap85_standard", "unsupported"]

_RATE_075 = Decimal("0.75")
_RATE_080 = Decimal("0.80")
_RATE_090 = Decimal("0.90")
_RATE_110 = Decimal("1.10")


class AnomalyError(ValueError):
    """Invalid anomaly input (API maps these to 422)."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class AnomalyResult:
    status: AnomalyStatus
    policy_id: str
    branch: str | None
    reference_mean: Decimal | None
    threshold: Decimal | None
    reference_offer_count: int
    reason_codes: tuple[str, ...] = field(default_factory=tuple)
    trace: tuple[str, ...] = field(default_factory=tuple)

    @property
    def reference_mean_serialized(self) -> str | None:
        if self.reference_mean is None:
            return None
        return serialize_12dp(self.reference_mean)

    @property
    def threshold_serialized(self) -> str | None:
        if self.threshold is None:
            return None
        return serialize_12dp(self.threshold)


def _mean(values: Sequence[Decimal]) -> Decimal:
    with arithmetic():
        result = sum(values, Decimal(0)) / Decimal(len(values))
    if not result.is_finite():
        raise AnomalyError("non_finite", "anomaly: non-finite mean")
    return result


def _render(value: Decimal) -> str:
    return format(value, "f")


def evaluate_tias(
    own_price: DecimalInput,
    offers: Sequence[DecimalInput],
    base: DecimalInput,
    *,
    policy_id: str = "tias-18-5",
    three_bidder_absolute_25: bool = True,
    percentage_reduction_one_third: bool = False,
) -> AnomalyResult:
    """Tias 18.5 branches for n = len(offers); offers include every valid price.

    Set three_bidder_absolute_25=False for the Alfresco variant (no n=3 close).
    threshold_net reports the relative threshold; the absolute 25% close (n=3
    only) is carried by reason code + trace.
    """
    if percentage_reduction_one_third:
        return AnomalyResult(
            status="unknown",
            policy_id=policy_id,
            branch=None,
            reference_mean=None,
            threshold=None,
            reference_offer_count=0,
            reason_codes=("unsupported_percentage_reduction",),
            trace=("one-third percentage reduction requested but not implemented",),
        )
    own = parse_decimal(own_price, field="own_price")
    if own <= 0:
        raise AnomalyError("offer_not_positive", "own_price: must be > 0")
    approved = parse_decimal(base, field="base")
    if approved <= 0:
        raise AnomalyError("base_not_positive", "base: must be > 0")
    prices: list[Decimal] = []
    for index, raw in enumerate(offers):
        price = parse_decimal(raw, field=f"offers[{index}]")
        if price <= 0:
            raise AnomalyError("offer_not_positive", f"offers[{index}]: must be > 0")
        prices.append(price)
    if not prices:
        raise AnomalyError("empty_offer_set", "offers: at least one price required")
    count = len(prices)

    def finish(
        is_flagged: bool,
        branch: str,
        ref_mean: Decimal,
        threshold: Decimal,
        ref_count: int,
        reasons: tuple[str, ...],
        trace: tuple[str, ...],
    ) -> AnomalyResult:
        status: AnomalyStatus = (
            "possible_justification_required" if is_flagged else "not_flagged_under_assumptions"
        )
        return AnomalyResult(
            status=status,
            policy_id=policy_id,
            branch=branch,
            reference_mean=ref_mean,
            threshold=threshold,
            reference_offer_count=ref_count,
            reason_codes=reasons if is_flagged else (),
            trace=trace,
        )

    if count == 1:
        with arithmetic():
            threshold = _RATE_075 * approved
        is_flagged = own < threshold
        return finish(
            is_flagged,
            "n1",
            approved,
            threshold,
            1,
            ("below_threshold",),
            (
                f"n=1 offers=[{_render(prices[0])}] base={_render(approved)}",
                f"strict: own={_render(own)} < 0.75*base={_render(threshold)} -> {is_flagged}",
            ),
        )
    if count == 2:
        low = min(prices)
        high = max(prices)
        other = high if own <= low else low
        with arithmetic():
            threshold = _RATE_080 * other
        is_lower = own <= low
        is_flagged = is_lower and own < threshold
        detail = (
            f"own is the lower offer; strict: own={_render(own)} < 0.80*other={_render(threshold)}"
            if is_lower
            else f"own is not the lower offer (lower={_render(low)}); cannot trigger"
        )
        return finish(
            is_flagged,
            "n2",
            other,
            threshold,
            2,
            ("below_threshold",),
            (
                f"n=2 offers=[{', '.join(_render(p) for p in sorted(prices))}]",
                f"{detail} -> {is_flagged}",
            ),
        )
    if count == 3:
        initial = _mean(prices)
        with arithmetic():
            limit = _RATE_110 * initial
        rest = list(prices)
        highest = max(prices)
        if highest > limit:
            rest.remove(highest)
            ref_mean = _mean(rest)
            branch = "n3_trimmed"
            ref_count = 2
            removed: tuple[str, ...] = (f"removed one maximum {_render(highest)}",)
        else:
            ref_mean = initial
            branch = "n3_no_trim"
            ref_count = 3
            removed = ("no trim: maximum not strictly above 1.10*mean",)
        with arithmetic():
            threshold = _RATE_090 * ref_mean
            absolute = _RATE_075 * approved
        relative_hit = own < threshold
        absolute_hit = three_bidder_absolute_25 and own < absolute
        is_flagged = relative_hit or absolute_hit
        reasons: list[str] = []
        if relative_hit:
            reasons.append("below_relative_threshold")
        if absolute_hit:
            reasons.append("absolute_25_close")
        return finish(
            is_flagged,
            branch,
            ref_mean,
            threshold,
            ref_count,
            tuple(reasons),
            (
                f"n=3 initial_mean={_render(initial)} limit_1.10={_render(limit)}",
                *removed,
                f"strict: own={_render(own)} < 0.90*mean={_render(threshold)} -> {relative_hit}",
                f"absolute25={'on' if three_bidder_absolute_25 else 'off'}: "
                f"own={_render(own)} < 0.75*base={_render(absolute)} -> {absolute_hit}",
            ),
        )
    initial = _mean(prices)
    with arithmetic():
        limit = _RATE_110 * initial
    remaining = [p for p in prices if p <= limit]
    excluded = [p for p in prices if p > limit]
    if len(remaining) >= 3:
        ref_mean = _mean(remaining)
        ref_count = len(remaining)
        branch = "n4_trimmed" if excluded else "n4_no_trim"
        step = (
            f"excluded from mean: [{', '.join(_render(p) for p in sorted(excluded))}]"
            if excluded
            else "no trim: no offer strictly above 1.10*mean"
        )
    else:
        lowest3 = sorted(prices)[:3]
        ref_mean = _mean(lowest3)
        ref_count = 3
        branch = "n4_fallback_lowest3"
        step = (
            f"fewer than 3 remaining; fallback mean of lowest 3: "
            f"[{', '.join(_render(p) for p in lowest3)}]"
        )
    with arithmetic():
        threshold = _RATE_090 * ref_mean
    is_flagged = own < threshold
    return finish(
        is_flagged,
        branch,
        ref_mean,
        threshold,
        ref_count,
        ("below_relative_threshold",),
        (
            f"n={count} initial_mean={_render(initial)} limit_1.10={_render(limit)}",
            step,
            f"strict: own={_render(own)} < 0.90*mean={_render(threshold)} -> {is_flagged}",
        ),
    )


def evaluate_anomaly(
    variant: AnomalyVariant | str,
    own_price: DecimalInput,
    offers: Sequence[DecimalInput],
    base: DecimalInput,
    *,
    policy_id: str,
    percentage_reduction_one_third: bool = False,
    three_bidder_absolute_25: bool | None = None,
) -> AnomalyResult:
    """Dispatch a reviewed variant; unknown variants are programmer errors (raise).

    Variant defaults for the n=3 absolute-25 close: Tías on; Alfresco and
    RGLCAP85 off (P0: RGLCAP85 applicability unverified, T22). An explicit
    three_bidder_absolute_25 overrides the default (reviewed policy decision).
    """
    if variant == "tias_18_5":
        close = True if three_bidder_absolute_25 is None else three_bidder_absolute_25
        return evaluate_tias(
            own_price,
            offers,
            base,
            policy_id=policy_id,
            three_bidder_absolute_25=close,
            percentage_reduction_one_third=percentage_reduction_one_third,
        )
    if variant == "rglcap85_standard":
        close = False if three_bidder_absolute_25 is None else three_bidder_absolute_25
        return evaluate_tias(
            own_price,
            offers,
            base,
            policy_id=policy_id,
            three_bidder_absolute_25=close,
            percentage_reduction_one_third=percentage_reduction_one_third,
        )
    if variant == "alfresco_18_5":
        close = False if three_bidder_absolute_25 is None else three_bidder_absolute_25
        return evaluate_tias(
            own_price,
            offers,
            base,
            policy_id=policy_id,
            three_bidder_absolute_25=close,
            percentage_reduction_one_third=percentage_reduction_one_third,
        )
    if variant == "unsupported":
        return AnomalyResult(
            status="not_applicable",
            policy_id=policy_id,
            branch=None,
            reference_mean=None,
            threshold=None,
            reference_offer_count=0,
            reason_codes=("unsupported_variant",),
            trace=("variant has no implemented policy; needs review",),
        )
    raise AnomalyError("unknown_variant", f"variant: unknown id {variant!r}")
