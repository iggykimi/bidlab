"""T16: stub honesty, typed failures (I07) and the live gate."""

import hashlib
import importlib
import json
from pathlib import Path
from typing import Any

import pytest
from bidlab.api.errors import ApiError
from bidlab.schemas import generated as g
from bidlab.services import meta_adapter
from bidlab.settings import get_settings


def _pages() -> list[meta_adapter.PageInput]:
    return [
        meta_adapter.PageInput("doc-a", 6, "precio neto 118336.00 euros"),
        meta_adapter.PageInput("doc-a", 10, "plazo 24 meses"),
    ]


def test_stub_proposal_is_schema_valid_and_empty() -> None:
    result = meta_adapter.StubExtractor().extract(_pages())
    proposal = g.ExtractionProposal.model_validate(result.proposal)
    assert proposal.claims == []
    assert proposal.requirements == []
    assert [p.root for p in proposal.unread_pages] == [6, 10]
    assert result.mode == "fixture"
    assert result.model is None
    assert result.prompt_tokens is None
    assert result.completion_tokens is None
    assert result.cached_tokens is None
    assert result.provider_request_id is None
    assert result.estimated_cost_usd is None


def test_stub_warnings_mark_demo_and_offline() -> None:
    result = meta_adapter.StubExtractor().extract(_pages())
    assert any("fixture_stub" in w for w in result.warnings)
    assert any("no model was called" in w for w in result.warnings)


def test_stub_makes_no_network_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    import socket

    def _blocked(*args: object, **kwargs: object) -> object:
        raise AssertionError("stub must not open sockets")

    monkeypatch.setattr(socket, "socket", _blocked)
    result = meta_adapter.StubExtractor().extract(_pages())
    assert result.status == "ok"


def test_stub_refusal_and_invalid_json_raise_typed_errors() -> None:
    with pytest.raises(meta_adapter.AdapterError) as exc:
        meta_adapter.StubExtractor(meta_adapter.StubScenario.REFUSAL).extract(_pages())
    assert exc.value.code == "provider_refusal"
    with pytest.raises(meta_adapter.AdapterError) as exc:
        meta_adapter.StubExtractor(meta_adapter.StubScenario.INVALID_JSON).extract(_pages())
    assert exc.value.code == "invalid_model_output"


def test_stub_truncated_stays_explicit() -> None:
    result = meta_adapter.StubExtractor(meta_adapter.StubScenario.TRUNCATED).extract(_pages())
    assert any("truncated" in w for w in result.warnings)
    g.ExtractionProposal.model_validate(result.proposal)


def test_pages_input_hash_deterministic() -> None:
    assert meta_adapter.pages_input_hash(_pages()) == meta_adapter.pages_input_hash(_pages())


def test_select_adapter_demo_needs_no_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    monkeypatch.delenv(meta_adapter.META_API_URL_ENV, raising=False)
    get_settings.cache_clear()
    try:
        adapter = meta_adapter.select_adapter("curated_demo")
    finally:
        get_settings.cache_clear()
    assert adapter.is_live is False


