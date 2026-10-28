"""PKG-T05: versioned PDF page rendering with hashes."""

import hashlib
from io import BytesIO
from pathlib import Path

import pytest
from bidlab.services import render as render_service
from pypdf import PdfWriter


def _pdf_bytes(*mediaboxes: tuple[float, float, float, float]) -> bytes:
    writer = PdfWriter()
    for box in mediaboxes:
        writer.add_blank_page(
            width=box[2] - box[0] if len(box) == 4 else 595.0,
            height=box[3] - box[1] if len(box) == 4 else 842.0,
        )
    stream = BytesIO()
    writer.write(stream)
    return stream.getvalue()


@pytest.fixture()
def two_pages() -> bytes:
    return _pdf_bytes((0, 0, 595, 842), (0, 0, 595, 842))


def test_render_declares_version_dpi_page_and_sha(two_pages: bytes) -> None:
    page = render_service.render_page(two_pages, 2)
    assert page.page_number == 2
    assert page.dpi == render_service.DEFAULT_DPI
    assert page.width > 0 and page.height > 0
    assert page.png_bytes[:8] == b"\x89PNG\r\n\x1a\n"
    assert page.image_sha256 == hashlib.sha256(page.png_bytes).hexdigest()
    assert page.render_version == render_service.RENDER_VERSION
    assert page.backend_version == render_service.backend_version()
    assert page.backend_version.startswith("pymupdf-")


def test_render_is_deterministic(two_pages: bytes) -> None:
    first = render_service.render_page(two_pages, 1)
    second = render_service.render_page(two_pages, 1)
    assert first.png_bytes == second.png_bytes
    assert first.image_sha256 == second.image_sha256


def test_render_document_renders_in_order(two_pages: bytes) -> None:
    pages = render_service.render_document(two_pages)
    assert [page.page_number for page in pages] == [1, 2]


def test_different_bytes_render_differently() -> None:
    narrow = _pdf_bytes((0, 0, 300, 842))
    wide = _pdf_bytes((0, 0, 595, 842))
    assert (
        render_service.render_page(narrow, 1).image_sha256
        != render_service.render_page(wide, 1).image_sha256
    )


def test_cache_key_matrix_abab() -> None:
    """PKG-T05 acceptance: key changes with version, bytes, dpi or backend."""
    key_a = render_service.cache_key(
        pdf_sha256="a" * 64, page_number=1, dpi=150, backend="pymupdf-1"
    )
    assert len(key_a) == 64
    assert (
        render_service.cache_key(pdf_sha256="a" * 64, page_number=1, dpi=150, backend="pymupdf-1")
        == key_a
    )
    assert (
        render_service.cache_key(
            pdf_sha256="a" * 64,
            page_number=1,
            dpi=150,
            render_version="bidlab-render-2",
            backend="pymupdf-1",
        )
        != key_a
    )
    assert (
        render_service.cache_key(pdf_sha256="b" * 64, page_number=1, dpi=150, backend="pymupdf-1")
        != key_a
    )
    assert (
        render_service.cache_key(pdf_sha256="a" * 64, page_number=1, dpi=200, backend="pymupdf-1")
        != key_a
    )
    assert (
        render_service.cache_key(pdf_sha256="a" * 64, page_number=1, dpi=150, backend="pymupdf-2")
        != key_a
    )
    assert (
        render_service.cache_key(pdf_sha256="a" * 64, page_number=2, dpi=150, backend="pymupdf-1")
        != key_a
    )


def test_render_rejects_garbage_bad_dpi_and_range(two_pages: bytes) -> None:
    with pytest.raises(render_service.RenderError) as exc:
        render_service.render_page(b"not a pdf at all", 1)
    assert exc.value.code == "render_unreadable"
    for bad_dpi in (0, 71, 301, 1000):
        with pytest.raises(render_service.RenderError) as exc:
            render_service.render_page(two_pages, 1, dpi=bad_dpi)
        assert exc.value.code == "render_bad_dpi"
    with pytest.raises(render_service.RenderError) as exc:
        render_service.render_page(two_pages, 1, dpi="150")  # type: ignore[arg-type]
    assert exc.value.code == "render_bad_dpi"
    with pytest.raises(render_service.RenderError) as exc:
        render_service.render_page(two_pages, 9)
    assert exc.value.code == "render_page_out_of_range"


def test_render_rejects_too_many_pages() -> None:
    big = _pdf_bytes(*[(0, 0, 595, 842)] * 121)
    with pytest.raises(render_service.RenderError) as exc:
        render_service.render_document(big)
    assert exc.value.code == "render_too_many_pages"


def test_store_and_load_roundtrip(tmp_path: Path, two_pages: bytes) -> None:
    pages = render_service.render_document(two_pages, dpi=72)
    target = render_service.store_render(tmp_path, "t1", "d1", pages, pdf_sha256="c" * 64, dpi=72)
    assert target.name == f"d1.render-{render_service.RENDER_VERSION}"
    manifest = render_service.load_render_manifest(tmp_path, "t1", "d1")
    assert manifest is not None
    assert manifest["status"] == "ready"
    assert manifest["render_version"] == render_service.RENDER_VERSION
    assert manifest["dpi"] == 72
    assert manifest["pdf_sha256"] == "c" * 64
    assert isinstance(manifest["pages"], list) and len(manifest["pages"]) == 2
    entry = manifest["pages"][0]
    assert entry["physical_page"] == 1
    assert entry["image_sha256"] == pages[0].image_sha256
    assert entry["cache_key"] == render_service.cache_key(
        pdf_sha256="c" * 64,
        page_number=1,
        dpi=72,
        backend=pages[0].backend_version,
    )
    assert render_service.load_rendered_png(tmp_path, "t1", "d1", "p001.png") == pages[0].png_bytes
    assert render_service.load_rendered_png(tmp_path, "t1", "d1", "p009.png") is None
    assert render_service.load_rendered_png(tmp_path, "t1", "d1", "../escape.png") is None
    assert render_service.load_render_manifest(tmp_path, "t1", "missing") is None


def test_failed_render_manifest(tmp_path: Path) -> None:
    render_service.store_failed_render(tmp_path, "t1", "d1", code="render_unreadable")
    manifest = render_service.load_render_manifest(tmp_path, "t1", "d1")
    assert manifest is not None
    assert manifest["status"] == "failed"
    assert manifest["code"] == "render_unreadable"
    assert manifest["pages"] == []
