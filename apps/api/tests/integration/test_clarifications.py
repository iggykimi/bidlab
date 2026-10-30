"""Clarification drafts: one bounded live call, bound to the cited quote.

The provider is a mocked ``httpx.post`` (no network); everything else is
the real path: seeded Tías DB, live gate, spend ledger, receipts.
"""

import json
from typing import Any

import httpx
import pytest
from bidlab.db import models
from bidlab.db.session import get_engine
from bidlab.schemas import generated as g
from bidlab.services import budget as budget_service
from bidlab.services import clarification, meta_adapter
from bidlab.settings import get_settings
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

URL = "/api/v1/tenders/tias/clarifications"
REQUEST = {
    "requirement_id": "req-tech-amount",
    "citation_id": "cit-technical_services_threshold",
    "allow_remote_processing": True,
}
QUOTE_SPAN = "doscientos siete mil ochenta y ocho euros (207.088,00€)"


def _headers(key: str) -> dict[str, str]:
    return {"X-BidLab-Client": "local-ui", "Idempotency-Key": key}


def _chat(content: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": "mock-clar-no-network",
        "model": "muse-spark-1.3",
        "choices": [{"finish_reason": "stop", "message": {"content": json.dumps(content)}}],
        "usage": {
            "prompt_tokens": 900,
            "completion_tokens": 400,
            "completion_tokens_details": {"reasoning_tokens": 250},
        },
    }


def _draft(**overrides: Any) -> dict[str, Any]:
    draft = {
        "question": (
            "En relación con la solvencia técnica (PCAP, página 6), ¿pueden confirmar "
            "si el importe de 207.088,00 € se refiere al año de mayor ejecución?"
        ),
        "why_it_matters": "La respuesta cambia la cifra que tu empresa tiene que acreditar.",
        "cited_page": 6,
        "quote_used": QUOTE_SPAN,
    }
    draft.update(overrides)
    return draft


