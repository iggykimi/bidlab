"""Serve the compiled local UI without turning API failures into SPA pages."""

import os
import re
from pathlib import Path

from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException
from starlette.responses import HTMLResponse, Response
from starlette.routing import Match, Mount
from starlette.staticfiles import StaticFiles
from starlette.types import Receive, Scope, Send

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; "
        "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    ),
}


class LocalWebMount(Mount):
    """Never claim an API path, including its wrong-method (405) matches."""

    def matches(self, scope: Scope) -> tuple[Match, Scope]:
        path = scope.get("path", "").removeprefix(scope.get("root_path", ""))
        if path == "/api" or path.startswith("/api/"):
            return Match.NONE, {}
        return super().matches(scope)


def _route_path(path: str) -> str:
    # StaticFiles.get_path returns OS separators (tenders\tias on Windows);
    # route matching below is URL-shaped on every platform.
    return path.replace(os.sep, "/").strip("/")


class LocalFrontend(StaticFiles):
    """Only known React routes fall back to index; files stay inside dist."""

    def __init__(self, directory: Path) -> None:
        super().__init__(directory=directory, check_dir=False, follow_symlink=False)
        self.index_path = directory / "index.html"

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        path = _route_path(self.get_path(scope))
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404)
        # The API remains bootable before npm build (and in backend-only tests).
        # Do not let a missing build become a StaticFiles RuntimeError / HTTP 500.
        if not await run_in_threadpool(self.index_path.is_file):
            response = HTMLResponse(
                "<!doctype html><html lang='es'><meta charset='utf-8'>"
                "<meta name='viewport' content='width=device-width,initial-scale=1'>"
                "<title>BidLab · Preparar interfaz</title>"
                "<h1>La API está disponible. Falta compilar la interfaz.</h1>"
                "<p>Ejecuta <code>npm ci</code> y <code>npm run build</code> "
                "en la carpeta de BidLab. Después recarga esta página.</p></html>",
                status_code=503,
                headers={**SECURITY_HEADERS, "Cache-Control": "no-store"},
            )
            await response(scope, receive, send)
            return
        await super().__call__(scope, receive, send)

    async def get_response(self, path: str, scope: Scope) -> Response:
        path = _route_path(path)
        # Preserve a JSON 404 for mistyped API paths. Never serve hidden build
        # files, and retain StaticFiles' traversal / symlink containment checks.
        if (
            path == "api"
            or path.startswith("api/")
            or any(part.startswith(".") and part != "." for part in Path(path).parts)
        ):
            raise HTTPException(status_code=404)
        try:
            response = await super().get_response(path, scope)
        except HTTPException as exc:
            is_view = path in ("", ".", "nueva-licitacion") or re.fullmatch(
                r"tenders/[A-Za-z0-9_-]{1,80}/?", path
            )
            if exc.status_code != 404 or not is_view:
                raise
            response = await super().get_response("index.html", scope)
        response.headers.update(SECURITY_HEADERS)
        # HTML must discover the current hashed bundle after an upgrade.
        if response.media_type == "text/html":
            response.headers["Cache-Control"] = "no-cache"
        return response
