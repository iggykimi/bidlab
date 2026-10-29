"""Repository integration check: authoritative Pydantic observations schema.

Target path: apps/api/tests/unit/test_meta_schema_contract_v2.py
This test can only be executed within the *actual* BidLab checkout.
"""

from __future__ import annotations

from bidlab.schemas.observations import observations_json_schema
from bidlab.services.meta_schema_preflight import check_meta_strict_schema


def test_actual_observations_v2_schema_passes_meta_strict_preflight() -> None:
    schema = observations_json_schema()
    metrics = check_meta_strict_schema(schema)
    assert schema["type"] == "object"
    assert metrics.total_properties >= 5
    assert metrics.max_object_depth <= 10
