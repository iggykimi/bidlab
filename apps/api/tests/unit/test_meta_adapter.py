"""T16: stub honesty, typed failures (I07) and the live gate."""

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
        meta_adapter.StubExtractor(meta_adapter.StubScenario.INVALID_JSON).extract(
            _pages()
        )
    assert exc.value.code == "invalid_model_output"


def test_stub_truncated_stays_explicit() -> None:
    result = meta_adapter.StubExtractor(meta_adapter.StubScenario.TRUNCATED).extract(
        _pages()
    )
    assert any("truncated" in w for w in result.warnings)
    g.ExtractionProposal.model_validate(result.proposal)


def test_pages_input_hash_deterministic() -> None:
    assert meta_adapter.pages_input_hash(_pages()) == meta_adapter.pages_input_hash(
        _pages()
    )


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
