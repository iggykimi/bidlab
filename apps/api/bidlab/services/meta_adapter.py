"""Structured-extraction adapter (T16).

Two implementations, one honest gate:

- :class:`StubExtractor`: deterministic offline fixture. Never touches the
  network, never claims a live run (invocation mode ``fixture``, model and
  usage NULL, warnings labelled ``fixture_stub``). ``StubScenario`` injects
  typed provider failures (I07) so the pipeline proves it surfaces explicit
  failure/review instead of inventing a successful result.
- :class:`LiveExtractor`: performs a real HTTP call to a Muse endpoint, and
  is constructed ONLY when ``MODEL_API_KEY`` is set (see
  :func:`select_adapter`). No endpoint is defaulted: G3 has not verified a
  Muse URL, so live runs additionally require an explicit ``META_API_URL``
  (full endpoint URL). Anything else is a 503, never a silent fixture.

Live integration contract (to verify in G3): POST JSON
``{"model", "prompt_version", "pages": [{"document_id", "page_number",
"text"}]}``; the endpoint answers either the ``ExtractionProposal`` object
directly or ``{"proposal": {...}}``, optionally with ``usage`` counters,
``provider_request_id`` and ``estimated_cost_usd``. Unparseable answers are
an explicit ``invalid_model_output`` failure. Single attempt, no retries:
bounded spend by construction.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING, Any, Protocol

import httpx
from pydantic import ValidationError

from bidlab.api.errors import ApiError
from bidlab.schemas import generated as g
from bidlab.settings import get_settings

if TYPE_CHECKING:
    from collections.abc import Sequence

PROMPT_VERSION = "bidlab-extract-1"
META_API_URL_ENV = "META_API_URL"
MAX_UNREAD_PAGES = 120


class AdapterError(Exception):
    """Typed extraction failure. Carries a contract-style code."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class StubScenario(StrEnum):
    OK = "ok"
    REFUSAL = "refusal"
    TRUNCATED = "truncated"
    INVALID_JSON = "invalid_json"


@dataclass(frozen=True)
class PageInput:
    document_id: str
    page_number: int
    normalized_text: str


@dataclass(frozen=True)
class AdapterResult:
    proposal: dict[str, Any]
    warnings: tuple[str, ...]
    mode: str  # fixture | live
    model: str | None
    prompt_tokens: int | None
    completion_tokens: int | None
    cached_tokens: int | None
    provider_request_id: str | None
    estimated_cost_usd: str | None
    latency_ms: int
    status: str  # ok | failed


class ExtractionAdapter(Protocol):
    is_live: bool

    def extract(self, pages: Sequence[PageInput]) -> AdapterResult: ...


