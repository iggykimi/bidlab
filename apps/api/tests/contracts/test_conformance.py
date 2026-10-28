"""O9: the FastAPI app and docs/API_CONTRACT.yaml describe the same API.

Compares routes, success statuses, operationIds, tags and parameters; validates
every contract example against its generated model; probes live error envelopes
against the Error model. Any drift fails loudly here instead of in an SDK.
"""

import pathlib
import sys
from typing import Any, cast

from bidlab.main import app
from bidlab.schemas import generated as g
from bidlab.schemas.common import StrictModel
from fastapi.testclient import TestClient

ROOT = pathlib.Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "tools"))
from build_contract import build_spec  # type: ignore[import-not-found]  # noqa: E402

# In-memory contract (build_spec is stdlib-only; the committed YAML is proven
# byte-equal to it, and the generated models below come from that YAML).
CONTRACT: dict[str, Any]
CONTRACT, _SCHEMAS = build_spec()
APP_SPEC: dict[str, Any] = app.openapi()

_METHODS = {"get", "post", "put", "patch", "delete"}


def _contract_ops() -> dict[tuple[str, str], dict[str, Any]]:
    ops = {}
    for path, item in CONTRACT["paths"].items():
        for method, op in item.items():
            if method in _METHODS:
                ops[(path, method)] = op
    return ops


def _app_ops() -> dict[tuple[str, str], dict[str, Any]]:
    ops = {}
    for path, item in APP_SPEC["paths"].items():
        for method, op in item.items():
            if method in _METHODS:
                ops[(path, method)] = op
    return ops


def _resolve_param(param: dict[str, Any]) -> dict[str, Any]:
    ref = param.get("$ref", "")
    if ref.startswith("#/components/parameters/"):
        return cast("dict[str, Any]", CONTRACT["components"]["parameters"][ref.rsplit("/", 1)[-1]])
    return param


def _model_for(ref: str) -> type[StrictModel]:
    assert ref.startswith("#/components/schemas/"), ref
    return cast("type[StrictModel]", getattr(g, ref.rsplit("/", 1)[-1]))


def test_versions_unified() -> None:
    assert CONTRACT["info"]["version"] == "1.0.0"
    assert app.version == "1.0.0"


def test_route_sets_match() -> None:
    assert set(_app_ops()) == set(_contract_ops())


def test_operation_ids_tags_and_success_status() -> None:
    contract_ops, app_ops = _contract_ops(), _app_ops()
    assert len({op["operationId"] for op in contract_ops.values()}) == len(contract_ops)
    for key, cop in contract_ops.items():
        aop = app_ops[key]
        assert aop["operationId"] == cop["operationId"], key
        assert aop.get("tags", []) == cop.get("tags", []), key
        c_ok = {s for s in cop["responses"] if str(s).startswith("2")}
        a_ok = {s for s in aop["responses"] if str(s).startswith("2")}
        assert a_ok == c_ok, key


def test_parameters_match() -> None:
    contract_ops, app_ops = _contract_ops(), _app_ops()
    for key, cop in contract_ops.items():
        aop = app_ops[key]
        c_params = [_resolve_param(p) for p in cop.get("parameters", [])]
        a_params = aop.get("parameters", [])

        def norm(p: dict[str, Any]) -> tuple[str, str, bool]:
            name = str(p["name"])
            return (name.lower(), str(p["in"]), bool(p.get("required", False)))

        c_norm = {norm(p) for p in c_params}
        a_norm = {norm(p) for p in a_params}
        # X-BidLab-Client is required by contract but optional in the app spec:
        # deps.require_local_client enforces it in code with a 403 envelope
        # (a spec-required header would answer 422 instead).
        c_norm.discard(("x-bidlab-client", "header", True))
        a_norm.discard(("x-bidlab-client", "header", False))
        if key[1] in ("post", "put", "patch", "delete"):
            assert ("x-bidlab-client", "header", True) in {norm(p) for p in c_params}, key
        assert a_norm == c_norm, (key, a_norm ^ c_norm)


