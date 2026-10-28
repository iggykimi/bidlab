"""PKG-T07: observations v2 contract, packet bindings and the v1 review adapt."""

import json
import pathlib
from typing import Any, cast

import pytest
from bidlab.schemas import generated as g
from bidlab.schemas import observations as obs
from bidlab.services import meta_adapter
from pydantic import ValidationError

DOC_SHA = "a" * 64
IMG_SHA = "b" * 64
OTHER_SHA = "c" * 64


def _qualifier(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "scope_id": None,
        "unit": None,
        "currency": None,
        "tax_basis": None,
        "period_segment": None,
        "reference_kind": None,
    }
    base.update(overrides)
    return base


def _source(page: int, **overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "document_id": "doc-a",
        "document_sha256": DOC_SHA,
        "physical_page": page,
        "verbatim_excerpt": f"excerpt p.{page}",
        "image_id": None,
        "image_sha256": None,
        "bbox_0_1000": None,
    }
    base.update(overrides)
    return base


def _observation(
    item_id: str, field: str, value: Any, page: int, **overrides: Any
) -> dict[str, Any]:
    qualifier = _qualifier(**overrides.pop("qualifier", {}))
    source = _source(page, **overrides.pop("source", {}))
    data: dict[str, Any] = {
        "id": item_id,
        "field": field,
        "value": value,
        "qualifier": qualifier,
        "source": source,
        "status": "proposed",
    }
    data.update(overrides)
    return data


def _proposal(items: list[dict[str, Any]], **overrides: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "schema_version": "2.0-proposal",
        "observations": items,
        "ambiguities": [],
        "unread_image_ids": [],
    }
    data.update(overrides)
    return data


def _packet_pages() -> list[dict[str, Any]]:
    return [
        {
            "document_id": "doc-a",
            "document_sha256": DOC_SHA,
            "physical_page": 6,
            "text_sha256": "t" * 64,
            "image_id": None,
            "image_sha256": None,
        },
        {
            "document_id": "doc-a",
            "document_sha256": DOC_SHA,
            "physical_page": 10,
            "text_sha256": "u" * 64,
            "image_id": "im-doc-a-10",
            "image_sha256": IMG_SHA,
            "image_width": 100,
            "image_height": 200,
        },
    ]


def _bound(item_id: str = "ob-1", page: int = 6, **overrides: Any) -> obs.ObservationsProposal:
    field = overrides.pop("field", "budget_net")
    value = overrides.pop("value", "118336.00")
    raw = _proposal([_observation(item_id, field, value, page, **overrides)])
    return obs.ObservationsProposal.model_validate(raw)


# --- Contract shape ------------------------------------------------------


def test_package_shaped_example_validates_with_bbox_arrays() -> None:
    """Bbox arrives as a JSON array (never a tuple); image binding included."""
    raw = _proposal(
        [
            _observation(
                "ob-1",
                "budget_net",
                "118336.00",
                10,
                qualifier={"unit": "EUR", "tax_basis": "net"},
                source={
                    "image_id": "im-doc-a-10",
                    "image_sha256": IMG_SHA,
                    "bbox_0_1000": [80, 300, 900, 380],
                },
            ),
            _observation("ob-2", "period_months", "24", 6),
        ],
        ambiguities=["page 6 header repeats the budget"],
        unread_image_ids=[],
    )
    proposal = obs.ObservationsProposal.model_validate(raw)
    assert proposal.schema_version == "2.0-proposal"
    assert proposal.observations[0].source.bbox_0_1000 == [80, 300, 900, 380]
    assert proposal.observations[1].source.image_id is None
    assert proposal.ambiguities == ["page 6 header repeats the budget"]


@pytest.mark.parametrize(
    "box",
    [[1, 1, 1, 1], [90, 90, 10, 10], [0, 0, 1001, 10], [-1, 0, 10, 10], [0, 0, 10]],
)
def test_bbox_must_be_a_proper_box_inside_the_grid(box: list[int]) -> None:
    raw = _proposal([_observation("ob-1", "budget_net", "1.00", 6, source={"bbox_0_1000": box})])
    with pytest.raises(ValidationError):
        obs.ObservationsProposal.model_validate(raw)


