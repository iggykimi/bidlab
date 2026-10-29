"""Offline, provider-free tests for strict JSON Schema preflight.

Target repo path: apps/api/tests/unit/test_meta_schema_preflight.py
"""

from __future__ import annotations

import pytest
from bidlab.services.meta_schema_preflight import (
    MetaSchemaPreflightError,
    check_meta_strict_schema,
)


def _good() -> dict:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "value": {"anyOf": [{"type": "string"}, {"type": "null"}]},
            "source": {
                "type": "object",
                "additionalProperties": False,
                "properties": {"page": {"type": "integer"}},
                "required": ["page"],
            },
        },
        "required": ["value", "source"],
    }


def test_valid_nested_nullable_schema() -> None:
    stats = check_meta_strict_schema(_good())
    assert stats.total_properties == 3
    assert stats.max_object_depth == 2


@pytest.mark.parametrize(
    "mutator",
    [
        lambda s: s.pop("additionalProperties"),
        lambda s: s.update(required=["value"]),
        lambda s: s.update(oneOf=[{"type": "object"}]),
        lambda s: s.update(anyOf=[{"type": "object"}]),
        lambda s: s["properties"]["source"].update(additionalProperties=True),
        lambda s: s["properties"]["value"].update(oneOf=[{"type": "string"}]),
        lambda s: s["properties"]["value"].update(**{"$ref": "#/$defs/Unknown"}),
    ],
)
def test_malformed_schema_fails_closed(mutator) -> None:
    schema = _good()
    mutator(schema)
    with pytest.raises(MetaSchemaPreflightError):
        check_meta_strict_schema(schema)


def test_property_limit() -> None:
    schema = _good()
    schema["properties"] = {f"p{i}": {"type": "string"} for i in range(5001)}
    schema["required"] = list(schema["properties"])
    with pytest.raises(MetaSchemaPreflightError, match="5000 properties"):
        check_meta_strict_schema(schema)


def test_recursive_python_structure_is_rejected() -> None:
    schema = _good()
    schema["properties"]["loop"] = schema
    schema["required"].append("loop")
    with pytest.raises(MetaSchemaPreflightError, match="recursive"):
        check_meta_strict_schema(schema)
