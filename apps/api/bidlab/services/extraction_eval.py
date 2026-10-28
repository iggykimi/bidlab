"""Score text/hybrid extractors against the human gold (PKG-T10).

The gold (``examples/gold_claims.json``) is a human annotation over PCAP
pages, never model output. The split (``evidence/evaluation_split.json``)
quarantines the development expediente (Tias, the curated seed case) so
its pages never score, and holds out four expedientes for evaluation.

Scoring rules, enforced here and nowhere else:

* Dev claims are excluded from the denominator *before* scoring.
* Every eval claim counts in the denominator, including claims the
  extractor reports as ``unsupported`` and claims with no prediction.
* Money-like values compare as :class:`Decimal` (``"295840"`` equals
  ``"295840.00``); anything else compares as an exact string.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Literal

GOLD_KIND = "manual_initial_gold"
SPLIT_VERSION = 1

SplitName = Literal["dev", "eval"]
Verdict = Literal["hit", "miss", "unsupported"]
PredictionStatus = Literal["supported", "unsupported"]

#: Gold units whose values are compared as Decimal, not as raw strings.
NUMERIC_UNITS = frozenset({"EUR", "points", "months", "years", "pages", "rate", "dimensionless"})


@dataclass(frozen=True)
class GoldClaim:
    """One human-annotated fact with its exact source."""

    claim_id: str
    document_file: str
    document_sha256: str
    page_number: int
    field: str
    expected_value: str
    unit: str
    expected_review_state: str
    quote_normalized: str


@dataclass(frozen=True)
class SplitAssignment:
    """Split label of one gold claim, with source cross-check fields."""

    claim_id: str
    expediente_id: str
    document_file: str
    page_number: int
    split: SplitName


@dataclass(frozen=True)
class EvalSplit:
    """Parsed dev/eval partition over the gold claim ids."""

    version: int
    rule: str
    assignments: dict[str, SplitAssignment]


@dataclass(frozen=True)
class Prediction:
    """One normalized extractor answer for one gold claim."""

    claim_id: str
    value: str | None
    status: PredictionStatus


@dataclass(frozen=True)
class ClaimScore:
    """Verdict of one eval claim."""

    claim_id: str
    verdict: Verdict
    expected_value: str
    predicted_value: str | None


@dataclass(frozen=True)
class ScoreResult:
    """Whole-run metric. The denominator is every eval claim."""

    scores: tuple[ClaimScore, ...]
    n_eval: int
    n_hit: int
    n_miss: int
    n_unsupported: int
    accuracy: Decimal

    def to_dict(self) -> dict[str, Any]:
        """JSON-safe view (Decimal rendered as a string)."""
        return {
            "n_eval": self.n_eval,
            "n_hit": self.n_hit,
            "n_miss": self.n_miss,
            "n_unsupported": self.n_unsupported,
            "accuracy": str(self.accuracy),
            "scores": [
                {
                    "claim_id": item.claim_id,
                    "verdict": item.verdict,
                    "expected_value": item.expected_value,
                    "predicted_value": item.predicted_value,
                }
                for item in self.scores
            ],
        }


def _require_mapping(payload: Any, what: str) -> dict[str, Any]:
    if not isinstance(payload, dict):
        msg = f"{what} must be a JSON object"
        raise TypeError(msg)
    return payload


def _require_str(payload: dict[str, Any], key: str, what: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value:
        msg = f"{what} needs a non-empty string {key!r}"
        raise ValueError(msg)
    return value


def load_gold(path: Path) -> list[GoldClaim]:
    """Load the human gold, refusing anything but a manual annotation."""
    raw = _require_mapping(json.loads(path.read_text(encoding="utf-8")), f"gold file {path}")
    kind = raw.get("kind")
    if kind != GOLD_KIND:
        msg = f"gold kind must be {GOLD_KIND!r}, got {kind!r}"
        raise ValueError(msg)
    items = raw.get("claims")
    if not isinstance(items, list):
        msg = "gold needs a claims list"
        raise TypeError(msg)
    claims: list[GoldClaim] = []
    seen: set[str] = set()
    for index, item in enumerate(items):
        entry = _require_mapping(item, f"gold claim #{index}")
        claim_id = _require_str(entry, "id", f"gold claim #{index}")
        if claim_id in seen:
            msg = f"duplicate gold claim id {claim_id!r}"
            raise ValueError(msg)
        seen.add(claim_id)
        page = entry.get("page_number")
        if not isinstance(page, int) or page < 1:
            msg = f"gold claim {claim_id!r} needs a 1-based page_number"
            raise ValueError(msg)
        claims.append(
            GoldClaim(
                claim_id=claim_id,
                document_file=_require_str(entry, "document_file", claim_id),
                document_sha256=_require_str(entry, "document_sha256", claim_id),
                page_number=page,
                field=_require_str(entry, "field", claim_id),
                expected_value=_require_str(entry, "expected_value", claim_id),
                unit=_require_str(entry, "unit", claim_id),
                expected_review_state=_require_str(entry, "expected_review_state", claim_id),
                quote_normalized=_require_str(entry, "quote_normalized", claim_id),
            )
        )
    count = raw.get("count")
    if count is not None and count != len(claims):
        msg = f"gold count {count!r} does not match {len(claims)} claims"
        raise ValueError(msg)
    return claims


def load_split(path: Path) -> EvalSplit:
    """Load the dev/eval partition (consistency checked by check_split)."""
    raw = _require_mapping(json.loads(path.read_text(encoding="utf-8")), f"split file {path}")
    version = raw.get("version")
    if version != SPLIT_VERSION:
        msg = f"split version must be {SPLIT_VERSION}, got {version!r}"
        raise ValueError(msg)
    rule = _require_str(raw, "rule", "split file")
    items = raw.get("assignments")
    if not isinstance(items, list):
        msg = "split file needs an assignments list"
        raise TypeError(msg)
    assignments: dict[str, SplitAssignment] = {}
    for index, item in enumerate(items):
        entry = _require_mapping(item, f"split assignment #{index}")
        claim_id = _require_str(entry, "claim_id", f"split assignment #{index}")
        if claim_id in assignments:
            msg = f"duplicate split assignment for {claim_id!r}"
            raise ValueError(msg)
        page = entry.get("page_number")
        if not isinstance(page, int) or page < 1:
            msg = f"split assignment {claim_id!r} needs a 1-based page_number"
            raise ValueError(msg)
        split = entry.get("split")
        if split not in ("dev", "eval"):
            msg = f"split assignment {claim_id!r} needs dev|eval, got {split!r}"
            raise ValueError(msg)
        assignments[claim_id] = SplitAssignment(
            claim_id=claim_id,
            expediente_id=_require_str(entry, "expediente_id", claim_id),
            document_file=_require_str(entry, "document_file", claim_id),
            page_number=page,
            split="dev" if split == "dev" else "eval",
        )
    return EvalSplit(version=SPLIT_VERSION, rule=rule, assignments=assignments)


def check_split(gold: list[GoldClaim], split: EvalSplit) -> list[str]:
    """Return every partition violation (empty means the split is clean).

    Checks: full coverage of the gold ids, source cross-check
    (document/page match the gold), expediente purity (one expediente
    never spans both splits), and the no-sibling-pages rule (a
    (document, page) used in dev never contributes an eval claim).
    """
    errors: list[str] = []
    by_id = {claim.claim_id: claim for claim in gold}
    gold_ids = set(by_id)
    split_ids = set(split.assignments)
    for missing in sorted(gold_ids - split_ids):
        errors.append(f"gold claim {missing!r} has no split assignment")
    for extra in sorted(split_ids - gold_ids):
        errors.append(f"split assignment {extra!r} names no gold claim")
    for claim_id in sorted(gold_ids & split_ids):
        claim = by_id[claim_id]
        assigned = split.assignments[claim_id]
        if assigned.document_file != claim.document_file:
            errors.append(
                f"{claim_id}: split file {assigned.document_file!r} != gold {claim.document_file!r}"
            )
        if assigned.page_number != claim.page_number:
            errors.append(
                f"{claim_id}: split page {assigned.page_number} != gold page {claim.page_number}"
            )
        stem = Path(assigned.document_file).stem
        if stem.split("_")[0] != assigned.expediente_id:
            errors.append(
                f"{claim_id}: expediente {assigned.expediente_id!r} "
                f"does not match document {assigned.document_file!r}"
            )
    expediente_splits: dict[str, set[SplitName]] = {}
    for assigned in split.assignments.values():
        expediente_splits.setdefault(assigned.expediente_id, set()).add(assigned.split)
    for expediente_id in sorted(expediente_splits):
        if len(expediente_splits[expediente_id]) > 1:
            errors.append(f"expediente {expediente_id!r} spans dev and eval")
    dev_pages = {
        (item.document_file, item.page_number)
        for item in split.assignments.values()
        if item.split == "dev"
    }
    eval_pages = {
        (item.document_file, item.page_number)
        for item in split.assignments.values()
        if item.split == "eval"
    }
    for document_file, page in sorted(dev_pages & eval_pages):
        errors.append(f"sibling page {document_file} p.{page} appears in dev and eval")
    return errors


def eval_claims(gold: list[GoldClaim], split: EvalSplit) -> list[GoldClaim]:
    """Return the scoring set: every claim assigned eval (dev excluded)."""
    wanted = {claim_id for claim_id, item in split.assignments.items() if item.split == "eval"}
    return [claim for claim in gold if claim.claim_id in wanted]


def _values_equal(expected: str, predicted: str, unit: str) -> bool:
    if unit in NUMERIC_UNITS:
        try:
            return Decimal(expected) == Decimal(predicted)
        except InvalidOperation:
            return expected == predicted
    return expected == predicted


def predictions_from_records(records: list[dict[str, Any]]) -> list[Prediction]:
    """Validate normalized extractor answers (the harness input shape)."""
    predictions: list[Prediction] = []
    for index, record in enumerate(records):
        entry = _require_mapping(record, f"prediction #{index}")
        claim_id = _require_str(entry, "claim_id", f"prediction #{index}")
        value = entry.get("value")
        if value is not None and not isinstance(value, str):
            msg = f"prediction {claim_id!r} value must be a string or null"
            raise ValueError(msg)
        status = entry.get("status", "supported")
        if status not in ("supported", "unsupported"):
            msg = f"prediction {claim_id!r} status must be supported|unsupported, got {status!r}"
            raise ValueError(msg)
        predictions.append(
            Prediction(
                claim_id=claim_id,
                value=value,
                status="supported" if status == "supported" else "unsupported",
            )
        )
    return predictions


def score(
    predictions: list[Prediction],
    claims: list[GoldClaim],
    gold: list[GoldClaim],
) -> ScoreResult:
    """Score normalized predictions over eval claims.

    ``claims`` is the eval set (see :func:`eval_claims`); ``gold`` is the
    full gold, used to tell dev predictions (ignored) from unknown ids
    (rejected). Absent predictions count as ``unsupported``: both stay in
    the denominator and score 0.
    """
    if not claims:
        msg = "cannot score an empty eval set"
        raise ValueError(msg)
    gold_ids = {claim.claim_id for claim in gold}
    eval_ids = {claim.claim_id for claim in claims}
    by_claim: dict[str, Prediction] = {}
    for prediction in predictions:
        if prediction.claim_id not in gold_ids:
            msg = f"prediction for unknown claim {prediction.claim_id!r}"
            raise ValueError(msg)
        if prediction.claim_id not in eval_ids:
            continue  # Dev prediction: never scores, silently ignored.
        if prediction.claim_id in by_claim:
            msg = f"duplicate prediction for {prediction.claim_id!r}"
            raise ValueError(msg)
        by_claim[prediction.claim_id] = prediction
    scores: list[ClaimScore] = []
    for claim in claims:
        found = by_claim.get(claim.claim_id)
        if found is None or found.status == "unsupported":
            verdict: Verdict = "unsupported"
            predicted: str | None = None if found is None else found.value
        elif found.value is not None and _values_equal(
            claim.expected_value, found.value, claim.unit
        ):
            verdict = "hit"
            predicted = found.value
        else:
            verdict = "miss"
            predicted = found.value
        scores.append(
            ClaimScore(
                claim_id=claim.claim_id,
                verdict=verdict,
                expected_value=claim.expected_value,
                predicted_value=predicted,
            )
        )
    n_hit = sum(1 for item in scores if item.verdict == "hit")
    n_miss = sum(1 for item in scores if item.verdict == "miss")
    n_unsupported = sum(1 for item in scores if item.verdict == "unsupported")
    accuracy = Decimal(n_hit) / Decimal(len(scores))
    return ScoreResult(
        scores=tuple(scores),
        n_eval=len(scores),
        n_hit=n_hit,
        n_miss=n_miss,
        n_unsupported=n_unsupported,
        accuracy=accuracy,
    )
