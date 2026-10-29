"""Offline preflight for BidLab's fully-inlined Meta strict-output schema.

This is a local *necessary-condition* checker, NOT a guarantee of acceptance
by Meta Model API. It performs no network calls and handles no credentials.

Target repo path: apps/api/bidlab/services/meta_schema_preflight.py
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, NoReturn


class MetaSchemaPreflightError(ValueError):
    """The schema violates a documented Meta strict-output constraint."""


def _fail(message: str) -> NoReturn:
    """Raise MetaSchemaPreflightError with a dynamic diagnostic (keeps TRY003 quiet)."""
    raise MetaSchemaPreflightError(message)


@dataclass(frozen=True)
class MetaSchemaMetrics:
    total_properties: int
    total_enum_values: int
    total_string_chars: int
    total_nodes: int
    max_object_depth: int


def check_meta_strict_schema(schema: Mapping[str, Any]) -> MetaSchemaMetrics:
    """Validate a *fully inlined* JSON schema for Chat Completions strict output.

    Follows published Meta limits (29 October 2026): root plain object,
    no allOf/oneOf, each object is closed and fully required, 10 object levels,
    <=5000 properties, <=120000 counted string chars, <=1000 enum members,
    <=200000 expanded nodes. Actual provider acceptance requires a live call.
    """
    if schema.get("type") != "object":
        _fail("$: root must have type='object'")
    if any(key in schema for key in ("anyOf", "oneOf", "allOf", "enum", "not")):
        _fail("$: root must be a plain object")

    properties = 0
    enums = 0
    chars = 0
    nodes = 0
    max_depth = 0
    ancestry: set[int] = set()

    def walk(node: Any, path: str, depth: int) -> None:
        nonlocal properties, enums, chars, nodes, max_depth
        nodes += 1
        if nodes > 200_000:
            _fail(f"{path}: schema exceeds 200000 expanded nodes")
        if isinstance(node, Mapping):
            ident = id(node)
            if ident in ancestry:
                _fail(f"{path}: recursive in-memory schema")
            ancestry.add(ident)
            try:
                if "$ref" in node:
                    _fail(f"{path}: unresolved $ref; use observations_json_schema()")
                for forbidden in ("oneOf", "allOf"):
                    if forbidden in node:
                        _fail(f"{path}: {forbidden} not supported")
                if node.get("type") == "object":
                    depth += 1
                    max_depth = max(max_depth, depth)
                    if depth > 10:
                        _fail(f"{path}: object depth > 10")
                    if node.get("additionalProperties") is not False:
                        _fail(f"{path}: additionalProperties must be false")
                    raw_props = node.get("properties")
                    raw_required = node.get("required")
                    if not isinstance(raw_props, Mapping):
                        _fail(f"{path}: missing properties object")
                    if not isinstance(raw_required, list) or not all(
                        isinstance(v, str) for v in raw_required
                    ):
                        _fail(f"{path}: missing required array")
                    keys = set(raw_props)
                    if len(keys) != len(raw_props) or len(raw_required) != len(set(raw_required)):
                        _fail(f"{path}: duplicate required entries")
                    if set(raw_required) != keys:
                        _fail(f"{path}: required must list every property exactly once")
                    properties += len(raw_props)
                    chars += sum(len(str(key)) for key in raw_props)
                    if properties > 5_000:
                        _fail(f"{path}: more than 5000 properties")
                members = node.get("enum")
                if members is not None:
                    if not isinstance(members, list):
                        _fail(f"{path}: enum must be a list")
                    enums += len(members)
                    if enums > 1_000:
                        _fail(f"{path}: more than 1000 enum entries")
                    long_strings = [v for v in members if isinstance(v, str)]
                    chars += sum(len(v) for v in long_strings)
                    if len(members) > 250 and sum(len(v) for v in long_strings) > 15_000:
                        _fail(f"{path}: large enum exceeds 15000 chars")
                if isinstance(node.get("const"), str):
                    chars += len(node["const"])
                if chars > 120_000:
                    _fail(f"{path}: counted string chars > 120000")
                for key, value in node.items():
                    if key in {"$defs", "definitions"} and isinstance(value, Mapping):
                        chars += sum(len(str(name)) for name in value)
                    if key == "properties" and isinstance(value, Mapping):
                        for name, sub in value.items():
                            walk(sub, f"{path}.properties.{name}", depth)
                    elif key in {"$defs", "definitions"} and isinstance(value, Mapping):
                        for name, sub in value.items():
                            walk(sub, f"{path}.{key}.{name}", depth)
                    elif key in {"anyOf", "allOf", "oneOf"} and isinstance(value, list):
                        for index, sub in enumerate(value):
                            walk(sub, f"{path}.{key}[{index}]", depth)
                    elif key in {
                        "items",
                        "not",
                        "if",
                        "then",
                        "else",
                        "additionalProperties",
                    } and isinstance(value, (Mapping, list)):
                        walk(value, f"{path}.{key}", depth)
                if chars > 120_000:
                    _fail(f"{path}: counted string chars > 120000")
            finally:
                ancestry.remove(ident)
        elif isinstance(node, list):
            for index, child in enumerate(node):
                walk(child, f"{path}[{index}]", depth)

    walk(schema, "$", 0)
    return MetaSchemaMetrics(properties, enums, chars, nodes, max_depth)