def test_strict_model_rejects_extras_and_open_vocabulary() -> None:
    raw = _proposal([_observation("ob-1", "budget_net", "1.00", 6, invented="x")])
    with pytest.raises(ValidationError):
        obs.ObservationsProposal.model_validate(raw)
    raw = _proposal([_observation("ob-1", "invented_field", "1.00", 6)])
    with pytest.raises(ValidationError):
        obs.ObservationsProposal.model_validate(raw)
    raw = _proposal([_observation("ob-1", "budget_net", "1.00", 6, status="approved")])
    with pytest.raises(ValidationError):
        obs.ObservationsProposal.model_validate(raw)
    raw = _proposal(
        [_observation("ob-1", "budget_net", "1.00", 6)],
        schema_version="1.0",
    )
    with pytest.raises(ValidationError):
        obs.ObservationsProposal.model_validate(raw)
    raw = _proposal(
        [_observation("ob-1", "budget_net", "1.00", 6, source={"document_sha256": "zz"})]
    )
    with pytest.raises(ValidationError):
        obs.ObservationsProposal.model_validate(raw)


def test_observations_schema_is_self_contained() -> None:
    schema = obs.observations_json_schema()
    assert schema["type"] == "object"
    assert '"$ref"' not in json.dumps(schema)
    assert set(schema["required"]) == {
        "schema_version",
        "observations",
        "ambiguities",
        "unread_image_ids",
    }
    fields = schema["properties"]["observations"]["items"]["properties"]["field"]
    assert fields["enum"] == [
        "budget_net",
        "period_months",
        "max_price_points",
        "pricing_formula_literal",
        "anomaly_literal",
        "other_requirement",
    ]
    bbox = schema["properties"]["observations"]["items"]["properties"]["source"]["properties"][
        "bbox_0_1000"
    ]["anyOf"][0]
    assert (bbox["type"], bbox["minItems"], bbox["maxItems"]) == ("array", 4, 4)
    assert schema["properties"]["observations"]["maxItems"] == 40


# --- Packet bindings -----------------------------------------------------


def _check(proposal: obs.ObservationsProposal) -> None:
    meta_adapter.validate_observation_sources(proposal, _packet_pages())


def test_bindings_accept_text_and_image_sources() -> None:
    raw = _proposal(
        [
            _observation("ob-1", "budget_net", "118336.00", 6),
            _observation(
                "ob-2",
                "period_months",
                "24",
                10,
                source={
                    "image_id": "im-doc-a-10",
                    "image_sha256": IMG_SHA,
                    "bbox_0_1000": [0, 0, 10, 10],
                },
            ),
        ]
    )
    _check(obs.ObservationsProposal.model_validate(raw))


def test_binding_rejects_wrong_document_sha() -> None:
    proposal = _bound(source={"document_sha256": OTHER_SHA})
    with pytest.raises(meta_adapter.AdapterError) as exc:
        _check(proposal)
    assert exc.value.code == "invalid_model_output"
    assert "outside submitted packet" in exc.value.message


def test_binding_rejects_unsubmitted_page() -> None:
    proposal = _bound(page=99)
    with pytest.raises(meta_adapter.AdapterError) as exc:
        _check(proposal)
    assert exc.value.code == "invalid_model_output"
    assert "doc-a p.99" in exc.value.message


def test_binding_rejects_unknown_image_id() -> None:
    proposal = _bound(page=10, source={"image_id": "im-phantom", "image_sha256": IMG_SHA})
    with pytest.raises(meta_adapter.AdapterError) as exc:
        _check(proposal)
    assert exc.value.code == "invalid_model_output"
    assert "image outside the submitted packet" in exc.value.message


def test_binding_rejects_image_sha_mismatch() -> None:
    proposal = _bound(page=10, source={"image_id": "im-doc-a-10", "image_sha256": OTHER_SHA})
    with pytest.raises(meta_adapter.AdapterError) as exc:
        _check(proposal)
    assert exc.value.code == "invalid_model_output"


