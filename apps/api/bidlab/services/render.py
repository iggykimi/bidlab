"""Versioned PDF page rendering (PKG-T05).

Rasterizes PDF pages to PNG with PyMuPDF (self-contained wheels: no OS
dependencies). Every render declares its version, DPI, page and image
hash; cache keys fingerprint (version, backend, DPI, page, PDF bytes) so
a different renderer, DPI or byte change can never masquerade as a cache
hit. Deterministic: same bytes plus same versions yields the same PNG.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import TYPE_CHECKING

import pymupdf

from bidlab.services import pdf as pdf_service

if TYPE_CHECKING:
    from pathlib import Path

RENDER_VERSION = "bidlab-render-1"
DEFAULT_DPI = 150
MIN_RENDER_DPI = 72
MAX_RENDER_DPI = 300


class RenderError(ValueError):
    """Unreadable or out-of-limits render input. Carries a contract-style code."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class RenderedPage:
    page_number: int
    dpi: int
    width: int
    height: int
    png_bytes: bytes
    image_sha256: str
    render_version: str
    backend_version: str


def backend_version() -> str:
    return f"pymupdf-{pymupdf.VersionBind}"


def cache_key(
    *,
    pdf_sha256: str,
    page_number: int,
    dpi: int,
    render_version: str = RENDER_VERSION,
    backend: str | None = None,
) -> str:
    """Stable cache key over everything that can change a render."""
    payload = {
        "pdf_sha256": pdf_sha256,
        "page_number": page_number,
        "dpi": dpi,
        "render_version": render_version,
        "backend_version": backend if backend is not None else backend_version(),
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _check_dpi(dpi: int) -> None:
    if not isinstance(dpi, int) or isinstance(dpi, bool):
        msg = f"DPI must be an int, got {dpi!r}"
        raise RenderError("render_bad_dpi", msg)
    if not MIN_RENDER_DPI <= dpi <= MAX_RENDER_DPI:
        msg = f"DPI {dpi} outside {MIN_RENDER_DPI}..{MAX_RENDER_DPI}"
        raise RenderError("render_bad_dpi", msg)


def _open(pdf_bytes: bytes) -> pymupdf.Document:
    try:
        return pymupdf.open(stream=pdf_bytes, filetype="pdf")  # type: ignore[no-untyped-call]
    except Exception as exc:
        msg = f"cannot parse PDF for render: {exc}"
        raise RenderError("render_unreadable", msg) from exc


def _pixmap_png(page: pymupdf.Page, dpi: int) -> tuple[bytes, int, int]:
    try:
        pix = page.get_pixmap(dpi=dpi)
        png = pix.tobytes("png")  # type: ignore[no-untyped-call]
    except Exception as exc:
        msg = f"page render failed: {exc}"
        raise RenderError("render_page_failed", msg) from exc
    else:
        return png, pix.width, pix.height


def render_page(pdf_bytes: bytes, page_number: int, *, dpi: int = DEFAULT_DPI) -> RenderedPage:
    """Render one physical page (1-based) to PNG."""
    _check_dpi(dpi)
    doc = _open(pdf_bytes)
    try:
        if doc.page_count > pdf_service.MAX_PAGES:
            msg = f"PDF has {doc.page_count} pages; limit is {pdf_service.MAX_PAGES}"
            raise RenderError("render_too_many_pages", msg)
        if not 1 <= page_number <= doc.page_count:
            msg = f"page {page_number} outside 1..{doc.page_count}"
            raise RenderError("render_page_out_of_range", msg)
        png, width, height = _pixmap_png(doc[page_number - 1], dpi)
    finally:
        doc.close()  # type: ignore[no-untyped-call]
    backend = backend_version()
    return RenderedPage(
        page_number=page_number,
        dpi=dpi,
        width=width,
        height=height,
        png_bytes=png,
        image_sha256=hashlib.sha256(png).hexdigest(),
        render_version=RENDER_VERSION,
        backend_version=backend,
    )


def render_document(pdf_bytes: bytes, *, dpi: int = DEFAULT_DPI) -> list[RenderedPage]:
    """Render every page in order. Raises RenderError on failure."""
    _check_dpi(dpi)
    doc = _open(pdf_bytes)
    try:
        if doc.page_count > pdf_service.MAX_PAGES:
            msg = f"PDF has {doc.page_count} pages; limit is {pdf_service.MAX_PAGES}"
            raise RenderError("render_too_many_pages", msg)
        backend = backend_version()
        out: list[RenderedPage] = []
        for number in range(1, doc.page_count + 1):
            png, width, height = _pixmap_png(doc[number - 1], dpi)
            out.append(
                RenderedPage(
                    page_number=number,
                    dpi=dpi,
                    width=width,
                    height=height,
                    png_bytes=png,
                    image_sha256=hashlib.sha256(png).hexdigest(),
                    render_version=RENDER_VERSION,
                    backend_version=backend,
                )
            )
        return out
    finally:
        doc.close()  # type: ignore[no-untyped-call]


def render_dir_for(
    storage_root: Path, tender_id: str, document_id: str, *, render_version: str = RENDER_VERSION
) -> Path:
    """Confined render directory for one document (caller jails the ids)."""
    return storage_root / "uploads" / tender_id / f"{document_id}.render-{render_version}"


def store_render(
    storage_root: Path,
    tender_id: str,
    document_id: str,
    pages: list[RenderedPage],
    *,
    pdf_sha256: str,
    dpi: int,
) -> Path:
    """Write page PNGs plus a manifest declaring version/DPI/SHAs."""
    target = render_dir_for(storage_root, tender_id, document_id)
    target.mkdir(parents=True, exist_ok=True)
    entries: list[dict[str, object]] = []
    for page in pages:
        name = f"p{page.page_number:03d}.png"
        (target / name).write_bytes(page.png_bytes)
        entries.append(
            {
                "file": name,
                "physical_page": page.page_number,
                "width": page.width,
                "height": page.height,
                "image_sha256": page.image_sha256,
                "cache_key": cache_key(
                    pdf_sha256=pdf_sha256,
                    page_number=page.page_number,
                    dpi=dpi,
                    render_version=page.render_version,
                    backend=page.backend_version,
                ),
            }
        )
    manifest = {
        "status": "ready",
        "render_version": RENDER_VERSION,
        "backend_version": backend_version(),
        "dpi": dpi,
        "pdf_sha256": pdf_sha256,
        "pages": entries,
    }
    (target / "manifest.json").write_text(
        json.dumps(manifest, indent=1, sort_keys=True), encoding="utf-8"
    )
    return target


def store_failed_render(storage_root: Path, tender_id: str, document_id: str, *, code: str) -> Path:
    """Record a render failure so later stages can report it precisely."""
    target = render_dir_for(storage_root, tender_id, document_id)
    target.mkdir(parents=True, exist_ok=True)
    manifest = {
        "status": "failed",
        "render_version": RENDER_VERSION,
        "backend_version": backend_version(),
        "code": code,
        "pages": [],
    }
    (target / "manifest.json").write_text(
        json.dumps(manifest, indent=1, sort_keys=True), encoding="utf-8"
    )
    return target


def load_render_manifest(
    storage_root: Path, tender_id: str, document_id: str
) -> dict[str, object] | None:
    """Read a stored render manifest. None when never rendered."""
    path = render_dir_for(storage_root, tender_id, document_id) / "manifest.json"
    if not path.is_file():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else None


def load_rendered_png(
    storage_root: Path, tender_id: str, document_id: str, file_name: str
) -> bytes | None:
    """Read one stored page PNG. None when absent; never leaves the dir."""
    target = render_dir_for(storage_root, tender_id, document_id)
    candidate = (target / file_name).resolve()
    if not candidate.is_relative_to(target.resolve()) or not candidate.is_file():
        return None
    return candidate.read_bytes()
