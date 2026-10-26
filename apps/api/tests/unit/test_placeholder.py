"""T05 scaffold proof. Real unit vectors (U01+) land with the engine (T09+)."""

from bidlab import ENGINE_VERSION


def test_engine_version_pinned() -> None:
    assert ENGINE_VERSION == "1.0.0"