@pytest.fixture()
def live_env(seeded_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("MODEL_API_KEY", "test-key-not-a-secret")
    monkeypatch.setenv("BIDLAB_MODE", "live")
    monkeypatch.setenv(meta_adapter.META_API_URL_ENV, "https://meta.test/chat")
    get_settings.cache_clear()
    return seeded_client


def _blocked(*args: object, **kwargs: object) -> object:
    raise AssertionError("the provider must not be called")


def test_draft_happy_path_stores_receipt_and_settles(
    live_env: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[dict[str, Any]] = []

    def _post(url: str, **kwargs: Any) -> httpx.Response:
        calls.append({"url": url, **kwargs})
        return httpx.Response(200, json=_chat(_draft()))

    monkeypatch.setattr(httpx, "post", _post)
    res = live_env.post(URL, json=REQUEST, headers=_headers("k-clar-ok"))
    assert res.status_code == 201, res.text
    draft = g.ClarificationDraft.model_validate(res.json()).model_dump(mode="json")
    assert draft["cited_page"] == 6
    assert draft["quote_used"] == QUOTE_SPAN
    assert draft["requirement_label"].startswith("Servicios similares")
    assert draft["document_id"] == "doc-tias-pcap"
    assert draft["mode"] == "live"
    assert draft["model"] == "muse-spark-1.3"
    assert draft["provider_request_id"] == "mock-clar-no-network"
    assert (draft["prompt_tokens"], draft["completion_tokens"]) == (900, 400)
    assert draft["reasoning_tokens"] == 250
    assert draft["estimated_cost_usd"] == "0.002825"

    # One strict, bounded request; the prompt is server-built from the stored citation.
    assert len(calls) == 1
    sent = calls[0]["json"]
    assert sent["max_completion_tokens"] == clarification.MAX_COMPLETION_TOKENS
    assert sent["response_format"]["json_schema"]["strict"] is True
    assert "reasoning_effort" not in sent
    system, user = sent["messages"]
    assert "untrusted" in system["content"]
    packet = json.loads(user["content"])
    assert packet["source"]["page"] == 6
    assert packet["source"]["quote"].startswith("ión sea igual o superior")
    assert packet["tender"]["contracting_body"] == "Pleno del Ayuntamiento de Tías"
    assert packet["requirement"]["section"] == "Solvencia técnica (p.6)"

    # Receipt persisted outside any job; spend settled at the reported cost.
    key = draft["invocation_id"]
    with Session(get_engine()) as session:
        invocation = session.get(models.ModelInvocation, key)
        assert invocation is not None
        assert invocation.job_id is None
        assert invocation.status == "ok"
        assert invocation.prompt_version == clarification.PROMPT_VERSION
        reservation = session.get(models.ModelSpendReservation, key)
        assert reservation is not None
        assert reservation.state == "settled"
        assert reservation.actual_micro_usd == 2825
    assert budget_service.totals(get_engine(), ceiling_micro=20_000_000)["held"] == 0

    # Replay never pays twice; the stored draft survives in the list.
    replay = live_env.post(URL, json=REQUEST, headers=_headers("k-clar-ok"))
    assert replay.status_code == 200
    assert replay.json()["id"] == draft["id"]
    assert len(calls) == 1
    monkeypatch.setattr(httpx, "post", _blocked)
    listed = g.ClarificationList.model_validate(live_env.get(URL).json())
    assert [item.id.root for item in listed.items] == [draft["id"]]


def test_without_provider_is_503_and_reserves_nothing(
    seeded_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    monkeypatch.delenv(meta_adapter.META_API_URL_ENV, raising=False)
    monkeypatch.setattr(httpx, "post", _blocked)
    get_settings.cache_clear()
    res = seeded_client.post(URL, json=REQUEST, headers=_headers("k-clar-503"))
    assert res.status_code == 503
    assert res.json()["code"] == "provider_not_configured"
    with Session(get_engine()) as session:
        assert session.scalars(select(models.ModelSpendReservation)).all() == []


@pytest.mark.parametrize(
    "bad",
    [{"cited_page": 7}, {"quote_used": "importe de 300.000,00 €"}],
    ids=["other-page", "invented-quote"],
)
def test_draft_not_bound_to_source_is_rejected_with_receipt(
    live_env: TestClient, monkeypatch: pytest.MonkeyPatch, bad: dict[str, Any]
) -> None:
    monkeypatch.setattr(
        httpx, "post", lambda *a, **k: httpx.Response(200, json=_chat(_draft(**bad)))
    )
    res = live_env.post(URL, json=REQUEST, headers=_headers("k-clar-bad"))
    assert res.status_code == 502
    assert res.json()["code"] == "invalid_model_output"
    with Session(get_engine()) as session:
        assert session.scalars(select(models.ClarificationDraft)).all() == []
        invocation = session.scalars(
            select(models.ModelInvocation).where(models.ModelInvocation.job_id.is_(None))
        ).one()
        assert invocation.status == "failed"
        assert invocation.provider_request_id == "mock-clar-no-network"
        reservation = session.get(models.ModelSpendReservation, invocation.id)
        assert reservation is not None
        assert reservation.state == "settled"
        assert reservation.actual_micro_usd == 2825
    assert live_env.get(URL).json() == {"items": []}


def test_budget_refusal_is_429_before_any_call(
    live_env: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(httpx, "post", _blocked)
    monkeypatch.setenv("BIDLAB_META_BUDGET_USD", "0.00")
    get_settings.cache_clear()
    res = live_env.post(URL, json=REQUEST, headers=_headers("k-clar-budget"))
    assert res.status_code == 429
    assert res.json()["code"] == "budget_exhausted"


@pytest.mark.parametrize(
    ("body", "status", "code"),
    [
        ({**REQUEST, "allow_remote_processing": False}, 400, "remote_processing_not_allowed"),
        ({**REQUEST, "requirement_id": "req-tech"}, 404, "requirement_not_found"),
        ({**REQUEST, "citation_id": "cit-missing"}, 404, "citation_not_found"),
    ],
)
def test_input_guards_never_reach_the_provider(
    live_env: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    body: dict[str, Any],
    status: int,
    code: str,
) -> None:
    monkeypatch.setattr(httpx, "post", _blocked)
    res = live_env.post(URL, json=body, headers=_headers(f"k-clar-{code}"))
    assert res.status_code == status
    assert res.json()["code"] == code
