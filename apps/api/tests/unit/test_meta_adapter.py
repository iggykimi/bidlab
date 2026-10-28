"""T16: stub honesty, typed failures (I07) and the live gate."""

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


# --- Bounded hybrid packet (PKG-T06) ---


def _page_inputs() -> list[meta_adapter.PageInput]:
    return [
        meta_adapter.PageInput(
            document_id="doc-a",
            page_number=6,
            normalized_text="precio neto 118336.00 euros",
            document_sha256="a" * 64,
        ),
        meta_adapter.PageInput(
            document_id="doc-a",
            page_number=10,
            normalized_text="plazo 24 meses",
            document_sha256="a" * 64,
        ),
    ]


def _tiny_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {"fact": {"type": "string"}},
        "required": ["fact"],
        "additionalProperties": False,
    }


def _image_page() -> meta_adapter.PageInput:
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
        b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
    )
    return meta_adapter.PageInput(
        document_id="doc-a",
        page_number=6,
        normalized_text="precio neto",
        document_sha256="a" * 64,
        image_bytes=png,
        image_id="im-doc-a-6",
        image_sha256="b" * 64,
        image_width=100,
        image_height=200,
    )


def test_hybrid_envelope_shape() -> None:
    payload, packet = meta_adapter.build_hybrid_request(_page_inputs(), _tiny_schema())
    assert set(payload.keys()) == {"model", "messages", "max_completion_tokens", "response_format"}
    assert "reasoning_effort" not in payload
    assert "pages" not in payload
    assert payload["model"] == "muse-spark-1.3"
    assert payload["max_completion_tokens"] == meta_adapter.MAX_COMPLETION_TOKENS
    messages = payload["messages"]
    assert [part["role"] for part in messages] == ["system", "user"]
    assert "Return unknowns as null" in messages[0]["content"]
    parts = messages[1]["content"]
    assert [part["type"] for part in parts] == ["text", "text"]
    first = json.loads(parts[0]["text"])
    assert first["source"]["document_id"] == "doc-a"
    assert first["source"]["physical_page"] == 6
    assert first["source"]["image_id"] is None
    assert first["page_text"] == "precio neto 118336.00 euros"
    response_format = payload["response_format"]
    assert response_format["type"] == "json_schema"
    assert response_format["json_schema"]["name"] == "bidlab_extraction_v1"
    assert response_format["json_schema"]["strict"] is True
    assert response_format["json_schema"]["schema"]["type"] == "object"
    assert len(packet["pages"]) == 2
    assert len(packet["payload_identity"]) == 64
    assert len(packet["schema_sha256"]) == 64
    assert packet["semantic_review"] == "pending"
    assert packet["mode"] == "request_built_not_executed"


def test_hybrid_image_part_shape() -> None:
    payload, packet = meta_adapter.build_hybrid_request([_image_page()], _tiny_schema())
    parts = payload["messages"][1]["content"]
    assert [part["type"] for part in parts] == ["text", "image_url"]
    assert parts[1]["image_url"]["url"].startswith("data:image/png;base64,")
    meta = packet["pages"][0]
    assert meta["image_id"] == "im-doc-a-6"
    assert meta["image_sha256"] == "b" * 64
    assert (meta["image_width"], meta["image_height"]) == (100, 200)


def test_hybrid_empty_text_with_image_ok() -> None:
    page = meta_adapter.PageInput(
        document_id="doc-a",
        page_number=1,
        normalized_text="",
        document_sha256="a" * 64,
        image_bytes=b"\x89PNG Adams",
        image_id="im-1",
        image_sha256="c" * 64,
        image_width=10,
        image_height=10,
    )
    payload, _packet = meta_adapter.build_hybrid_request([page], _tiny_schema())
    assert len(payload["messages"][1]["content"]) == 2


def test_hybrid_reasoning_opt_in_changes_identity() -> None:
    plain, _ = meta_adapter.build_hybrid_request(_page_inputs(), _tiny_schema())
    assert "reasoning_effort" not in plain
    medium, _ = meta_adapter.build_hybrid_request(
        _page_inputs(), _tiny_schema(), reasoning_effort="medium"
    )
    assert medium["reasoning_effort"] == "medium"
    with pytest.raises(ValueError):
        meta_adapter.build_hybrid_request(_page_inputs(), _tiny_schema(), reasoning_effort="high")


def test_hybrid_manifest_identity_stable() -> None:
    _, first = meta_adapter.build_hybrid_request(_page_inputs(), _tiny_schema())
    _, second = meta_adapter.build_hybrid_request(_page_inputs(), _tiny_schema())
    assert first["payload_identity"] == second["payload_identity"]
    changed = [
        meta_adapter.PageInput(document_id="doc-a", page_number=6, normalized_text="other text")
    ]
    _, third = meta_adapter.build_hybrid_request(changed, _tiny_schema())
    assert third["payload_identity"] != first["payload_identity"]


