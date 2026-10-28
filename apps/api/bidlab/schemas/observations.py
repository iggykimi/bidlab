"""Observations v2: the live model's response contract (PKG-T07).

Hand-authored mirror of ``contratos/observations.schema.json`` from the
Plan Integral package: document observations with qualifiers and exact
sources. The strict request schema and the response validation share
these models (single origin, no drift). Public API stays v1: the
adapter in ``bidlab.services.meta_adapter`` translates validated
observations into an ``ExtractionProposal`` (compat path sanctioned by
the package), keeping the raw v2 in the run manifest for audit.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import Field, field_validator

from bidlab.schemas.common import StrictModel, inline_json_refs

SCHEMA_VERSION = "2.0-proposal"

ObservationField = Literal[
    "budget_net",
    "period_months",
    "max_price_points",
    "pricing_formula_literal",
    "anomaly_literal",
    "other_requirement",
]

Sha256 = Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
Axis = Annotated[int, Field(ge=0, le=1000)]


class ObservationQualifier(StrictModel):
    scope_id: str | None
    unit: str | None
    currency: str | None
    tax_basis: str | None
    period_segment: str | None
    reference_kind: str | None


class ObservationSource(StrictModel):
    document_id: str
    document_sha256: Sha256
    physical_page: Annotated[int, Field(ge=1)]
    verbatim_excerpt: str | None
    image_id: str | None
    image_sha256: Sha256 | None
    bbox_0_1000: Annotated[list[Axis], Field(min_length=4, max_length=4)] | None

    @field_validator("bbox_0_1000")
    @classmethod
    def _proper_box(cls, value: list[int] | None) -> list[int] | None:
        if value is not None:
            x0, y0, x1, y1 = value
            if not (x1 > x0 and y1 > y0):
                msg = "bbox must be a proper box (x1 > x0 and y1 > y0)"
                raise ValueError(msg)
        return value


class Observation(StrictModel):
    id: str
    field: ObservationField
    value: str | None
    qualifier: ObservationQualifier
    source: ObservationSource
    status: Literal["proposed"]


class ObservationsProposal(StrictModel):
    schema_version: Literal["2.0-proposal"]
    observations: Annotated[list[Observation], Field(max_length=40)]
    ambiguities: Annotated[list[str], Field(max_length=20)]
    unread_image_ids: Annotated[list[str], Field(max_length=6)]


def observations_json_schema() -> dict[str, Any]:
    """Self-contained JSON Schema for strict decoding (no $refs)."""
    raw = ObservationsProposal.model_json_schema()
    defs = raw.pop("$defs", {})
    if not isinstance(defs, dict):
        msg = "unexpected ObservationsProposal schema shape"
        raise TypeError(msg)
    schema = inline_json_refs(raw, {str(key): item for key, item in defs.items()})
    if not isinstance(schema, dict) or schema.get("type") != "object":
        msg = "expected an object schema for ObservationsProposal"
        raise ValueError(msg)
    return schema
