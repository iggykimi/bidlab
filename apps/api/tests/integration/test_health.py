"""Health route integration (no DB, no network beyond loopback TestClient)."""

from bidlab.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_health_ok() -> None:
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body == {"status": "ok", "engine_version": "1.0.0", "schema_version": "1.0.0"}


def test_ready_reports_quick_check(fresh_client: TestClient) -> None:
    res = fresh_client.get("/api/v1/ready")
    assert res.status_code == 200
    assert res.json() == {"status": "ready", "db_quick_check": "ok"}


def test_cors_preflight_allows_put(fresh_client: TestClient) -> None:
    """O7/S1: the Vite dev origin may PUT (company updates) across origins."""
    res = fresh_client.options(
        "/api/v1/companies/x",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "PUT",
        },
    )
    assert res.status_code == 200
    assert "PUT" in res.headers["access-control-allow-methods"]


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