def test_hybrid_rejects_out_of_bounds_packets() -> None:
    schema = _tiny_schema()
    with pytest.raises(ValueError):
        meta_adapter.build_hybrid_request([], schema)
    many = [
        meta_adapter.PageInput(document_id="d", page_number=n + 1, normalized_text="x")
        for n in range(7)
    ]
    with pytest.raises(ValueError):
        meta_adapter.build_hybrid_request(many, schema)
    with pytest.raises(ValueError):
        meta_adapter.build_hybrid_request(_page_inputs(), {"type": "array"})
    dup = [*_page_inputs(), _page_inputs()[0]]
    with pytest.raises(ValueError):
        meta_adapter.build_hybrid_request(dup, schema)
    long_text = "x" * (meta_adapter.MAX_HYBRID_TEXT_CHARS + 1)
    with pytest.raises(ValueError):
        meta_adapter.build_hybrid_request(
            [meta_adapter.PageInput(document_id="d", page_number=1, normalized_text=long_text)],
            schema,
        )
    big_image = b"\x89PNG" + bytes(meta_adapter.MAX_HYBRID_IMAGE_BYTES)
    with pytest.raises(ValueError):
        meta_adapter.build_hybrid_request(
            [
                meta_adapter.PageInput(
                    document_id="d",
                    page_number=1,
                    normalized_text="x",
                    image_bytes=big_image,
                    image_id="im",
                    image_sha256="d" * 64,
                    image_width=1,
                    image_height=1,
                )
            ],
            schema,
        )
    for bad_output in (0, 127, 16385, True, "4096"):
        with pytest.raises(ValueError):
            meta_adapter.build_hybrid_request(
                _page_inputs(),
                schema,
                max_completion_tokens=bad_output,  # type: ignore[arg-type]
            )


@pytest.mark.parametrize(
    "page",
    [
        meta_adapter.PageInput(document_id="", page_number=1, normalized_text="x"),
        meta_adapter.PageInput(document_id="d", page_number=0, normalized_text="x"),
        meta_adapter.PageInput(document_id="d", page_number=1, normalized_text=""),
        meta_adapter.PageInput(
            document_id="d",
            page_number=1,
            normalized_text="x",
            image_bytes=b"\x89PNG",
            image_id=None,
            image_sha256="d" * 64,
            image_width=1,
            image_height=1,
        ),
        meta_adapter.PageInput(
            document_id="d",
            page_number=1,
            normalized_text="x",
            image_bytes=b"\x89PNG",
            image_id="im",
            image_sha256="d" * 64,
            image_width=0,
            image_height=1,
        ),
        meta_adapter.PageInput(
            document_id="d",
            page_number=1,
            normalized_text="x",
            image_bytes=b"\x89PNG",
            image_id="im",
            image_sha256="d" * 64,
            image_width=1,
            image_height=1,
            image_mime="image/gif",
        ),
    ],
)
def test_hybrid_rejects_bad_pages(page: meta_adapter.PageInput) -> None:
    with pytest.raises(ValueError):
        meta_adapter.build_hybrid_request([page], _tiny_schema())


def test_validate_claim_sources() -> None:
    packet = [{"document_id": "doc-a", "physical_page": 6}]
    meta_adapter.validate_claim_sources({"claims": []}, packet)
    meta_adapter.validate_claim_sources({"claims": [{"citations": []}]}, packet)
    meta_adapter.validate_claim_sources({"claims": "nope"}, packet)
    ok = {"claims": [{"citations": [{"document_id": "doc-a", "page_number": 6}]}]}
    meta_adapter.validate_claim_sources(ok, packet)
    bad = {"claims": [{"citations": [{"document_id": "doc-x", "page_number": 99}]}]}
    with pytest.raises(meta_adapter.AdapterError) as exc:
        meta_adapter.validate_claim_sources(bad, packet)
    assert exc.value.code == "invalid_model_output"
    assert exc.value.receipt is None


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
    assert set(sent.keys()) == {"model", "messages", "max_completion_tokens", "response_format"}
    assert sent["model"] == "muse-spark-1.3"
    assert sent["max_completion_tokens"] == meta_adapter.MAX_COMPLETION_TOKENS
    assert sent["response_format"]["json_schema"]["name"] == "bidlab_extraction_v1"
    assert sent["response_format"]["json_schema"]["strict"] is True
    assert result.packet_manifest is not None
    assert result.packet_manifest["semantic_review"] == "pending"
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