def pages_input_hash(pages: Sequence[PageInput]) -> str:
    canonical = json.dumps(
        [
            {
                "document_id": page.document_id,
                "page_number": page.page_number,
                "text_sha256": hashlib.sha256(page.normalized_text.encode("utf-8")).hexdigest(),
            }
            for page in pages
        ],
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class StubExtractor:
    """Deterministic offline fixture. No network, no invented values."""

    is_live = False

    def __init__(self, scenario: StubScenario = StubScenario.OK) -> None:
        self._scenario = scenario

    def extract(self, pages: Sequence[PageInput]) -> AdapterResult:
        if self._scenario == StubScenario.REFUSAL:
            raise AdapterError("provider_refusal", "fixture stub simulating a provider refusal")
        if self._scenario == StubScenario.INVALID_JSON:
            raise AdapterError("invalid_model_output", "fixture stub simulating unparseable output")
        warnings = [
            "fixture_stub: offline deterministic stub; no model was called",
            "demo: proposal is empty until a live extraction plus human review",
        ]
        if self._scenario == StubScenario.TRUNCATED:
            warnings.append("fixture_stub: simulated truncated output; proposal partial")
        unread = sorted({page.page_number for page in pages})[:MAX_UNREAD_PAGES]
        proposal = {
            "schema_version": "1.0",
            "claims": [],
            "requirements": [],
            "pricing_formula": {
                "formula_literal": None,
                "template_hint": "unsupported",
                "max_points": None,
                "variables": [],
                "citations": [],
                "ambiguities": ["fixture_stub: no live extraction performed"],
            },
            "anomaly_text": None,
            "anomaly_citations": [],
            "unread_pages": unread,
            "warnings": list(warnings),
        }
        return AdapterResult(
            proposal=proposal,
            warnings=tuple(warnings),
            mode="fixture",
            model=None,
            prompt_tokens=None,
            completion_tokens=None,
            cached_tokens=None,
            provider_request_id=None,
            estimated_cost_usd=None,
            latency_ms=0,
            status="ok",
        )


def _as_dict(value: object) -> dict[str, Any]:
    if isinstance(value, dict):
        return {str(key): item for key, item in value.items()}
    return {}


def _as_non_negative_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and value >= 0:
        return value
    return None


class LiveExtractor:
    """Real Muse call. Construct only via :func:`select_adapter`."""

    is_live = True

    def __init__(
        self, *, api_key: str, model: str, endpoint_url: str, timeout_s: float = 120.0
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._endpoint_url = endpoint_url
        self._timeout_s = timeout_s

    def extract(self, pages: Sequence[PageInput]) -> AdapterResult:
        payload = {
            "model": self._model,
            "prompt_version": PROMPT_VERSION,
            "pages": [
                {
                    "document_id": page.document_id,
                    "page_number": page.page_number,
                    "text": page.normalized_text,
                }
                for page in pages
            ],
        }
        started = time.monotonic()
        try:
            response = httpx.post(
                self._endpoint_url,
                json=payload,
                headers={"Authorization": f"Bearer {self._api_key}"},
                timeout=self._timeout_s,
            )
        except httpx.HTTPError as exc:
            raise AdapterError("provider_failure", f"model call failed: {exc}") from exc
        latency_ms = int((time.monotonic() - started) * 1000)
        if response.status_code == 429:
            raise AdapterError("provider_rate_limited", "model endpoint rate limited")
        if response.status_code >= 400:
            raise AdapterError(
                "provider_failure", f"model endpoint answered {response.status_code}"
            )
        try:
            data = response.json()
        except ValueError as exc:
            raise AdapterError("invalid_model_output", "model endpoint answered non-JSON") from exc
        body = _as_dict(data)
        candidate = body.get("proposal", data)
        try:
            proposal = g.ExtractionProposal.model_validate(candidate)
        except ValidationError as exc:
            raise AdapterError(
                "invalid_model_output", f"model output failed schema: {exc.error_count()}"
            ) from exc
        usage = _as_dict(body.get("usage"))
        provider_request_id = body.get("provider_request_id")
        cost = body.get("estimated_cost_usd")
        return AdapterResult(
            proposal=proposal.model_dump(mode="json"),
            warnings=(),
            mode="live",
            model=self._model,
            prompt_tokens=_as_non_negative_int(usage.get("prompt_tokens")),
            completion_tokens=_as_non_negative_int(usage.get("completion_tokens")),
            cached_tokens=_as_non_negative_int(usage.get("cached_tokens")),
            provider_request_id=(
                str(provider_request_id)[:200] if provider_request_id is not None else None
            ),
            estimated_cost_usd=str(cost)[:40] if cost is not None else None,
            latency_ms=latency_ms,
            status="ok",
        )


def select_adapter(mode: str) -> ExtractionAdapter:
    """Return the stub for ``curated_demo``; gate live behind key + endpoint."""
    if mode != "live":
        return StubExtractor()
    settings = get_settings()
    api_key = settings.model_api_key.get_secret_value()
    if not api_key:
        raise ApiError(
            503,
            "provider_not_configured",
            "MODEL_API_KEY is not set; live extraction unavailable (G3 blocked)",
        )
    endpoint = os.environ.get(META_API_URL_ENV, "").strip()
    if not endpoint:
        raise ApiError(
            503,
            "provider_not_configured",
            f"{META_API_URL_ENV} is not set; no verified Muse endpoint (G3 blocked)",
        )
    return LiveExtractor(
        api_key=api_key,
        model=settings.meta_model,
        endpoint_url=endpoint,
    )
