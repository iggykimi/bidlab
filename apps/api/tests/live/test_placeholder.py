"""Live Meta tests land in T16. Never a fixture asserting live behavior."""

import pytest

pytestmark = pytest.mark.skip(reason="T16: live extraction adapter not implemented yet")


def test_live_placeholder() -> None:
    raise AssertionError("unreachable")
