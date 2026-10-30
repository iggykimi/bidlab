"""«Pregúntale al pliego»: speech-to-text + tool calling, bound to tool results.

The provider is a mocked ``httpx.post`` (no network); everything else is
the real path: seeded Tías DB, pricing engine, eligibility, live gate,
spend ledger, receipts.
"""

import io
import json
import struct
import wave
from pathlib import Path
from typing import Any

import httpx
import pytest
from bidlab.db import models
from bidlab.db.session import get_engine
from bidlab.schemas import generated as g
from bidlab.services import assistant, meta_adapter
from bidlab.settings import get_settings
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[4]
ANSWERS = "/api/v1/tenders/tias/assistant/answers"
TRANSCRIPTIONS = "/api/v1/tenders/tias/assistant/transcriptions"


def _pricing_context() -> dict[str, Any]:
    raw = (ROOT / "examples" / "evaluation_request.json").read_text(encoding="utf-8")
    payload: dict[str, Any] = json.loads(raw)
    payload["pricing_rule_id"] = "tias-price-r1"
    payload["curve"] = None
    return payload


def _ask(question: str = "¿Y si bajo un 12 %?") -> dict[str, Any]:
    return {
        "question": question,
        "scope_id": "tias-whole",
        "pricing_context": _pricing_context(),
        "allow_remote_processing": True,
    }


def _headers(key: str) -> dict[str, str]:
    return {"X-BidLab-Client": "local-ui", "Idempotency-Key": key}


def _usage() -> dict[str, Any]:
    return {"prompt_tokens": 1000, "completion_tokens": 200}


def _tool_turn(*calls: tuple[str, dict[str, Any]]) -> dict[str, Any]:
    return {
        "id": "mock-ask-tools",
        "choices": [
            {
                "finish_reason": "tool_calls",
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": f"call-{index}",
                            "type": "function",
                            "function": {"name": name, "arguments": json.dumps(args)},
                        }
                        for index, (name, args) in enumerate(calls)
                    ],
                },
            }
        ],
        "usage": _usage(),
    }


def _final(answer: str, figures: list[dict[str, Any]]) -> dict[str, Any]:
    content = json.dumps({"answer": answer, "figures": figures})
    return {
        "id": "mock-ask-final",
        "choices": [{"finish_reason": "stop", "message": {"content": content}}],
        "usage": _usage(),
    }


