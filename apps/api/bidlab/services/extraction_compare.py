"""Compare text vs hybrid extraction quality and cost, offline (PKG-T11).

Both modes run the SAME eval claims through the SAME scoring harness
(:mod:`bidlab.services.extraction_eval`) and the SAME v1-proposal mapping
(:func:`v1_proposal_to_records`):

* ``text``: the deterministic offline fixture (:class:`StubExtractor`),
  one adapter call per eval page. No network, no model, no spend;
  latency is really measured per call.
* ``hybrid``: text + live Meta extraction through the official gate
  (:func:`select_adapter`). BLOCKED while G3 has no credential:
  recorded with honest nulls, never zeros, never an invented
  advantage. Re-runnable through the same interface
  (:func:`run_hybrid_mode` plus the CLI ``--allow-live`` flag) once a
  credential exists; that live path is implemented but NOT executed
  here and has never touched the network in this package.

A critical error is a wrong supported value (``miss``) on an amount,
period or formula claim. ``unsupported`` answers stay in the
denominator at 0 points but are not wrong values, so they are never
critical.
"""

from __future__ import annotations

import statistics
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal

from bidlab.api.errors import ApiError
from bidlab.services import extraction_eval as ev
from bidlab.services.meta_adapter import PageInput, StubExtractor, select_adapter

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence

COMPARISON_SCHEMA_VERSION = 1

ModeName = Literal["text", "hybrid"]
ModeStatus = Literal["measured", "blocked"]

#: Units whose wrong values are critical: amounts and periods.
CRITICAL_UNITS = frozenset({"EUR", "months", "years"})

#: Non-numeric fields whose wrong values are critical: formula facts.
CRITICAL_FIELDS = frozenset({"formula_denominator_ambiguity", "logarithm_base"})

CRITICAL_RULE = (
    "Error crítico = miss (valor supported distinto del gold) en claim de importe "
    "(unidad EUR), periodo (months/years) o fórmula (formula_denominator_ambiguity, "
    "logarithm_base). unsupported cuenta en el denominador con 0 puntos pero no es "
    "un valor erróneo, así que nunca es crítico."
)

TEXT_EXTRACTOR_LABEL = "StubExtractor (fixture determinista offline, sin modelo ni red)"
HYBRID_EXTRACTOR_LABEL = "LiveExtractor (texto + Meta live, payload híbrido T06)"
SHARED_SCHEMA_LABEL = "propuesta v1 → predicciones normalizadas (mismo mapper ambos modos)"

FIXTURE_COST_REASON = (
    "fixture: StubExtractor no llama a la red; coste 0 micro-USD, sin tokens "
    "y sin reserva en el ledger (tokens null por convención fixture/manual)"
)
HYBRID_NOT_ENABLED_REASON = (
    "live no habilitado: hay credencial pero falta --allow-live; "
    "modo híbrido no ejecutado, cero llamadas live"
)
HYBRID_NO_TEXT_REASON = (
    "textos de página no suministrados: los originales están fuera del repo "
    "(publication-manifest); modo híbrido no ejecutado, cero llamadas live"
)

LIMITATIONS: tuple[str, ...] = (
    "n=11 claims eval en 4 expedientes held-out: muestra pequeña, sin potencia "
    "estadística; leer solo como orden de magnitud.",
    "Modo texto = fixture determinista offline (StubExtractor, sin modelo ni red): "
    "0 aciertos esperados; mide el suelo del harness, no un extractor real.",
    "Modo híbrido no ejecutado (G3 sin credencial): sin números live, "
    "sin ventaja atribuible a ningún modo.",
    "Latencias del modo texto = llamadas locales al stub (sub-milisegundo "
    "típico); no comparables con latencias de red.",
    "Coste texto 0 micro-USD (sin llamadas); coste híbrido desconocido "
    "(null) hasta una ejecución live con --allow-live.",
)


def _hybrid_blocked_reason(code: str) -> str:
    return (
        "G3 bloqueado: sin credencial Meta verificada "
        f"(gate live: {code}); modo híbrido no ejecutado, cero llamadas live"
    )


def is_critical(claim: ev.GoldClaim) -> bool:
    """Tell whether a wrong supported value on this claim would be critical."""
    return claim.unit in CRITICAL_UNITS or claim.field in CRITICAL_FIELDS