def test_binding_rejects_image_id_without_sha() -> None:
    proposal = _bound(page=10, source={"image_id": "im-doc-a-10"})
    with pytest.raises(meta_adapter.AdapterError) as exc:
        _check(proposal)
    assert "id xor sha" in exc.value.message
    proposal = _bound(page=10, source={"image_sha256": IMG_SHA})
    with pytest.raises(meta_adapter.AdapterError) as exc:
        _check(proposal)
    assert "id xor sha" in exc.value.message


def test_binding_rejects_bbox_without_image() -> None:
    proposal = _bound(source={"bbox_0_1000": [0, 0, 10, 10]})
    with pytest.raises(meta_adapter.AdapterError) as exc:
        _check(proposal)
    assert "bbox without a bound image" in exc.value.message


def test_binding_rejects_duplicate_ids() -> None:
    raw = _proposal(
        [
            _observation("ob-dup", "budget_net", "1.00", 6),
            _observation("ob-dup", "period_months", "2", 6),
        ]
    )
    with pytest.raises(meta_adapter.AdapterError) as exc:
        _check(obs.ObservationsProposal.model_validate(raw))
    assert "duplicate observation id" in exc.value.message


# --- v2 -> v1 adapt --------------------------------------------------------


def test_value_claim_carries_raw_and_qualifiers() -> None:
    proposal = _bound(
        qualifier={"unit": "EUR", "currency": "EUR", "tax_basis": "net"},
    )
    adapted = meta_adapter.observations_to_proposal(proposal)
    assert adapted.schema_version == "1.0"
    assert len(adapted.claims) == 1
    claim = adapted.claims[0]
    assert claim.key == "budget_net"
    assert claim.raw_value is not None and claim.raw_value.root == "118336.00"
    assert claim.normalized_value is None
    assert claim.unit is not None and claim.unit.root == "EUR"
    assert claim.status == "proposed"
    assert claim.confidence == "medium"
    assert len(claim.citations) == 1
    citation = claim.citations[0]
    assert (citation.document_id.root, citation.page_number) == ("doc-a", 6)
    assert citation.verbatim_excerpt == "excerpt p.6"
    notes = [note.root for note in claim.notes]
    assert "currency: EUR" in notes
    assert "tax basis: net" in notes


def test_null_value_is_not_found_with_searched_note() -> None:
    proposal = _bound(value=None)
    adapted = meta_adapter.observations_to_proposal(proposal)
    claim = adapted.claims[0]
    assert claim.status == "not_found"
    assert claim.raw_value is None and claim.normalized_value is None
    assert claim.citations == []
    assert [note.root for note in claim.notes] == ["searched: doc-a p.6"]


def test_missing_excerpt_omits_citation_with_note() -> None:
    proposal = _bound(source={"verbatim_excerpt": None})
    adapted = meta_adapter.observations_to_proposal(proposal)
    claim = adapted.claims[0]
    assert claim.status == "proposed"
    assert claim.citations == []
    assert [note.root for note in claim.notes] == ["source excerpt missing: doc-a p.6"]


def test_bbox_rides_in_a_grounding_note() -> None:
    proposal = _bound(
        page=10,
        source={
            "image_id": "im-doc-a-10",
            "image_sha256": IMG_SHA,
            "bbox_0_1000": [80, 300, 900, 380],
        },
    )
    adapted = meta_adapter.observations_to_proposal(proposal)
    notes = [note.root for note in adapted.claims[0].notes]
    assert "visual evidence: im-doc-a-10 bbox [80, 300, 900, 380]" in notes


def test_first_formula_wins_and_extras_become_claims() -> None:
    raw = _proposal(
        [
            _observation("ob-1", "pricing_formula_literal", "Pi = 49 * min/Oi", 6),
            _observation("ob-2", "pricing_formula_literal", "second literal", 10),
            _observation("ob-3", "pricing_formula_literal", None, 6),
        ]
    )
    adapted = meta_adapter.observations_to_proposal(obs.ObservationsProposal.model_validate(raw))
    formula = adapted.pricing_formula
    assert formula.formula_literal is not None
    assert formula.formula_literal.root == "Pi = 49 * min/Oi"
    assert formula.template_hint == "unsupported"
    assert formula.max_points is None
    assert len(formula.citations) == 1
    assert [claim.key for claim in adapted.claims] == [
        "pricing_formula_literal",
        "pricing_formula_literal",
    ]
    assert [claim.status for claim in adapted.claims] == ["proposed", "not_found"]