def _iter_examples() -> Any:
    for (path, method), op in _contract_ops().items():
        body = op.get("requestBody", {})
        for content in body.get("content", {}).values():
            schema = content.get("schema", {})
            for name, example in content.get("examples", {}).items():
                yield (f"{method} {path} request", schema, name, example["value"])
        for status, response in op.get("responses", {}).items():
            if "$ref" in response:
                continue
            for content in response.get("content", {}).values():
                schema = content.get("schema", {})
                for name, example in content.get("examples", {}).items():
                    yield (f"{method} {path} {status}", schema, name, example["value"])


def test_every_op_has_an_example() -> None:
    for key, op in _contract_ops().items():
        params = [_resolve_param(p) for p in op.get("parameters", [])]
        has_param_example = any("example" in p for p in params)
        body = op.get("requestBody", {})
        has_body_example = any(
            "examples" in content for content in body.get("content", {}).values()
        )
        has_response_example = any(
            "examples" in content
            for response in op.get("responses", {}).values()
            if "$ref" not in response
            for content in response.get("content", {}).values()
        )
        assert has_param_example or has_body_example or has_response_example, key


def test_examples_validate_against_models() -> None:
    count = 0
    for label, schema, _name, value in _iter_examples():
        ref = schema.get("$ref", "")
        assert ref, f"{label}: examples require a $ref schema"
        _model_for(ref).model_validate(value)
        count += 1
    assert count >= 20, f"expected broad example coverage, got {count}"


def test_error_responses_are_shared_refs() -> None:
    responses = CONTRACT["components"]["responses"]
    for key, op in _contract_ops().items():
        for status, response in op.get("responses", {}).items():
            if str(status).startswith("2"):
                continue
            if key == ("/api/v1/ready", "get") and str(status) == "503":
                # Documented exception: readiness 503 carries a Ready body.
                schema = response["content"]["application/json"]["schema"]
                assert schema == {"$ref": "#/components/schemas/Ready"}, key
                continue
            ref = response.get("$ref", "")
            assert ref.startswith("#/components/responses/"), (key, status)
            assert ref.rsplit("/", 1)[-1] in responses, (key, status)


def test_o10_page_size_max_and_pdf_media_type() -> None:
    list_op = CONTRACT["paths"]["/api/v1/tenders"]["get"]
    page_size = next(p for p in list_op["parameters"] if p.get("name") == "page_size")
    assert page_size["schema"]["maximum"] == 100
    app_list = APP_SPEC["paths"]["/api/v1/tenders"]["get"]
    app_page_size = next(p for p in app_list["parameters"] if p["name"] == "page_size")
    assert app_page_size["schema"]["maximum"] == 100
    content = CONTRACT["paths"]["/api/v1/documents/{document_id}/content"]["get"]["responses"][
        "200"
    ]["content"]
    assert list(content) == ["application/pdf"]
    html_content = CONTRACT["paths"]["/api/v1/reports/{report_id}/html"]["get"]["responses"]["200"][
        "content"
    ]
    assert list(html_content) == ["text/html"]


def test_error_envelopes_validate_live(seeded_client: TestClient) -> None:
    probes: list[tuple[str, str, int, str, dict[str, str]]] = [
        ("GET", "/api/v1/tenders/nope", 404, "tender_not_found", {}),
        ("POST", "/api/v1/companies", 403, "forbidden", {}),
        ("PUT", "/api/v1/tenders/tias", 405, "method_not_allowed", {}),
        ("GET", "/api/v1/no-such-route", 404, "not_found", {}),
    ]
    for method, path, status, code, headers in probes:
        res = seeded_client.request(method, path, headers=headers)
        assert res.status_code == status, path
        body = res.json()
        assert body["code"] == code, path
        g.Error.model_validate(body)
    invalid = seeded_client.post(
        "/api/v1/companies", json={}, headers={"X-BidLab-Client": "local-ui"}
    )
    assert invalid.status_code == 422
    assert invalid.json()["code"] == "validation_error"
    g.Error.model_validate(invalid.json())