def critical_errors(result: ev.ScoreResult, claims: list[ev.GoldClaim]) -> tuple[str, ...]:
    """Claim ids with a wrong supported value on a critical claim, in order."""
    wanted = {claim.claim_id for claim in claims if is_critical(claim)}
    return tuple(
        item.claim_id
        for item in result.scores
        if item.verdict == "miss" and item.claim_id in wanted
    )


@dataclass(frozen=True)
class PageGroup:
    """One adapter call: a page plus the eval claims located on it."""

    page: PageInput
    claims: tuple[ev.GoldClaim, ...]


def build_eval_pages(
    eval_claims: list[ev.GoldClaim],
    texts: Mapping[tuple[str, int], str] | None = None,
) -> list[PageGroup]:
    """Group eval claims by (document, page), preserving gold order.

    ``texts`` maps (document_file, page_number) to normalized page text.
    The text fixture ignores input text, so text mode passes no texts
    (the originals live outside the repo and no text is fabricated);
    the hybrid live path requires one text per page and refuses to run
    partially when any page lacks text.
    """
    groups: dict[tuple[str, int], list[ev.GoldClaim]] = {}
    for claim in eval_claims:
        groups.setdefault((claim.document_file, claim.page_number), []).append(claim)
    pages: list[PageGroup] = []
    for (document_file, page_number), claims in groups.items():
        if texts is None:
            text = ""
        else:
            missing = (document_file, page_number) not in texts
            if missing:
                msg = f"no page text for {document_file} p.{page_number}"
                raise ValueError(msg)
            text = texts[(document_file, page_number)]
        pages.append(
            PageGroup(
                page=PageInput(
                    document_id=Path(document_file).stem,
                    page_number=page_number,
                    normalized_text=text,
                ),
                claims=tuple(claims),
            )
        )
    return pages


def v1_proposal_to_records(
    proposal: Mapping[str, Any], eval_claims: list[ev.GoldClaim]
) -> list[dict[str, Any]]:
    """Map a v1 proposal to normalized harness records (both modes).

    A v1 claim addresses the gold claim sharing its (document_id stem,
    page_number, key==field). ``proposed`` claims with a string value
    become ``supported`` predictions; anything else (ambiguous status,
    null value, unknown key, citation outside the eval set) becomes
    ``unsupported`` or is ignored. First claim wins per gold id, so
    repeated live answers stay deterministic.
    """
    index = {
        (Path(claim.document_file).stem, claim.page_number, claim.field): claim.claim_id
        for claim in eval_claims
    }
    raw_claims = proposal.get("claims")
    if not isinstance(raw_claims, list):
        return []
    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    for entry in raw_claims:
        if not isinstance(entry, dict):
            continue
        key = entry.get("key")
        if not isinstance(key, str):
            continue
        value = entry.get("normalized_value")
        supported = entry.get("status") == "proposed" and isinstance(value, str)
        citations = entry.get("citations")
        if not isinstance(citations, list):
            continue
        for citation in citations:
            if not isinstance(citation, dict):
                continue
            document_id = citation.get("document_id")
            page_number = citation.get("page_number")
            if not isinstance(document_id, str):
                continue
            if not isinstance(page_number, int) or isinstance(page_number, bool):
                continue
            claim_id = index.get((document_id, page_number, key))
            if claim_id is None or claim_id in seen:
                continue
            seen.add(claim_id)
            records.append(
                {
                    "claim_id": claim_id,
                    "value": value if supported else None,
                    "status": "supported" if supported else "unsupported",
                }
            )
    return records


@dataclass(frozen=True)
class TextRun:
    """Measured fixture run: records plus really-measured latencies."""

    records: tuple[dict[str, Any], ...]
    latencies_ms: dict[str, float]
    warnings: tuple[str, ...]
    invocation_mode: str


def run_text_mode(eval_claims: list[ev.GoldClaim]) -> TextRun:
    """Run the offline fixture once per eval page, timing every call."""
    extractor = StubExtractor()
    records: list[dict[str, Any]] = []
    latencies: dict[str, float] = {}
    warnings: list[str] = []
    for group in build_eval_pages(eval_claims):
        started = time.perf_counter()
        result = extractor.extract([group.page])
        elapsed_ms = round((time.perf_counter() - started) * 1000, 3)
        for claim in group.claims:
            latencies[claim.claim_id] = elapsed_ms
        for warning in result.warnings:
            if warning not in warnings:
                warnings.append(warning)
        records.extend(v1_proposal_to_records(result.proposal, eval_claims))
    return TextRun(
        records=tuple(records),
        latencies_ms=latencies,
        warnings=tuple(warnings),
        invocation_mode="fixture",
    )