def test_select_adapter_live_without_key_is_503(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    get_settings.cache_clear()
    try:
        with pytest.raises(ApiError) as exc:
            meta_adapter.select_adapter("live")
    finally:
        get_settings.cache_clear()
    assert exc.value.status_code == 503
    assert exc.value.code == "provider_not_configured"


def test_select_adapter_live_without_endpoint_is_503(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MODEL_API_KEY", "test-key-not-a-secret")
    monkeypatch.delenv(meta_adapter.META_API_URL_ENV, raising=False)
    get_settings.cache_clear()
    try:
        with pytest.raises(ApiError) as exc:
            meta_adapter.select_adapter("live")
    finally:
        get_settings.cache_clear()
    assert exc.value.status_code == 503


def test_select_adapter_live_with_key_and_endpoint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MODEL_API_KEY", "test-key-not-a-secret")
    monkeypatch.setenv(meta_adapter.META_API_URL_ENV, "http://127.0.0.1:9/unverified")
    get_settings.cache_clear()
    try:
        adapter = meta_adapter.select_adapter("live")
    finally:
        get_settings.cache_clear()
    assert adapter.is_live is True


# --- Official chat/completions translation (revision 2026-10-27) ---


def _page_dicts() -> list[dict[str, Any]]:
    return [
        {"document_id": "doc-a", "page_number": 6, "text": "precio neto 118336.00 euros"},
        {"document_id": "doc-a", "page_number": 10, "text": "plazo 24 meses"},
    ]


def _tiny_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {"fact": {"type": "string"}},
        "required": ["fact"],
        "additionalProperties": False,
    }


def test_request_uses_official_envelope() -> None:
    payload = meta_adapter.build_chat_request(_page_dicts(), _tiny_schema())
    assert set(payload.keys()) == {"model", "messages", "response_format"}
    assert "pages" not in payload
    assert "prompt_version" not in payload
    assert payload["model"] == "muse-spark-1.3"
    messages = payload["messages"]
    assert [m["role"] for m in messages] == ["system", "user"]
    assert "null for unknown" in messages[0]["content"]
    user_pages = json.loads(messages[1]["content"])["pages"]
    assert [(p["document_id"], p["page_number"]) for p in user_pages] == [
        ("doc-a", 6),
        ("doc-a", 10),
    ]
    assert (
        user_pages[0]["text_sha256"] == hashlib.sha256(b"precio neto 118336.00 euros").hexdigest()
    )
    response_format = payload["response_format"]
    assert response_format["type"] == "json_schema"
    assert response_format["json_schema"]["name"] == "bidlab_extraction"
    assert response_format["json_schema"]["schema"]["type"] == "object"


def test_request_rejects_empty_pages() -> None:
    with pytest.raises(ValueError):
        meta_adapter.build_chat_request([], _tiny_schema())


@pytest.mark.parametrize(
    "page",
    [
        {"page_number": 1, "text": "x"},
        {"document_id": "", "page_number": 1, "text": "x"},
        {"document_id": "d", "page_number": 0, "text": "x"},
        {"document_id": "d", "page_number": True, "text": "x"},
        {"document_id": "d", "page_number": "1", "text": "x"},
        {"document_id": "d", "page_number": 1, "text": None},
    ],
)
def test_request_rejects_untyped_pages(page: dict[str, Any]) -> None:
    with pytest.raises(ValueError):
        meta_adapter.build_chat_request([page], _tiny_schema())


def test_request_rejects_non_object_schema() -> None:
    with pytest.raises(ValueError):
        meta_adapter.build_chat_request(_page_dicts(), {"type": "array"})


def test_extraction_schema_derived_from_proposal() -> None:
    schema = meta_adapter.extraction_json_schema()
    serialized = json.dumps(schema)
    assert '"$ref"' not in serialized
    assert '"$defs"' not in serialized
    assert schema["type"] == "object"
    assert set(schema["required"]) == {
        "schema_version",
        "claims",
        "requirements",
        "pricing_formula",
        "anomaly_text",
        "anomaly_citations",
        "unread_pages",
        "warnings",
    }
    formula = schema["properties"]["pricing_formula"]
    assert formula["properties"]["template_hint"]["enum"] == [
        "proportional_inverse",
        "linear_discount",
        "log_ratio",
        "unsupported",
    ]
    # Amounts stay strings, unknown stays null.
    max_points = formula["properties"]["max_points"]["anyOf"]
    string_branches = [b for b in max_points if b.get("type") == "string"]
    assert len(string_branches) == 1
    assert string_branches[0]["pattern"] == r"^-?\d{1,12}(\.\d{1,12})?$"
    assert any(b.get("type") == "null" for b in max_points)
    raw_value = schema["properties"]["claims"]["items"]["properties"]["raw_value"]["anyOf"]
    assert any(b.get("type") == "null" for b in raw_value)


def _chat_body(content: str, *, finish_reason: str = "stop") -> dict[str, Any]:
    return {
        "id": "chatcmpl-test-1",
        "model": "muse-spark-1.3",
        "choices": [
            {
                "finish_reason": finish_reason,
                "message": {"role": "assistant", "content": content},
            }
        ],
        "usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150},
    }


def _valid_proposal_json() -> str:
    proposal = meta_adapter.StubExtractor().extract(_pages()).proposal
    return json.dumps(proposal)


def test_parse_valid_response_revalidates_with_pydantic() -> None:
    proposal = meta_adapter.parse_chat_response(
        _chat_body(_valid_proposal_json()), validate=g.ExtractionProposal.model_validate
    )
    assert proposal.schema_version == "1.0"
    assert proposal.claims == []


def test_parse_truncated_response_rejected() -> None:
    with pytest.raises(meta_adapter.AdapterError) as exc:
        meta_adapter.parse_chat_response(
            _chat_body(_valid_proposal_json(), finish_reason="length"),
            validate=g.ExtractionProposal.model_validate,
        )
    assert exc.value.code == "invalid_model_output"


def test_parse_refusal_rejected() -> None:
    with pytest.raises(meta_adapter.AdapterError) as exc:
        meta_adapter.parse_chat_response(
            _chat_body("", finish_reason="refusal"),
            validate=g.ExtractionProposal.model_validate,
        )
    assert exc.value.code == "provider_refusal"


def test_parse_unknown_finish_reason_rejected() -> None:
    with pytest.raises(meta_adapter.AdapterError) as exc:
        meta_adapter.parse_chat_response(
            _chat_body(_valid_proposal_json(), finish_reason="error"),
            validate=g.ExtractionProposal.model_validate,
        )
    assert exc.value.code == "invalid_model_output"


def test_parse_missing_choice_rejected() -> None:
    with pytest.raises(meta_adapter.AdapterError) as exc:
        meta_adapter.parse_chat_response({}, validate=g.ExtractionProposal.model_validate)
    assert exc.value.code == "invalid_model_output"


def test_parse_invalid_json_content_rejected() -> None:
    with pytest.raises(meta_adapter.AdapterError) as exc:
        meta_adapter.parse_chat_response(
            _chat_body("not json{"), validate=g.ExtractionProposal.model_validate
        )
    assert exc.value.code == "invalid_model_output"


def test_parse_validator_rejection_is_not_hidden() -> None:
    def _reject(candidate: dict[str, Any]) -> Any:
        raise ValueError("schema or evidence invalid")

    with pytest.raises(ValueError, match="schema or evidence invalid"):
        meta_adapter.parse_chat_response(_chat_body("{}"), validate=_reject)


def test_parse_unknown_template_hint_fails_schema() -> None:
    from pydantic import ValidationError

    proposal = json.loads(_valid_proposal_json())
    proposal["pricing_formula"]["template_hint"] = "invented_template"
    with pytest.raises(ValidationError):
        meta_adapter.parse_chat_response(
            _chat_body(json.dumps(proposal)), validate=g.ExtractionProposal.model_validate
        )


class _FakeResponse:
    def __init__(self, status_code: int, payload: Any) -> None:
        self.status_code = status_code
        self._payload = payload

    def json(self) -> Any:
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


def test_live_extract_posts_official_envelope(monkeypatch: pytest.MonkeyPatch) -> None:
    import httpx

    calls: list[dict[str, Any]] = []

    def _fake_post(
        url: str,
        json: Any = None,
        headers: Any = None,
        timeout: Any = None,
    ) -> _FakeResponse:
        calls.append({"url": url, "json": json, "headers": headers, "timeout": timeout})
        return _FakeResponse(200, _chat_body(_valid_proposal_json()))

    monkeypatch.setattr(httpx, "post", _fake_post)
    adapter = meta_adapter.LiveExtractor(
        api_key="test-key", model="muse-spark-1.3", endpoint_url="https://meta.test/chat"
    )
    result = adapter.extract(_pages())
    assert len(calls) == 1
    assert calls[0]["url"] == "https://meta.test/chat"
    assert calls[0]["headers"]["Authorization"] == "Bearer test-key"
    sent = calls[0]["json"]
    assert set(sent.keys()) == {"model", "messages", "response_format"}
    assert sent["model"] == "muse-spark-1.3"
    assert sent["response_format"]["json_schema"]["name"] == "bidlab_extraction"
    assert result.mode == "live"
    assert result.status == "ok"
    assert result.model == "muse-spark-1.3"
    assert result.returned_model == "muse-spark-1.3"
    assert result.prompt_tokens == 100
    assert result.completion_tokens == 50
    assert result.provider_request_id == "chatcmpl-test-1"
    assert result.estimated_cost_usd == "0.000338"
    assert result.warnings == ()
    g.ExtractionProposal.model_validate(result.proposal)


def test_live_extract_429_raises_without_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    import httpx

    calls: list[str] = []

    def _fake_post(url: str, **kwargs: Any) -> _FakeResponse:
        calls.append(url)
        return _FakeResponse(429, {"error": "rate limited"})

    monkeypatch.setattr(httpx, "post", _fake_post)
    adapter = meta_adapter.LiveExtractor(
        api_key="test-key", model="muse-spark-1.3", endpoint_url="https://meta.test/chat"
    )
    with pytest.raises(meta_adapter.AdapterError) as exc:
        adapter.extract(_pages())
    assert exc.value.code == "provider_rate_limited"
    assert len(calls) == 1


def test_live_extract_server_error_and_non_json(monkeypatch: pytest.MonkeyPatch) -> None:
    import httpx

    monkeypatch.setattr(httpx, "post", lambda *a, **k: _FakeResponse(500, {}))
    adapter = meta_adapter.LiveExtractor(
        api_key="test-key", model="muse-spark-1.3", endpoint_url="https://meta.test/chat"
    )
    with pytest.raises(meta_adapter.AdapterError) as exc:
        adapter.extract(_pages())
    assert exc.value.code == "provider_failure"

    monkeypatch.setattr(httpx, "post", lambda *a, **k: _FakeResponse(200, ValueError("no json")))
    with pytest.raises(meta_adapter.AdapterError) as exc:
        adapter.extract(_pages())
    assert exc.value.code == "invalid_model_output"


def test_live_extract_truncated_body_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    import httpx

    body = _chat_body(_valid_proposal_json(), finish_reason="length")
    monkeypatch.setattr(httpx, "post", lambda *a, **k: _FakeResponse(200, body))
    adapter = meta_adapter.LiveExtractor(
        api_key="test-key", model="muse-spark-1.3", endpoint_url="https://meta.test/chat"
    )
    with pytest.raises(meta_adapter.AdapterError) as exc:
        adapter.extract(_pages())
    assert exc.value.code == "invalid_model_output"


def test_live_extract_empty_pages_rejected() -> None:
    adapter = meta_adapter.LiveExtractor(
        api_key="test-key", model="muse-spark-1.3", endpoint_url="https://meta.test/chat"
    )
    with pytest.raises(meta_adapter.AdapterError) as exc:
        adapter.extract([])
    assert exc.value.code == "bad_request"


def test_estimate_cost_usd() -> None:
    assert meta_adapter.estimate_cost_usd(100, 50) == "0.000338"
    assert meta_adapter.estimate_cost_usd(None, 50) is None
    assert meta_adapter.estimate_cost_usd(100, None) is None
    assert meta_adapter.estimate_cost_usd(0, 0) == "0.000000"


def test_stub_deterministic() -> None:
    first = meta_adapter.StubExtractor().extract(_pages())
    second = meta_adapter.StubExtractor().extract(_pages())
    assert first.proposal == second.proposal
    assert first.warnings == second.warnings
    assert first.mode == second.mode == "fixture"
    assert first.model is None


def test_build_run_manifest_contents() -> None:
    pages = _pages()
    proposal = meta_adapter.StubExtractor().extract(pages).proposal
    manifest = meta_adapter.build_run_manifest(
        run_id="inv-job-1-a1",
        mode="fixture",
        pages=pages,
        model_requested=None,
        model_returned=None,
        schema_version="1.0",
        status="ok",
        provider_request_id=None,
        prompt_tokens=None,
        completion_tokens=None,
        cached_tokens=None,
        proposal=proposal,
        citation_ids=["cit-1"],
        citations_unmatched=1,
        started_at="2026-10-27T00:00:00+00:00",
        finished_at="2026-10-27T00:00:01+00:00",
    )
    assert manifest["run_id"] == "inv-job-1-a1"
    assert manifest["mode"] == "fixture"
    assert manifest["schema_version"] == "1.0"
    assert manifest["prompt_version"] == meta_adapter.PROMPT_VERSION
    assert manifest["input_hash"] == meta_adapter.pages_input_hash(pages)
    assert [(p["document_id"], p["page_number"]) for p in manifest["pages"]] == [
        ("doc-a", 6),
        ("doc-a", 10),
    ]
    assert all(len(p["text_sha256"]) == 64 for p in manifest["pages"])
    assert manifest["usage"] == {
        "prompt_tokens": None,
        "completion_tokens": None,
        "cached_tokens": None,
    }
    assert manifest["citation_ids"] == ["cit-1"]
    assert manifest["citations_unmatched"] == 1
    assert manifest["human_review"] == "pending"
    assert len(manifest["proposal_sha256"]) == 64
    serialized = json.dumps(manifest)
    assert "precio neto" not in serialized
    assert "MODEL_API_KEY" not in serialized


def test_provider_unreachable_from_offline_paths() -> None:
    """Pricing, curve, scenario, report, demo and review code never calls the model."""
    import bidlab.services.jobs as jobs_module

    assert jobs_module.__file__ is not None
    # Positive control: the analysis-job path is the only caller.
    assert "select_adapter" in Path(jobs_module.__file__).read_text(encoding="utf-8")
    offline = [
        "evaluation",
        "scenarios",
        "demo",
        "reports",
        "review",
        "workspace",
        "companies",
        "seed",
        "eligibility",
        "idempotency",
        "pdf",
    ]
    forbidden = [
        "meta_adapter",
        "LiveExtractor",
        "StubExtractor",
        "select_adapter",
        "MODEL_API_KEY",
        "META_API_URL",
        "chat/completions",
        "httpx",
    ]
    for name in offline:
        module = importlib.import_module(f"bidlab.services.{name}")
        assert module.__file__ is not None
        source = Path(module.__file__).read_text(encoding="utf-8")
        for token in forbidden:
            assert token not in source, f"{name} must not reference {token}"
