"""OpenAPI-vs-contract diff lands in T28; placeholder keeps the gate honest."""

import pytest

pytestmark = pytest.mark.skip(reason="T28: normalized OpenAPI diff not implemented yet")


def test_contract_diff_placeholder() -> None:
    raise AssertionError("unreachable")