def _live_adapter() -> meta_adapter.LiveExtractor:
    return meta_adapter.LiveExtractor(
        api_key="test-key", model="muse-spark-1.3", endpoint_url="https://meta.test/chat"
    )


def test_live_invalid_json_keeps_receipt(monkeypatch: pytest.MonkeyPatch) -> None:
    """PKG-T01/B01: billed-but-invalid answers keep mode/model/id/usage/latency."""
    import httpx

    body = _chat_body("{invalid-json")
    body["usage"] = {"prompt_tokens": 12000, "completion_tokens": 3000}
    monkeypatch.setattr(httpx, "post", lambda *a, **k: _FakeResponse(200, body))
    with pytest.raises(meta_adapter.AdapterError) as exc:
        _live_adapter().extract(_pages())
    assert exc.value.code == "invalid_model_output"
    receipt = exc.value.receipt
    assert receipt is not None
    assert receipt.mode == "live"
    assert receipt.model == "muse-spark-1.3"
    assert receipt.provider_request_id == "chatcmpl-test-1"
    assert receipt.prompt_tokens == 12000
    assert receipt.completion_tokens == 3000
    assert receipt.estimated_cost_usd == meta_adapter.estimate_cost_usd(12000, 3000)
    assert receipt.latency_ms >= 0
    assert receipt.status == "failed"
    assert receipt.sent is True


def test_live_timeout_is_uncertain(monkeypatch: pytest.MonkeyPatch) -> None:
    """PKG-T01: a timeout may still have run server-side; usage stays null."""
    import httpx

    def _timeout(*args: object, **kwargs: object) -> object:
        raise httpx.TimeoutException("read timed out")

    monkeypatch.setattr(httpx, "post", _timeout)
    with pytest.raises(meta_adapter.AdapterError) as exc:
        _live_adapter().extract(_pages())
    assert exc.value.code == "provider_failure"
    receipt = exc.value.receipt
    assert receipt is not None
    assert receipt.status == "uncertain"
    assert receipt.sent is True
    assert receipt.prompt_tokens is None
    assert receipt.completion_tokens is None
    assert receipt.estimated_cost_usd is None
    assert receipt.latency_ms >= 0


def test_live_connect_error_marks_not_sent(monkeypatch: pytest.MonkeyPatch) -> None:
    import httpx

    def _refused(*args: object, **kwargs: object) -> object:
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(httpx, "post", _refused)
    with pytest.raises(meta_adapter.AdapterError) as exc:
        _live_adapter().extract(_pages())
    assert exc.value.code == "provider_failure"
    receipt = exc.value.receipt
    assert receipt is not None
    assert receipt.status == "failed"
    assert receipt.sent is False


def test_body_receipt_ignores_mistyped_usage() -> None:
    receipt = meta_adapter.body_receipt(
        {"id": 123, "usage": {"prompt_tokens": True, "completion_tokens": -5}},
        latency_ms=7,
        model_requested="muse-spark-1.3",
    )
    assert receipt.provider_request_id == "123"
    assert receipt.prompt_tokens is None
    assert receipt.completion_tokens is None
    assert receipt.estimated_cost_usd is None
    assert receipt.latency_ms == 7


def test_stub_failures_carry_no_receipt() -> None:
    with pytest.raises(meta_adapter.AdapterError) as exc:
        meta_adapter.StubExtractor(meta_adapter.StubScenario.REFUSAL).extract(_pages())
    assert exc.value.receipt is None


def test_live_extract_rejects_citation_outside_packet_with_receipt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """PKG-T06 acceptance: strange echoes are refused but stay on the receipt."""
    import httpx

    proposal = json.loads(_valid_proposal_json())
    proposal["claims"] = [
        {
            "key": "budget_net",
            "raw_value": None,
            "normalized_value": None,
            "unit": None,
            "citations": [
                {
                    "document_id": "doc-a",
                    "page_number": 99,
                    "verbatim_excerpt": "phantom quote",
                }
            ],
            "confidence": "high",
            "status": "proposed",
            "notes": [],
        }
    ]
    body = _chat_body(json.dumps(proposal))
    monkeypatch.setattr(httpx, "post", lambda *a, **k: _FakeResponse(200, body))
    with pytest.raises(meta_adapter.AdapterError) as exc:
        _live_adapter().extract(_pages())
    assert exc.value.code == "invalid_model_output"
    assert "outside submitted packet" in exc.value.message
    receipt = exc.value.receipt
    assert receipt is not None
    assert receipt.mode == "live"
    assert receipt.prompt_tokens == 100
    assert receipt.completion_tokens == 50