def _tool_results(request: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Tool name -> parsed tool message, as a copying model would read them."""
    by_id = {
        call["id"]: call["function"]["name"]
        for message in request["messages"]
        if message["role"] == "assistant"
        for call in message["tool_calls"]
    }
    return {
        by_id[message["tool_call_id"]]: json.loads(message["content"])
        for message in request["messages"]
        if message["role"] == "tool"
    }


@pytest.fixture()
def live_env(seeded_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("MODEL_API_KEY", "test-key-not-a-secret")
    monkeypatch.setenv("BIDLAB_MODE", "live")
    monkeypatch.setenv(meta_adapter.META_API_URL_ENV, "https://meta.test/v1/chat/completions")
    monkeypatch.delenv(meta_adapter.META_TRANSCRIBE_URL_ENV, raising=False)
    get_settings.cache_clear()
    return seeded_client


def _blocked(*args: object, **kwargs: object) -> object:
    raise AssertionError("the provider must not be called")


def _ask_rows() -> tuple[list[models.ModelInvocation], list[models.ModelSpendReservation]]:
    with Session(get_engine()) as session:
        invocations = list(
            session.scalars(
                select(models.ModelInvocation)
                .where(models.ModelInvocation.prompt_version == assistant.PROMPT_VERSION)
                .order_by(models.ModelInvocation.id)
            ).all()
        )
        reservations = [session.get(models.ModelSpendReservation, row.id) for row in invocations]
        return invocations, [r for r in reservations if r is not None]


def test_answer_round_trip_binds_engine_and_pliego_figures(
    live_env: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    sent: list[dict[str, Any]] = []

    def _model(url: str, **kwargs: Any) -> httpx.Response:
        sent.append(kwargs["json"])
        if len(sent) == 1:
            return httpx.Response(
                200,
                json=_tool_turn(
                    ("evaluate_discount", {"discount_percent": "12", "change_points": None}),
                    ("find_requirements", {"topic": "solvencia técnica servicios similares"}),
                ),
            )
        # A model that copies: price from the engine, threshold + quote from the pliego.
        results = _tool_results(kwargs["json"])
        price = next(f for f in results["evaluate_discount"]["figures"] if f["unit"] == "eur")
        found = results["find_requirements"]
        requirement = next(r for r in found["requirements"] if r["threshold"])
        quote = found["quotes"][0]
        return httpx.Response(
            200,
            json=_final(
                "Con una rebaja del 12 % este es tu precio. Te piden servicios similares.",
                [
                    {**price, "source": "engine", "page": None, "citation_id": None},
                    {
                        "label": "Servicios similares que te piden",
                        **requirement["threshold"],
                        "source": "pliego",
                        "page": quote["page"],
                        "citation_id": quote["citation_id"],
                    },
                ],
            ),
        )

    monkeypatch.setattr(httpx, "post", _model)
    res = live_env.post(ANSWERS, json=_ask(), headers=_headers("k-ask-ok"))
    assert res.status_code == 201, res.text
    body = g.AssistantAnswer.model_validate(res.json()).model_dump(mode="json")
    price, threshold = body["figures"]
    # Golden Tías: 118336.00 with a 12 % discount, computed by the engine.
    assert price == {
        "label": "Precio de tu oferta sin impuestos",
        "value": "104135.68",
        "unit": "eur",
        "source": "engine",
        "page": None,
        "citation_id": None,
    }
    assert (threshold["value"], threshold["unit"], threshold["source"]) == (
        "207088.00",
        "eur",
        "pliego",
    )
    assert threshold["page"] == 6
    assert body["tools_used"] == ["evaluate_discount", "find_requirements"]
    assert len(body["invocations"]) == 2

    # Server-built prompt, strict schema, tools offered then answered in-context.
    first, second = sent
    assert first["response_format"]["json_schema"]["strict"] is True
    assert {tool["function"]["name"] for tool in first["tools"]} == {
        "evaluate_discount",
        "find_requirements",
    }
    assert "untrusted" in first["messages"][0]["content"]
    packet = json.loads(first["messages"][1]["content"])
    assert packet["current_offer"] == {"discount_percent": "5"}
    assert [m["role"] for m in second["messages"]] == [
        "system",
        "user",
        "assistant",
        "tool",
        "tool",
    ]

    # Every call left a receipt and settled its reservation.
    invocations, reservations = _ask_rows()
    assert [row.status for row in invocations] == ["ok", "ok"]
    assert all(row.job_id is None for row in invocations)
    assert [r.state for r in reservations] == ["settled", "settled"]

    # Replay never pays twice.
    monkeypatch.setattr(httpx, "post", _blocked)
    replay = live_env.post(ANSWERS, json=_ask(), headers=_headers("k-ask-ok"))
    assert replay.status_code == 200
    assert replay.json()["figures"] == body["figures"]


def test_answer_text_localizes_bound_figures_es_es(
    live_env: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    sent: list[dict[str, Any]] = []

    def _model(url: str, **kwargs: Any) -> httpx.Response:
        sent.append(kwargs["json"])
        if len(sent) == 1:
            return httpx.Response(
                200,
                json=_tool_turn(
                    ("evaluate_discount", {"discount_percent": "12", "change_points": None}),
                ),
            )
        results = _tool_results(kwargs["json"])
        figures = results["evaluate_discount"]["figures"]
        price = next(f for f in figures if f["label"] == "Precio de tu oferta sin impuestos")
        profit = next(f for f in figures if f["label"] == "Tu beneficio")
        points = next(f for f in figures if f["unit"] == "points")
        answer = (
            f"Con esa rebaja tu precio es {price['value']}, "
            f"tu beneficio {profit['value']} y tus puntos {points['value']}."
        )
        return httpx.Response(
            200,
            json=_final(
                answer,
                [
                    {**price, "source": "engine", "page": None, "citation_id": None},
                    {**profit, "source": "engine", "page": None, "citation_id": None},
                    {**points, "source": "engine", "page": None, "citation_id": None},
                ],
            ),
        )

    monkeypatch.setattr(httpx, "post", _model)
    res = live_env.post(ANSWERS, json=_ask(), headers=_headers("k-ask-es-format"))
    assert res.status_code == 201, res.text
    body = g.AssistantAnswer.model_validate(res.json()).model_dump(mode="json")
    assert "14.135,68" in body["answer"]
    assert "14135.68" not in body["answer"]
    assert "49.000000000000" not in body["answer"]
    profit_figure = next(f for f in body["figures"] if f["label"] == "Tu beneficio")
    assert profit_figure["value"] == "14135.68"


def test_answer_accepts_null_word_for_absent_tool_arg(
    live_env: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Live models write the word null for the absent strict-schema key."""

    def _model(url: str, **kwargs: Any) -> httpx.Response:
        if "tool_calls" not in json.dumps(kwargs["json"].get("messages", [])):
            return httpx.Response(
                200,
                json=_tool_turn(
                    ("evaluate_discount", {"discount_percent": "12", "change_points": "null"}),
                ),
            )
        results = _tool_results(kwargs["json"])
        price = next(f for f in results["evaluate_discount"]["figures"] if f["unit"] == "eur")
        return httpx.Response(
            200,
            json=_final(
                "Con una rebaja del 12 % este es tu precio.",
                [{**price, "source": "engine", "page": None, "citation_id": None}],
            ),
        )

    monkeypatch.setattr(httpx, "post", _model)
    res = live_env.post(ANSWERS, json=_ask(), headers=_headers("k-ask-nullword"))
    assert res.status_code == 201, res.text
    body = g.AssistantAnswer.model_validate(res.json()).model_dump(mode="json")
    assert body["figures"][0]["value"] == "104135.68"


@pytest.mark.parametrize(
    ("answer", "figure"),
    [
        (
            "Tu precio sería este.",
            {"label": "Precio", "value": "99999.99", "unit": "eur"},
        ),
        ("Tu precio sería de 101.000 €.", None),
    ],
    ids=["invented-figure", "invented-number-in-text"],
)
def test_answer_not_bound_to_tools_is_rejected_with_receipts(
    live_env: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    answer: str,
    figure: dict[str, Any] | None,
) -> None:
    replies = iter(
        [
            _tool_turn(("evaluate_discount", {"discount_percent": "12", "change_points": None})),
            _final(
                answer,
                [{**figure, "source": "engine", "page": None, "citation_id": None}]
                if figure
                else [],
            ),
        ]
    )
    monkeypatch.setattr(httpx, "post", lambda *a, **k: httpx.Response(200, json=next(replies)))
    res = live_env.post(ANSWERS, json=_ask(), headers=_headers("k-ask-bad"))
    assert res.status_code == 502
    assert res.json()["code"] == "invalid_model_output"
    invocations, reservations = _ask_rows()
    assert [row.status for row in invocations] == ["ok", "failed"]
    assert invocations[1].provider_request_id == "mock-ask-final"
    assert [r.state for r in reservations] == ["settled", "settled"]


def test_last_call_carries_no_tools(live_env: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    sent: list[dict[str, Any]] = []

    def _always_tools(url: str, **kwargs: Any) -> httpx.Response:
        sent.append(kwargs["json"])
        return httpx.Response(200, json=_tool_turn(("find_requirements", {"topic": "seguro"})))

    monkeypatch.setattr(httpx, "post", _always_tools)
    res = live_env.post(ANSWERS, json=_ask("¿Qué seguro me piden?"), headers=_headers("k-ask-3"))
    assert res.status_code == 502
    assert len(sent) == assistant.MAX_MODEL_CALLS
    assert "tools" not in sent[-1]


@pytest.mark.parametrize("url", [ANSWERS, TRANSCRIPTIONS])
def test_without_provider_is_503_and_reserves_nothing(
    seeded_client: TestClient, monkeypatch: pytest.MonkeyPatch, url: str
) -> None:
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    monkeypatch.delenv(meta_adapter.META_API_URL_ENV, raising=False)
    monkeypatch.setattr(httpx, "post", _blocked)
    get_settings.cache_clear()
    if url == ANSWERS:
        res = seeded_client.post(url, json=_ask(), headers=_headers("k-ask-503"))
    else:
        res = seeded_client.post(
            url,
            files={"audio": ("q.wav", _wav(2.0), "audio/wav")},
            data={"allow_remote_processing": "true"},
            headers=_headers("k-stt-503"),
        )
    assert res.status_code == 503
    assert res.json()["code"] == "provider_not_configured"
    with Session(get_engine()) as session:
        assert session.scalars(select(models.ModelSpendReservation)).all() == []


def test_budget_refusal_is_429_before_any_call(
    live_env: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(httpx, "post", _blocked)
    monkeypatch.setenv("BIDLAB_META_BUDGET_USD", "0.00")
    get_settings.cache_clear()
    res = live_env.post(ANSWERS, json=_ask(), headers=_headers("k-ask-budget"))
    assert res.status_code == 429
    assert res.json()["code"] == "budget_exhausted"


def _wav(seconds: float, *, rate: int = 16_000, channels: int = 1) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as clip:
        clip.setnchannels(channels)
        clip.setsampwidth(2)
        clip.setframerate(rate)
        clip.writeframes(struct.pack("<h", 0) * int(seconds * rate) * channels)
    return buffer.getvalue()


def test_transcription_sends_wav_and_settles_billed_seconds(
    live_env: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[dict[str, Any]] = []

    def _stt(url: str, **kwargs: Any) -> httpx.Response:
        calls.append({"url": url, **kwargs})
        return httpx.Response(
            200,
            json={
                "sessionId": "mock-stt-session",
                "transcript": " ¿Y si bajo   un 12 %? ",
                "audioDurationMs": 2400,
                "turns": [],
            },
        )

    monkeypatch.setattr(httpx, "post", _stt)
    res = live_env.post(
        TRANSCRIPTIONS,
        files={"audio": ("q.wav", _wav(2.4), "audio/wav")},
        data={"allow_remote_processing": "true"},
        headers=_headers("k-stt-ok"),
    )
    assert res.status_code == 201, res.text
    body = g.AssistantTranscription.model_validate(res.json()).model_dump(mode="json")
    assert body["text"] == "¿Y si bajo un 12 %?"
    assert body["invocation"]["model"] == "muse-voice-transcribe-1.0"
    assert body["invocation"]["provider_request_id"] == "mock-stt-session"
    # Two whole seconds billed at 0.18 USD per hour.
    assert body["invocation"]["estimated_cost_usd"] == "0.000100"

    (call,) = calls
    assert call["url"] == "https://meta.test/v1/asr/transcribe"
    request = json.loads(call["files"]["request"][1])
    assert request == {
        "model": "muse-voice-transcribe-1.0",
        "audioEncoding": "WAV",
        "mode": "PUSH_TO_TALK",
        "languageBias": ["Spanish"],
    }
    assert call["files"]["audio"][1][:4] == b"RIFF"
    with Session(get_engine()) as session:
        key = body["invocation"]["invocation_id"]
        reservation = session.get(models.ModelSpendReservation, key)
        assert reservation is not None
        assert (reservation.state, reservation.actual_micro_usd) == ("settled", 100)


@pytest.mark.parametrize(
    ("audio", "consent", "status", "code"),
    [
        (_wav(2.0), "false", 400, "remote_processing_not_allowed"),
        (b"OggS" + b"\0" * 400, "true", 415, "unsupported_media"),
        (_wav(2.0, channels=2), "true", 415, "unsupported_media"),
        (_wav(2.0, rate=8_000), "true", 415, "unsupported_media"),
        (_wav(0.1), "true", 422, "audio_empty"),
        (_wav(61.0, rate=16_000)[: assistant.MAX_AUDIO_BYTES], "true", 422, "audio_too_long"),
        (b"RIFF" + b"\0" * assistant.MAX_AUDIO_BYTES, "true", 413, "upload_too_large"),
    ],
    ids=["no-consent", "not-wav", "stereo", "8khz", "empty", "over-60s", "over-2mb"],
)
def test_audio_guards_never_reach_the_provider(
    live_env: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    audio: bytes,
    consent: str,
    status: int,
    code: str,
) -> None:
    monkeypatch.setattr(httpx, "post", _blocked)
    res = live_env.post(
        TRANSCRIPTIONS,
        files={"audio": ("q.wav", audio, "audio/wav")},
        data={"allow_remote_processing": consent},
        headers=_headers(f"k-stt-{code}"),
    )
    assert res.status_code == status, res.text
    assert res.json()["code"] == code


def test_transcription_error_is_unbilled_and_keeps_its_receipt(
    live_env: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Failed transcriptions are documented as not billed: settle at zero, never hold."""
    monkeypatch.setattr(httpx, "post", lambda *a, **k: httpx.Response(400, json={}))
    res = live_env.post(
        TRANSCRIPTIONS,
        files={"audio": ("q.wav", _wav(2.0), "audio/wav")},
        data={"allow_remote_processing": "true"},
        headers=_headers("k-stt-400"),
    )
    assert res.status_code == 502
    assert res.json()["code"] == "provider_failure"
    with Session(get_engine()) as session:
        invocation = session.scalars(
            select(models.ModelInvocation).where(
                models.ModelInvocation.prompt_version == assistant.TRANSCRIBE_PROMPT_VERSION
            )
        ).one()
        assert (invocation.status, invocation.estimated_cost_usd) == ("failed", "0.000000")
        reservation = session.get(models.ModelSpendReservation, invocation.id)
        assert reservation is not None
        assert (reservation.state, reservation.actual_micro_usd) == ("settled", 0)
