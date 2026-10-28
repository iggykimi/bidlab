"""Shared transport primitives. Mirrors the API_CONTRACT Money/Decimal/EntityId shapes."""

from collections.abc import Mapping
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field

IDText = Annotated[str, Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")]
MoneyText = Annotated[str, Field(pattern=r"^\d{1,12}\.\d{2}$")]
DecimalText = Annotated[str, Field(pattern=r"^-?\d{1,12}(\.\d{1,12})?$")]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


def inline_json_refs(
    node: Any, defs: Mapping[str, Any], *, max_depth: int = 50, depth: int = 0
) -> Any:
    """Return ``node`` with ``#/$defs/`` references replaced by their target."""
    if depth > max_depth:
        msg = "model schema exceeds the supported nesting depth"
        raise ValueError(msg)
    if isinstance(node, dict):
        ref = node.get("$ref")
        if set(node.keys()) == {"$ref"} and isinstance(ref, str):
            target = defs.get(ref.removeprefix("#/$defs/")) if ref.startswith("#/$defs/") else None
            if not isinstance(target, dict):
                msg = f"unresolvable schema reference {ref!r}"
                raise ValueError(msg)
            return inline_json_refs(target, defs, max_depth=max_depth, depth=depth + 1)
        return {
            str(key): inline_json_refs(item, defs, max_depth=max_depth, depth=depth + 1)
            for key, item in node.items()
        }
    if isinstance(node, list):
        return [inline_json_refs(item, defs, max_depth=max_depth, depth=depth + 1) for item in node]
    return node