@dataclass(frozen=True)
class HybridRun:
    """Hybrid outcome: measured live facts, or a blocked null-record."""

    status: ModeStatus
    block_reason: str | None
    records: tuple[dict[str, Any], ...]
    latencies_ms: dict[str, float]
    model: str | None
    prompt_tokens: int | None
    completion_tokens: int | None
    cached_tokens: int | None
    provider_request_id: str | None
    estimated_cost_usd: str | None
    invocation_mode: str | None


def _blocked_hybrid(reason: str) -> HybridRun:
    return HybridRun(
        status="blocked",
        block_reason=reason,
        records=(),
        latencies_ms={},
        model=None,
        prompt_tokens=None,
        completion_tokens=None,
        cached_tokens=None,
        provider_request_id=None,
        estimated_cost_usd=None,
        invocation_mode=None,
    )


def run_hybrid_mode(
    eval_claims: list[ev.GoldClaim],
    *,
    allow_live: bool,
    page_texts: Mapping[tuple[str, int], str] | None = None,
) -> HybridRun:
    """Run the hybrid extractor, or record honestly why it did not run.

    Refusal ladder (checked in order, no partial spend): no verified
    credential (G3) → live not enabled (missing ``--allow-live``) →
    page texts missing (originals outside the repo). Only when all
    three pass does the adapter run, once per eval page with measured
    latency. Live failures propagate as :class:`AdapterError` (the CLI
    exits 2 without writing a comparison): a partial live table would
    be worse than no table.
    """
    try:
        adapter = select_adapter("live")
    except ApiError as exc:
        return _blocked_hybrid(_hybrid_blocked_reason(exc.code))
    if not allow_live:
        return _blocked_hybrid(HYBRID_NOT_ENABLED_REASON)
    if page_texts is None:
        return _blocked_hybrid(HYBRID_NO_TEXT_REASON)
    try:
        groups = build_eval_pages(eval_claims, page_texts)
    except ValueError:
        return _blocked_hybrid(HYBRID_NO_TEXT_REASON)
    records: list[dict[str, Any]] = []
    latencies: dict[str, float] = {}
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    cached_tokens: int | None = None
    request_id: str | None = None
    model: str | None = None
    cost_usd = Decimal(0)
    cost_reported = False
    for group in groups:
        started = time.perf_counter()
        result = adapter.extract([group.page])
        elapsed_ms = round((time.perf_counter() - started) * 1000, 3)
        for claim in group.claims:
            latencies[claim.claim_id] = elapsed_ms
        prompt_tokens = _add_optional(prompt_tokens, result.prompt_tokens)
        completion_tokens = _add_optional(completion_tokens, result.completion_tokens)
        cached_tokens = _add_optional(cached_tokens, result.cached_tokens)
        request_id = request_id or result.provider_request_id
        model = model or result.model
        if result.estimated_cost_usd is not None:
            try:
                cost_usd += Decimal(result.estimated_cost_usd)
            except InvalidOperation:
                pass
            else:
                cost_reported = True
        records.extend(v1_proposal_to_records(result.proposal, eval_claims))
    return HybridRun(
        status="measured",
        block_reason=None,
        records=tuple(records),
        latencies_ms=latencies,
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        cached_tokens=cached_tokens,
        provider_request_id=request_id,
        estimated_cost_usd=(str(cost_usd) if cost_reported else None),
        invocation_mode="live",
    )


def _add_optional(total: int | None, value: int | None) -> int | None:
    if value is None:
        return total
    return (total or 0) + value


@dataclass(frozen=True)
class CaseRow:
    """One eval claim seen by both modes (hybrid side null when blocked)."""

    claim_id: str
    field: str
    unit: str
    expected_value: str
    expected_review_state: str
    critical: bool
    text_predicted: str | None
    text_verdict: str
    text_latency_ms: float
    hybrid_predicted: str | None
    hybrid_verdict: str | None
    hybrid_latency_ms: float | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "claim_id": self.claim_id,
            "field": self.field,
            "unit": self.unit,
            "expected_value": self.expected_value,
            "expected_review_state": self.expected_review_state,
            "critical": self.critical,
            "text": {
                "predicted_value": self.text_predicted,
                "verdict": self.text_verdict,
                "latency_ms": self.text_latency_ms,
            },
            "hybrid": {
                "predicted_value": self.hybrid_predicted,
                "verdict": self.hybrid_verdict,
                "latency_ms": self.hybrid_latency_ms,
            },
        }


