"""Health route integration (no DB, no network beyond loopback TestClient)."""

from bidlab.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_health_ok() -> None:
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body == {"status": "ok", "engine_version": "1.0.0", "schema_version": "1.0.0"}


def test_capabilities_demo_shape() -> None:
    res = client.get("/api/v1/capabilities")
    assert res.status_code == 200
    body = res.json()
    assert body["mode"] in ("demo", "live", "manual")
    assert isinstance(body["meta_configured"], bool)
    assert body["limits"] == {"pdf_bytes": 20971520, "pdf_pages": 120, "curve_points": 201}
    assert set(body) == {
        "mode",
        "meta_configured",
        "meta_model",
        "history_enabled",
        "limits",
        "limitations",
    }
    assert "MODEL_API_KEY" not in res.text
