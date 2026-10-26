"""T14/T15: deterministic PDF extraction + citation locating (pure, offline)."""

import pytest
from bidlab.services import pdf as pdf_service
from pypdf import PdfWriter


def _page_stream(text: str) -> bytes:
    return f"BT /F1 12 Tf 10 180 Td ({text}) Tj ET".encode("latin-1")


def _two_page_pdf(first: str, second: str) -> bytes:
    objects: list[bytes] = []
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(b"<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>")
    page_tpl = (
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] "
        "/Resources << /Font << /F1 5 0 R >> >> /Contents {} 0 R >>"
    )
    objects.append(page_tpl.format(6).encode("ascii"))
    objects.append(page_tpl.format(7).encode("ascii"))
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    for text in (first, second):
        stream = _page_stream(text)
        objects.append(
            b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n"
            b"" + stream + b"\nendstream"
        )
    out = bytearray(b"%PDF-1.4\n")
    for number, body in enumerate(objects, start=1):
        out += str(number).encode("ascii") + b" 0 obj\n" + body + b"\nendobj\n"
    out += b"trailer\n<< /Root 1 0 R >>\nstartxref\n0\n%%EOF\n"
    return bytes(out)


def test_normalize_matches_seed_convention() -> None:
    assert pdf_service.NORMALIZATION_VERSION == "nfkc-noshyphen-collapse-1"
    assert pdf_service.normalize_text("  Precio\u00ad  neto:\r\n118.336,00  ") == (
        "Precio neto: 118.336,00"
    )
    assert pdf_service.normalize_text("") == ""


def test_extract_two_pages_in_order() -> None:
    pages = pdf_service.extract_pages(
        _two_page_pdf("Precio neto: 118336.00 euros", "Plazo: 24 meses")
    )
    assert [p.page_number for p in pages] == [1, 2]
    assert "118336.00" in pages[0].raw_text
    assert pages[1].normalized_text == "Plazo: 24 meses"
    assert pages[0].extractor_version == pdf_service.EXTRACTOR_VERSION
    assert pages[0].text_sha256 == pdf_service.page_sha256(pages[0].normalized_text)
    assert pages[0].quality_flags == ()


def test_extract_is_deterministic() -> None:
    blob = _two_page_pdf("hello world", "second page")
    assert pdf_service.extract_pages(blob) == pdf_service.extract_pages(blob)


def test_blank_page_flagged_not_failed() -> None:
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    import io

    buf = io.BytesIO()
    writer.write(buf)
    (page,) = pdf_service.extract_pages(buf.getvalue())
    assert page.normalized_text == ""
    assert page.quality_flags == ("no_extractable_text",)


def test_garbage_bytes_rejected() -> None:
    with pytest.raises(pdf_service.PdfError) as exc:
        pdf_service.extract_pages(b"not a pdf at all")
    assert exc.value.code == "pdf_unreadable"


def test_too_many_pages_rejected() -> None:
    import io

    writer = PdfWriter()
    for _ in range(121):
        writer.add_blank_page(width=72, height=72)
    buf = io.BytesIO()
    writer.write(buf)
    with pytest.raises(pdf_service.PdfError) as exc:
        pdf_service.extract_pages(buf.getvalue())
    assert exc.value.code == "pdf_too_many_pages"


def test_oversize_input_rejected() -> None:
    with pytest.raises(pdf_service.PdfError) as exc:
        pdf_service.extract_pages(b"x" * (pdf_service.MAX_PDF_BYTES + 1))
    assert exc.value.code == "pdf_too_large"


def test_long_page_truncated_with_flag() -> None:
    long_text = "w" * (pdf_service.MAX_CHARS_PER_PAGE + 500)
    (page,) = pdf_service.extract_pages(_two_page_pdf(long_text, "short"))[:1]
    assert len(page.raw_text) == pdf_service.MAX_CHARS_PER_PAGE
    assert "text_truncated" in page.quality_flags


def test_locate_exact_with_offsets() -> None:
    page = "el precio neto es 118336.00 euros para 24 meses"
    match = pdf_service.locate_citation(page, "118336.00")
    assert match.match_status == "exact"
    assert isinstance(match.normalized_start, int)
    assert page[match.normalized_start : match.normalized_end] == "118336.00"


def test_locate_normalized_match_across_whitespace() -> None:
    page = "el precio neto es 118336.00 euros"
    match = pdf_service.locate_citation(page, "precio\nneto  es")
    assert match.match_status == "normalized_match"
    assert isinstance(match.normalized_start, int)
    assert match.normalized_end is not None
    assert match.normalized_end > match.normalized_start


def test_locate_missing_quote() -> None:
    match = pdf_service.locate_citation("el precio neto", "clausula inexistente")
    assert match.match_status == "missing"
    assert match.normalized_start is None
    assert match.normalized_end is None
    assert pdf_service.locate_citation("texto", "").match_status == "missing"
