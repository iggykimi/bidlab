"""Compiled UI routing and containment on one local origin."""

from pathlib import Path

import pytest
from bidlab.api.errors import register_handlers
from bidlab.web import LocalFrontend, LocalWebMount
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture()
def web_client(tmp_path: Path) -> TestClient:
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<!doctype html><title>BidLab local</title>")
    (dist / "assets").mkdir()
    (dist / "assets" / "app.js").write_text("console.log('local');")
    (dist / ".env").write_text("LOCAL_TEST_MARKER=do-not-serve")
    (tmp_path / "outside.txt").write_text("OUTSIDE_TEST_MARKER")
    app = FastAPI()
    register_handlers(app)

    @app.get("/api/v1/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.router.routes.append(LocalWebMount("/", app=LocalFrontend(dist)))
    return TestClient(app)


@pytest.mark.parametrize("path", ["/", "/tenders/tias", "/nueva-licitacion"])
def test_direct_react_routes_load_index(web_client: TestClient, path: str) -> None:
    response = web_client.get(path)
    assert response.status_code == 200
    assert "BidLab local" in response.text
    assert response.headers["cache-control"] == "no-cache"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "script-src 'self'" in response.headers["content-security-policy"]


def test_api_routes_keep_priority_and_json_errors(web_client: TestClient) -> None:
    assert web_client.get("/api/v1/health").json() == {"status": "ok"}
    response = web_client.get("/api/v1/missing")
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
    wrong_method = web_client.post("/api/v1/health")
    assert wrong_method.status_code == 405
    assert wrong_method.json()["code"] == "method_not_allowed"


@pytest.mark.parametrize(
    "path", ["/assets/missing.js", "/.env", "/outside.txt", "/%2e%2e/outside.txt", "/unknown"]
)
def test_files_do_not_escape_or_fall_back(web_client: TestClient, path: str) -> None:
    response = web_client.get(path)
    assert response.status_code == 404
    assert "OUTSIDE_TEST_MARKER" not in response.text
    assert "LOCAL_TEST_MARKER" not in response.text
    assert "BidLab local" not in response.text


def test_static_asset_and_head(web_client: TestClient) -> None:
    asset = web_client.get("/assets/app.js")
    assert asset.status_code == 200
    assert "javascript" in asset.headers["content-type"]
    assert asset.headers["x-content-type-options"] == "nosniff"
    head = web_client.head("/tenders/tias")
    assert head.status_code == 200
    assert head.content == b""


def test_symlink_cannot_expose_file_outside_build(tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<title>BidLab local</title>")
    outside = tmp_path / "outside.txt"
    outside.write_text("OUTSIDE_TEST_MARKER")
    try:
        (dist / "outside.txt").symlink_to(outside)
    except OSError:
        pytest.skip("This OS/account does not permit creating symlinks")
    app = FastAPI()
    app.router.routes.append(LocalWebMount("/", app=LocalFrontend(dist)))
    with TestClient(app) as client:
        response = client.get("/outside.txt")
        assert response.status_code == 404
        assert "OUTSIDE_TEST_MARKER" not in response.text


def test_missing_build_is_actionable_and_does_not_break_api(tmp_path: Path) -> None:
    app = FastAPI()
    register_handlers(app)

    @app.get("/api/v1/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.router.routes.append(LocalWebMount("/", app=LocalFrontend(tmp_path / "not-built")))
    with TestClient(app) as client:
        response = client.get("/")
        assert response.status_code == 503
        assert "npm run build" in response.text
        assert client.get("/api/v1/health").status_code == 200
        missing_api = client.get("/api/v1/missing")
        assert missing_api.status_code == 404
        assert missing_api.json()["code"] == "not_found"