def test_anomaly_text_keeps_the_winner_citation() -> None:
    raw = _proposal(
        [
            _observation("ob-1", "anomaly_literal", "baja anormal si...", 6),
            _observation("ob-2", "anomaly_literal", "other paragraph", 10),
        ]
    )
    adapted = meta_adapter.observations_to_proposal(obs.ObservationsProposal.model_validate(raw))
    assert adapted.anomaly_text is not None
    assert adapted.anomaly_text.root == "baja anormal si..."
    assert len(adapted.anomaly_citations) == 1
    assert adapted.anomaly_citations[0].page_number == 6
    assert [claim.key for claim in adapted.claims] == ["anomaly_literal"]


def test_requirement_mapping_with_null_fallbacks() -> None:
    raw = _proposal(
        [
            _observation("ob-req-1", "other_requirement", "have ISO 9001", 6),
            _observation(
                "ob-req-2",
                "other_requirement",
                None,
                10,
                source={"verbatim_excerpt": None},
            ),
        ]
    )
    adapted = meta_adapter.observations_to_proposal(obs.ObservationsProposal.model_validate(raw))
    assert len(adapted.requirements) == 2
    first, second = adapted.requirements
    assert (first.key, first.label) == ("ob-req-1", "have ISO 9001")
    assert first.category == "other"
    assert first.logic_hint == "unknown"
    assert first.condition_text == "have ISO 9001"
    assert len(first.citations) == 1
    assert second.label == "observation ob-req-2"
    assert second.condition_text == ""
    assert second.citations == []


def test_ambiguities_and_unread_images_become_warnings() -> None:
    raw = _proposal(
        [_observation("ob-1", "budget_net", "1.00", 6)],
        ambiguities=["two totals on p.6"],
        unread_image_ids=["im-doc-a-10"],
    )
    adapted = meta_adapter.observations_to_proposal(obs.ObservationsProposal.model_validate(raw))
    assert [warning.root for warning in adapted.warnings] == [
        "two totals on p.6",
        "unread image: im-doc-a-10",
    ]


def test_long_excerpt_truncates_with_a_summary_warning() -> None:
    raw = _proposal(
        [_observation("ob-1", "budget_net", "1.00", 6, source={"verbatim_excerpt": "x" * 700})]
    )
    adapted = meta_adapter.observations_to_proposal(obs.ObservationsProposal.model_validate(raw))
    excerpt = adapted.claims[0].citations[0].verbatim_excerpt
    assert len(excerpt) == 600
    assert excerpt.endswith("…")
    assert [warning.root for warning in adapted.warnings] == ["1 excerpts truncated to 600 chars"]


def test_empty_observations_adapt_to_valid_empty_v1() -> None:
    adapted = meta_adapter.observations_to_proposal(
        obs.ObservationsProposal.model_validate(_proposal([]))
    )
    assert adapted.claims == []
    assert adapted.requirements == []
    assert adapted.pricing_formula.formula_literal is None
    assert adapted.anomaly_text is None
    assert adapted.unread_pages == []
    assert adapted.warnings == []


def test_budget_caps_hold_at_40_observations() -> None:
    items = [
        _observation(f"ob-{index:02d}", "budget_net", f"{index}.00", 6 if index % 2 else 10)
        for index in range(40)
    ]
    raw = _proposal(
        items,
        ambiguities=[f"doubt {index}" for index in range(20)],
        unread_image_ids=[f"im-{index}" for index in range(6)],
    )
    adapted = meta_adapter.observations_to_proposal(obs.ObservationsProposal.model_validate(raw))
    assert len(adapted.claims) == 40
    assert len(adapted.warnings) == 26


# --- Live wiring (mocked transport) ----------------------------------------


class _FakeResponse:
    def __init__(self, payload: Any) -> None:
        self.status_code = 200
        self._payload = payload

    def json(self) -> Any:
        return self._payload