@dataclass(frozen=True)
class ModeAggregate:
    """Whole-run numbers for one mode (nulls, never zeros, when blocked)."""

    mode: ModeName
    status: ModeStatus
    block_reason: str | None
    extractor: str
    schema: str
    n_eval: int
    n_hit: int | None
    n_miss: int | None
    n_unsupported: int | None
    accuracy: Decimal | None
    critical_errors: tuple[str, ...] | None
    latency_p50_ms: float | None
    latency_max_ms: float | None
    cost_micro_usd: int | None
    cost_reason: str
    model: str | None
    prompt_tokens: int | None
    completion_tokens: int | None
    cached_tokens: int | None
    invocation_mode: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "status": self.status,
            "block_reason": self.block_reason,
            "extractor": self.extractor,
            "schema": self.schema,
            "n_eval": self.n_eval,
            "n_hit": self.n_hit,
            "n_miss": self.n_miss,
            "n_unsupported": self.n_unsupported,
            "accuracy": None if self.accuracy is None else str(self.accuracy),
            "critical_errors": (
                None if self.critical_errors is None else list(self.critical_errors)
            ),
            "latency_ms": (
                None
                if self.latency_p50_ms is None or self.latency_max_ms is None
                else {"p50": self.latency_p50_ms, "max": self.latency_max_ms}
            ),
            "cost_micro_usd": self.cost_micro_usd,
            "cost_reason": self.cost_reason,
            "model": self.model,
            "tokens": {
                "prompt": self.prompt_tokens,
                "completion": self.completion_tokens,
                "cached": self.cached_tokens,
            },
            "invocation_mode": self.invocation_mode,
        }


@dataclass(frozen=True)
class ComparisonResult:
    """Text-vs-hybrid comparison over one eval set."""

    schema_version: int
    generated_utc: str
    gold_kind: str
    gold_total: int
    n_dev: int
    n_eval: int
    critical_rule: str
    cases: tuple[CaseRow, ...]
    text: ModeAggregate
    hybrid: ModeAggregate
    limitations: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "generated_utc": self.generated_utc,
            "gold": {"kind": self.gold_kind, "claims_total": self.gold_total},
            "split": {"n_dev": self.n_dev, "n_eval": self.n_eval},
            "critical_rule": self.critical_rule,
            "modes": {"text": self.text.to_dict(), "hybrid": self.hybrid.to_dict()},
            "cases": [case.to_dict() for case in self.cases],
            "limitations": list(self.limitations),
        }


def _latency_summary(latencies: Sequence[float]) -> tuple[float, float]:
    ordered = sorted(latencies)
    return round(float(statistics.median(ordered)), 3), round(max(ordered), 3)


