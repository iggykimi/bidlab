"""Deterministic PDF page-text extraction (T14) + citation locating (T15).

Pure functions: the same bytes always produce the same pages. No network,
no model calls, no wall-clock input. Normalization matches the demo seed
(``nfkc-noshyphen-collapse-1``) so curated excerpts and fresh extractions
locate quotes identically.
"""

from __future__ import annotations

import hashlib
import unicodedata
from dataclasses import dataclass
from io import BytesIO

from pypdf import PdfReader

EXTRACTOR_VERSION = "bidlab-pdf-1"
NORMALIZATION_VERSION = "nfkc-noshyphen-collapse-1"
MAX_PAGES = 120
MAX_CHARS_PER_PAGE = 100_000
MAX_PDF_BYTES = 20 * 1024 * 1024


class PdfError(ValueError):
    """Unreadable or out-of-limits PDF input. Carries a contract-style code."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class PageExtraction:
    page_number: int
    raw_text: str
    normalized_text: str
    text_sha256: str
    extractor_version: str
    quality_flags: tuple[str, ...] = ()


@dataclass(frozen=True)
class CitationMatch:
    match_status: str  # exact | normalized_match | missing
    normalized_start: int | None
    normalized_end: int | None


@dataclass(frozen=True)
class CoveragePage:
    """One stored page row, as delivery coverage sees it."""

    document_id: str
    physical_page: int
    text: str
    flags: tuple[str, ...] = ()


# Flags that deserve a human-visible warning. Stored informational flags
# (for example ``curated_excerpt_only``) stay on the page entry but never
# warn: only delivery problems and truncation do.
WARNING_FLAGS = frozenset(
    {
        "page_missing",
        "no_extractable_text",
        "empty_text_not_coverage",
        "not_submitted",
        "text_truncated",
    }
)


def coverage(expected_pages: dict[str, int], pages: list[CoveragePage]) -> dict[str, object]:
    """Server-derived delivery coverage over a document manifest.

    Adapted from the Plan Integral reference: physical presence, usable
    text and submission are reported per page and NEVER conflated. An
    empty page row is not readable text (``empty_text_not_coverage``);
    duplicates, out-of-manifest pages and invalid totals raise
    ``ValueError`` instead of guessing. Text is always submitted when its
    row exists; images arrive with PKG-T05, so ``image_submitted`` stays
    False until then.
    """
    known: dict[tuple[str, int], CoveragePage] = {}
    for page in pages:
        total = expected_pages.get(page.document_id)
        if total is None or not 1 <= page.physical_page <= total:
            msg = "page is outside the document manifest"
            raise ValueError(msg)
        key = (page.document_id, page.physical_page)
        if key in known:
            msg = "duplicate physical page"
            raise ValueError(msg)
        known[key] = page
    manifest: list[dict[str, object]] = []
    warnings: list[dict[str, object]] = []
    for doc_id, total in expected_pages.items():
        if not isinstance(total, int) or isinstance(total, bool) or total < 1:
            msg = "invalid total"
            raise ValueError(msg)
        for number in range(1, total + 1):
            stored = known.get((doc_id, number))
            usable = stored is not None and bool(stored.text.strip())
            text_sent = bool(stored is not None and usable)
            flags = list(stored.flags) if stored else ["page_missing"]
            if stored is not None and not usable and "no_extractable_text" not in flags:
                flags.append("no_extractable_text")
            if stored is not None and not usable:
                flags.append("empty_text_not_coverage")
            if not text_sent:
                flags.append("not_submitted")
            if [flag for flag in flags if flag in WARNING_FLAGS]:
                warnings.append({"document_id": doc_id, "physical_page": number, "flags": flags})
            manifest.append(
                {
                    "document_id": doc_id,
                    "physical_page": number,
                    "page_available": stored is not None,
                    "usable_text_available": usable,
                    "text_submitted": text_sent,
                    "image_submitted": False,
                    "semantic_review": "pending",
                    "flags": flags,
                }
            )
    return {
        "expected": len(manifest),
        "available": sum(1 for entry in manifest if entry["page_available"]),
        "usable_text": sum(1 for entry in manifest if entry["usable_text_available"]),
        "text_submitted": sum(1 for entry in manifest if entry["text_submitted"]),
        "image_submitted": 0,
        "not_submitted": sum(1 for entry in manifest if not entry["text_submitted"]),
        "requires_attention": bool(warnings),
        "warnings": warnings,
        "pages": manifest,
    }


def coverage_warning_lines(report: dict[str, object], limit: int = 4) -> list[str]:
    """Render coverage warnings as human-readable lines, capped.

    Actionable rows (empty/truncated) come first, one line each; missing
    physical pages collapse into a per-document summary so curated
    excerpts never drown the real problems.
    """
    entries = report.get("warnings")
    if not isinstance(entries, list):
        return []
    rows = [entry for entry in entries if isinstance(entry, dict)]
    present = [entry for entry in rows if "page_missing" not in entry["flags"]]
    missing = [entry for entry in rows if "page_missing" in entry["flags"]]
    lines = [
        f"document {entry['document_id']} p.{entry['physical_page']}: {', '.join(entry['flags'])}"
        for entry in present
    ]
    if len(lines) > limit:
        lines = [
            *lines[:limit],
            f"... and {len(lines) - limit} more pages need attention",
        ]
    missing_by_doc: dict[str, int] = {}
    for entry in missing:
        doc_id = str(entry["document_id"])
        missing_by_doc[doc_id] = missing_by_doc.get(doc_id, 0) + 1
    for doc_id in sorted(missing_by_doc):
        lines.append(f"document {doc_id}: {missing_by_doc[doc_id]} physical pages not delivered")
    return lines


def normalize_text(raw: str) -> str:
    """NFKC, drop soft hyphens, collapse all whitespace to single spaces."""
    text = unicodedata.normalize("NFKC", raw).replace(chr(0xAD), "")
    return " ".join(text.split())


def page_sha256(normalized_text: str) -> str:
    return hashlib.sha256(normalized_text.encode("utf-8")).hexdigest()


def extract_pages(pdf_bytes: bytes) -> list[PageExtraction]:
    """Extract ordered page texts from PDF bytes. Raises PdfError on failure."""
    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise PdfError(
            "pdf_too_large",
            f"PDF is {len(pdf_bytes)} bytes; limit is {MAX_PDF_BYTES}",
        )
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
        raw_pages = list(reader.pages)
    except Exception as exc:
        raise PdfError("pdf_unreadable", f"cannot parse PDF: {exc}") from exc
    if not raw_pages:
        raise PdfError("pdf_no_pages", "PDF contains no pages")
    if len(raw_pages) > MAX_PAGES:
        raise PdfError(
            "pdf_too_many_pages",
            f"PDF has {len(raw_pages)} pages; limit is {MAX_PAGES}",
        )
    out: list[PageExtraction] = []
    for index, page in enumerate(raw_pages, start=1):
        try:
            raw = page.extract_text() or ""
        except Exception as exc:
            raise PdfError("pdf_page_unreadable", f"page {index} unreadable: {exc}") from exc
        flags: list[str] = []
        if len(raw) > MAX_CHARS_PER_PAGE:
            raw = raw[:MAX_CHARS_PER_PAGE]
            flags.append("text_truncated")
        normalized = normalize_text(raw)
        if not normalized:
            flags.append("no_extractable_text")
        out.append(
            PageExtraction(
                page_number=index,
                raw_text=raw,
                normalized_text=normalized,
                text_sha256=page_sha256(normalized),
                extractor_version=EXTRACTOR_VERSION,
                quality_flags=tuple(flags),
            )
        )
    return out


def locate_citation(normalized_page_text: str, verbatim_excerpt: str) -> CitationMatch:
    """Locate a quote inside already-normalized page text.

    ``exact``: excerpt appears verbatim. ``normalized_match``: excerpt matches
    after normalization (whitespace/soft-hyphen differences). ``missing``:
    no match; the citation is unverified, never silently dropped.
    """
    if verbatim_excerpt and verbatim_excerpt in normalized_page_text:
        start = normalized_page_text.index(verbatim_excerpt)
        return CitationMatch("exact", start, start + len(verbatim_excerpt))
    folded = normalize_text(verbatim_excerpt)
    if folded and folded in normalized_page_text:
        start = normalized_page_text.index(folded)
        return CitationMatch("normalized_match", start, start + len(folded))
    return CitationMatch("missing", None, None)