def test_live_round_trip_binds_images_and_keeps_raw_v2(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The live path sends v2, binds the echo and keeps raw v2 in the packet."""
    import httpx

    content = _proposal(
        [
            _observation(
                "ob-1",
                "budget_net",
                "118336.00",
                10,
                qualifier={"unit": "EUR"},
                source={
                    "image_id": "im-doc-a-10",
                    "image_sha256": IMG_SHA,
                    "bbox_0_1000": [80, 300, 900, 380],
                },
            )
        ]
    )
    body = {
        "id": "chatcmpl-obs-1",
        "model": "muse-spark-1.3",
        "choices": [{"finish_reason": "stop", "message": {"content": json.dumps(content)}}],
        "usage": {"prompt_tokens": 100, "completion_tokens": 50},
    }
    calls: list[dict[str, Any]] = []

    def _fake_post(url: str, **kwargs: Any) -> _FakeResponse:
        calls.append({"url": url, "json": kwargs["json"]})
        return _FakeResponse(body)

    monkeypatch.setattr(httpx, "post", _fake_post)
    pages = [
        meta_adapter.PageInput(
            "doc-a",
            10,
            "precio neto",
            document_sha256=DOC_SHA,
            image_bytes=b"fake-png-bytes",
            image_id="im-doc-a-10",
            image_sha256=IMG_SHA,
            image_width=100,
            image_height=200,
        )
    ]
    adapter = meta_adapter.LiveExtractor(
        api_key="test-key", model="muse-spark-1.3", endpoint_url="https://meta.test/chat"
    )
    result = adapter.extract(pages)
    assert len(calls) == 1
    schema = calls[0]["json"]["response_format"]["json_schema"]
    assert schema["name"] == "bidlab_observations_v2"
    assert schema["strict"] is True
    assert "observations" in schema["schema"]["properties"]
    proposal = g.ExtractionProposal.model_validate(result.proposal)
    assert proposal.claims[0].raw_value is not None
    assert proposal.claims[0].raw_value.root == "118336.00"
    assert result.packet_manifest is not None
    assert result.packet_manifest["observations"]["observations"][0]["id"] == "ob-1"


# --- PKG-T08 prompt example --------------------------------------------------


def _prompt_example() -> dict[str, Any]:
    root = pathlib.Path(__file__).resolve().parents[4]
    raw = (root / "examples/observations_prompt_gold.json").read_text(encoding="utf-8")
    return cast("dict[str, Any]", json.loads(raw))


def test_prompt_example_validates_and_separates_kinds() -> None:
    """PBL/estimated, net/gross, initial/extension and lots stay apart."""
    doc = _prompt_example()
    assert doc["kind"] == "synthetic_prompt_example"
    proposal = obs.ObservationsProposal.model_validate(doc["expected"])
    by_id = {item.id: item for item in proposal.observations}
    assert by_id["ob-pbl"].qualifier.reference_kind == "base_budget"
    assert by_id["ob-estimated"].qualifier.reference_kind == "estimated_value"
    assert by_id["ob-pbl"].value != by_id["ob-estimated"].value
    assert by_id["ob-pbl"].qualifier.tax_basis == "net"
    assert by_id["ob-gross"].qualifier.tax_basis == "gross"
    assert by_id["ob-initial"].qualifier.period_segment == "initial"
    assert by_id["ob-extension"].qualifier.period_segment == "extension"
    assert by_id["ob-lot-2"].qualifier.scope_id == "lot-2"
    assert len(proposal.ambiguities) == 1


def test_prompt_example_adapts_to_v1_with_distinguishing_notes() -> None:
    doc = _prompt_example()
    proposal = obs.ObservationsProposal.model_validate(doc["expected"])
    adapted = meta_adapter.observations_to_proposal(proposal)
    notes_by_value = {
        claim.raw_value.root: [note.root for note in claim.notes]
        for claim in adapted.claims
        if claim.raw_value is not None
    }
    assert "reference kind: base_budget" in notes_by_value["250000.00"]
    assert "reference kind: estimated_value" in notes_by_value["500000.00"]
    assert "tax basis: gross" in notes_by_value["302500.00"]
    assert "scope: lot-2" in notes_by_value["60000.00"]
    assert "period segment: initial" in notes_by_value["24"]
    assert "period segment: extension" in notes_by_value["12"]
    assert any("extension" in warning.root for warning in adapted.warnings)
