"""Incoherence radar: pairwise observation comparison (PKG-T20).

Pure domain: no I/O, no secrets, Decimal for money. Compares PAIRS of
observations of the same field and reports each mismatch with BOTH
evidences plus a neutral question. It never assigns legal precedence:
the tool asks, the review decides.

Dimension vs version (documented decision):

- Dimension = the six qualifier axes (scope_id, unit, currency,
  tax_basis, period_segment, reference_kind). A pair is comparable only
  when all six are equal; null vs value is incompatible, null vs null
  is compatible (no evidence of a difference, and the question stays
  neutral either way). Incompatible pairs yield ``not_comparable`` with
  the offending axis, so net/gross, PBL/estimated, different lots or
  different segments are NEVER compared.
- Version = document_sha256. Compatible when both sources identify
  their document version (the observation schema always carries it).
  Same-document pairs (one PCAP, pages 10 vs 20) and cross-document
  pairs (PCAP vs PPT) are both comparable: incoherence hides inside a
  single long document as well as across documents, so version never
  blocks. Each finding records ``same_document`` so the copy can name
  it, but neither side wins automatically.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import TYPE_CHECKING, Any, Literal

from bidlab.schemas import observations as obs

if TYPE_CHECKING:
    from collections.abc import Sequence

Verdict = Literal["match", "mismatch", "not_comparable"]

DIMENSION_AXES = (
    "scope_id",
    "unit",
    "currency",
    "tax_basis",
    "period_segment",
    "reference_kind",
)
MONEY_FIELDS = frozenset({"budget_net"})
NUMERIC_FIELDS = frozenset({"budget_net", "period_months", "max_price_points"})
MAX_ITEMS = 50

QUESTIONS = {
    "budget_net": (
        "Dos fuentes citan importes distintos para el mismo concepto. "
        "¿Hablan del mismo importe? Revisa ambas citas antes de confirmar la cifra."
    ),
    "period_months": (
        "¿Ambos documentos hablan de la misma prestación inicial? "
        "Revisa las dos fuentes antes de confirmar el periodo."
    ),
    "max_price_points": (
        "Dos fuentes citan puntos máximos distintos. "
        "¿Hablan del mismo reparto de puntos? Revisa ambas citas antes de confirmar."
    ),
    "pricing_formula_literal": (
        "Dos fuentes describen la fórmula de forma distinta. "
        "¿Hablan de la misma fórmula? Revisa ambas citas antes de confirmar."
    ),
    "anomaly_literal": (
        "Dos fuentes describen la anormalidad de forma distinta. "
        "¿Hablan de la misma regla? Revisa ambas citas antes de confirmar."
    ),
    "other_requirement": (
        "Dos fuentes dicen valores distintos para el mismo requisito. "
        "¿Hablan de lo mismo? Revisa ambas citas antes de confirmar."
    ),
}


@dataclass(frozen=True)
class PairResult:
    field: str
    verdict: Verdict
    reason: str | None
    question: str | None
    same_document: bool
    value_a: str | None
    value_b: str | None


def dimension_gap(first: obs.Observation, second: obs.Observation) -> str | None:
    """First differing qualifier axis, or None when dimensions match."""
    for axis in DIMENSION_AXES:
        if getattr(first.qualifier, axis) != getattr(second.qualifier, axis):
            return f"dimension_{axis}"
    return None


def _as_decimal(raw: str) -> Decimal | None:
    try:
        parsed = Decimal(raw.strip())
    except InvalidOperation:
        return None
    return parsed if parsed.is_finite() else None


def _normalized(raw: str) -> str:
    return " ".join(raw.split()).casefold()


def values_equal(field: str, value_a: str | None, value_b: str | None) -> bool | None:
    """Compare two observation values.

    Returns True/False when comparable, None when unknown (either side
    is null, per unknown=null) or when a money value is unparseable.
    Numeric fields compare as Decimal so "118336.00" equals "118336";
    anything else compares as normalized text.
    """
    if value_a is None or value_b is None:
        return None
    if field in NUMERIC_FIELDS:
        dec_a = _as_decimal(value_a)
        dec_b = _as_decimal(value_b)
        if dec_a is not None and dec_b is not None:
            return dec_a == dec_b
        if field in MONEY_FIELDS:
            return None
    return _normalized(value_a) == _normalized(value_b)


def compare_pair(first: obs.Observation, second: obs.Observation) -> PairResult:
    """Compare one observation pair; never decides precedence."""
    same_document = first.source.document_sha256 == second.source.document_sha256
    if first.field != second.field:
        return PairResult(
            field=first.field,
            verdict="not_comparable",
            reason="different_field",
            question=None,
            same_document=same_document,
            value_a=first.value,
            value_b=second.value,
        )
    gap = dimension_gap(first, second)
    if gap is not None:
        return PairResult(
            field=first.field,
            verdict="not_comparable",
            reason=gap,
            question=None,
            same_document=same_document,
            value_a=first.value,
            value_b=second.value,
        )
    equal = values_equal(first.field, first.value, second.value)
    if equal is None:
        reason = (
            "missing_value" if first.value is None or second.value is None else "unparseable_value"
        )
        return PairResult(
            field=first.field,
            verdict="not_comparable",
            reason=reason,
            question=None,
            same_document=same_document,
            value_a=first.value,
            value_b=second.value,
        )
    if equal:
        return PairResult(
            field=first.field,
            verdict="match",
            reason=None,
            question=None,
            same_document=same_document,
            value_a=first.value,
            value_b=second.value,
        )
    return PairResult(
        field=first.field,
        verdict="mismatch",
        reason=None,
        question=QUESTIONS[first.field],
        same_document=same_document,
        value_a=first.value,
        value_b=second.value,
    )


def _evidence_dict(item: obs.Observation) -> dict[str, Any]:
    return {
        "observation_id": item.id,
        "document_id": item.source.document_id,
        "document_sha256": item.source.document_sha256,
        "physical_page": item.source.physical_page,
        "verbatim_excerpt": item.source.verbatim_excerpt,
        "value": item.value,
    }


def finding_dict(
    field: str,
    first: obs.Observation,
    second: obs.Observation,
    question: str,
    *,
    synthetic: bool,
) -> dict[str, Any]:
    """Transport-shaped mismatch finding (money stays a string)."""
    return {
        "field": field,
        "same_document": first.source.document_sha256 == second.source.document_sha256,
        "evidence_a": _evidence_dict(first),
        "evidence_b": _evidence_dict(second),
        "question": question,
        "synthetic": synthetic,
    }


def scan_pairs(observations: Sequence[obs.Observation]) -> list[dict[str, Any]]:
    """Every mismatch finding across same-field pairs (stable order, capped)."""
    findings: list[dict[str, Any]] = []
    by_field: dict[str, list[obs.Observation]] = {}
    for item in observations:
        by_field.setdefault(item.field, []).append(item)
    for field in sorted(by_field):
        group = by_field[field]
        for pos, first in enumerate(group):
            for second in group[pos + 1 :]:
                result = compare_pair(first, second)
                if result.verdict == "mismatch" and result.question is not None:
                    findings.append(
                        finding_dict(field, first, second, result.question, synthetic=False)
                    )
                    if len(findings) >= MAX_ITEMS:
                        return findings
    return findings


def _synthetic_observation(
    *,
    item_id: str,
    value: str,
    document_id: str,
    document_sha256: str,
    physical_page: int,
    verbatim_excerpt: str,
) -> obs.Observation:
    return obs.Observation.model_validate(
        {
            "id": item_id,
            "field": "period_months",
            "value": value,
            "qualifier": {
                "scope_id": "expediente-p01",
                "unit": "meses",
                "currency": "EUR",
                "tax_basis": "net",
                "period_segment": "initial",
                "reference_kind": "period",
            },
            "source": {
                "document_id": document_id,
                "document_sha256": document_sha256,
                "physical_page": physical_page,
                "verbatim_excerpt": verbatim_excerpt,
                "image_id": None,
                "image_sha256": None,
                "bbox_0_1000": None,
            },
            "status": "proposed",
        }
    )


def synthetic_pair() -> tuple[obs.Observation, obs.Observation]:
    """Labeled synthetic mismatch (mirrors the proposed-radar mock)."""
    return (
        _synthetic_observation(
            item_id="obs-sintetica-pcap",
            value="24",
            document_id="doc-sintetico-pcap",
            document_sha256="0" * 64,
            physical_page=2,
            verbatim_excerpt="Plazo inicial de prestación: 24 meses.",
        ),
        _synthetic_observation(
            item_id="obs-sintetica-ppt",
            value="12",
            document_id="doc-sintetico-ppt",
            document_sha256="1" * 64,
            physical_page=3,
            verbatim_excerpt="Plazo inicial de prestación: 12 meses.",
        ),
    )


def synthetic_example() -> dict[str, Any]:
    """The synthetic finding, produced by the real comparator (never hand-written)."""
    first, second = synthetic_pair()
    result = compare_pair(first, second)
    if result.verdict != "mismatch" or result.question is None:
        msg = f"synthetic pair must mismatch, got {result.verdict}/{result.reason}"
        raise ValueError(msg)
    return finding_dict(first.field, first, second, result.question, synthetic=True)


def build_report(observations: Sequence[obs.Observation]) -> dict[str, Any]:
    """Consistency report: real mismatch items plus the labeled synthetic example."""
    return {"items": scan_pairs(observations), "synthetic_example": synthetic_example()}