def compare(
    gold: list[ev.GoldClaim],
    split: ev.EvalSplit,
    *,
    allow_live: bool = False,
    page_texts: Mapping[tuple[str, int], str] | None = None,
) -> ComparisonResult:
    """Run both modes over the eval set and aggregate an honest comparison."""
    violations = ev.check_split(gold, split)
    if violations:
        msg = f"split inválido: {violations[0]}"
        raise ValueError(msg)
    eval_claims = ev.eval_claims(gold, split)
    text_run = run_text_mode(eval_claims)
    text_result = ev.score(ev.predictions_from_records(list(text_run.records)), eval_claims, gold)
    hybrid_run = run_hybrid_mode(eval_claims, allow_live=allow_live, page_texts=page_texts)
    hybrid_result: ev.ScoreResult | None = None
    if hybrid_run.status == "measured":
        hybrid_result = ev.score(
            ev.predictions_from_records(list(hybrid_run.records)), eval_claims, gold
        )
    text_verdicts = {item.claim_id: item for item in text_result.scores}
    hybrid_verdicts: dict[str, ev.ClaimScore] = (
        {} if hybrid_result is None else {item.claim_id: item for item in hybrid_result.scores}
    )
    cases = tuple(
        CaseRow(
            claim_id=claim.claim_id,
            field=claim.field,
            unit=claim.unit,
            expected_value=claim.expected_value,
            expected_review_state=claim.expected_review_state,
            critical=is_critical(claim),
            text_predicted=text_verdicts[claim.claim_id].predicted_value,
            text_verdict=text_verdicts[claim.claim_id].verdict,
            text_latency_ms=text_run.latencies_ms[claim.claim_id],
            hybrid_predicted=(
                None if hybrid_result is None else hybrid_verdicts[claim.claim_id].predicted_value
            ),
            hybrid_verdict=(
                None if hybrid_result is None else hybrid_verdicts[claim.claim_id].verdict
            ),
            hybrid_latency_ms=hybrid_run.latencies_ms.get(claim.claim_id),
        )
        for claim in eval_claims
    )
    text_p50, text_max = _latency_summary(
        [text_run.latencies_ms[claim.claim_id] for claim in eval_claims]
    )
    hybrid_latencies = [
        hybrid_run.latencies_ms[claim.claim_id]
        for claim in eval_claims
        if claim.claim_id in hybrid_run.latencies_ms
    ]
    hybrid_summary = _latency_summary(hybrid_latencies) if hybrid_latencies else None
    hybrid_cost_micro: int | None = None
    if hybrid_run.estimated_cost_usd is not None:
        try:
            hybrid_cost_micro = int(Decimal(hybrid_run.estimated_cost_usd) * 1_000_000)
        except InvalidOperation:
            hybrid_cost_micro = None
    if hybrid_run.block_reason is not None:
        hybrid_cost_reason = hybrid_run.block_reason
    elif hybrid_cost_micro is not None:
        hybrid_cost_reason = (
            "live medido: suma de estimated_cost_usd por llamada (tarifas "
            "Standard Spark publicadas; facturación real en el dashboard)"
        )
    else:
        hybrid_cost_reason = (
            "live medido pero sin usage reportado: coste no rastreado, nunca cero inventado"
        )
    text = ModeAggregate(
        mode="text",
        status="measured",
        block_reason=None,
        extractor=TEXT_EXTRACTOR_LABEL,
        schema=SHARED_SCHEMA_LABEL,
        n_eval=text_result.n_eval,
        n_hit=text_result.n_hit,
        n_miss=text_result.n_miss,
        n_unsupported=text_result.n_unsupported,
        accuracy=text_result.accuracy,
        critical_errors=critical_errors(text_result, eval_claims),
        latency_p50_ms=text_p50,
        latency_max_ms=text_max,
        cost_micro_usd=0,
        cost_reason=FIXTURE_COST_REASON,
        model=None,
        prompt_tokens=None,
        completion_tokens=None,
        cached_tokens=None,
        invocation_mode=text_run.invocation_mode,
    )
    hybrid = ModeAggregate(
        mode="hybrid",
        status=hybrid_run.status,
        block_reason=hybrid_run.block_reason,
        extractor=HYBRID_EXTRACTOR_LABEL,
        schema=SHARED_SCHEMA_LABEL,
        n_eval=len(eval_claims),
        n_hit=None if hybrid_result is None else hybrid_result.n_hit,
        n_miss=None if hybrid_result is None else hybrid_result.n_miss,
        n_unsupported=None if hybrid_result is None else hybrid_result.n_unsupported,
        accuracy=None if hybrid_result is None else hybrid_result.accuracy,
        critical_errors=(
            None if hybrid_result is None else critical_errors(hybrid_result, eval_claims)
        ),
        latency_p50_ms=None if hybrid_summary is None else hybrid_summary[0],
        latency_max_ms=None if hybrid_summary is None else hybrid_summary[1],
        cost_micro_usd=hybrid_cost_micro,
        cost_reason=hybrid_cost_reason,
        model=hybrid_run.model,
        prompt_tokens=hybrid_run.prompt_tokens,
        completion_tokens=hybrid_run.completion_tokens,
        cached_tokens=hybrid_run.cached_tokens,
        invocation_mode=hybrid_run.invocation_mode,
    )
    n_dev = sum(1 for item in split.assignments.values() if item.split == "dev")
    return ComparisonResult(
        schema_version=COMPARISON_SCHEMA_VERSION,
        generated_utc=datetime.now(UTC).isoformat(),
        gold_kind=ev.GOLD_KIND,
        gold_total=len(gold),
        n_dev=n_dev,
        n_eval=len(eval_claims),
        critical_rule=CRITICAL_RULE,
        cases=cases,
        text=text,
        hybrid=hybrid,
        limitations=LIMITATIONS,
    )
