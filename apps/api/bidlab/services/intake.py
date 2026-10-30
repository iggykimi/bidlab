"""Own-tender intake: manual creation + local PDF upload (no remote fetch here).

Remote import of published tenders lives in ``placsp_import`` and reuses
the upload validation below for every downloaded PDF.

Creation stores exactly the supplied fields: money strings are parsed with
the repo Decimal parser (never float) and a single amount never implies the
other (no tax inference). Uploads validate magic bytes, real byte size and
readability before anything is persisted; failures keep the tender intact.
"""

import contextlib
import datetime as dt
import hashlib
import re
import uuid
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from bidlab.api.errors import ApiError
from bidlab.db import models
from bidlab.domain.money import MoneyError, parse_decimal, quantize_money
from bidlab.schemas import generated as g
from bidlab.services import pdf as pdf_service
from bidlab.services import render as render_service
from bidlab.services import workspace as workspace_service
from bidlab.settings import get_settings

TITLE_MAX = 2000
EXTERNAL_ID_MAX = 200
CONTRACTING_BODY_MAX = 1000
SOURCE_URL_MAX = 3000
SCOPE_LABEL_MAX = 80
DISPLAY_NAME_MAX = 200

DOCUMENT_KINDS = frozenset({"pcap", "ppt", "other"})
TAX_KINDS = frozenset({"VAT", "IGIC", "other", "unknown"})
# Internal provenance for user uploads; served as "unknown" (see RIGHTS_MAP).
RIGHTS_USER_SUPPLIED = "user_supplied_local"

_MONEY_RE = re.compile(r"^\d{1,12}\.\d{2}$")
_PDF_MAGIC = b"%PDF-"


def documents_route_for(tender_id: str) -> str:
    return f"POST /api/v1/tenders/{tender_id}/documents"


def _now() -> str:
    return dt.datetime.now(dt.UTC).isoformat()


def require_text(value: object, *, field: str, max_length: int) -> str:
    """Strip and require a non-blank string within its length cap."""
    text = value.strip() if isinstance(value, str) else ""
    if not text:
        raise ApiError(422, "validation_error", f"{field}: required non-empty string")
    if len(text) > max_length:
        raise ApiError(422, "validation_error", f"{field}: longer than {max_length} chars")
    return text


def optional_text(value: object, *, field: str, max_length: int) -> str | None:
    """Strip an optional string; blank means absent. Length-capped."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise ApiError(422, "validation_error", f"{field}: must be a string")
    text = value.strip()
    if not text:
        return None
    if len(text) > max_length:
        raise ApiError(422, "validation_error", f"{field}: longer than {max_length} chars")
    return text


def parse_money_input(value: object, *, field: str) -> str | None:
    """Parse an optional money string via the repo Decimal parser.

    Returns the canonical 2dp string (e.g. "118336.00") or None when absent.
    Unparseable, negative or out-of-shape values are 422 money_unparseable;
    floats never parse (strict contract strings keep them out, and the
    parser itself rejects float inputs).
    """
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, str):
        raise ApiError(422, "money_unparseable", f"{field}: money must be a string")
    try:
        amount = parse_decimal(value, field=field)
    except MoneyError as exc:
        raise ApiError(422, "money_unparseable", f"{field}: unparseable money {value!r}") from exc
    if amount < 0:
        raise ApiError(422, "money_unparseable", f"{field}: money must be >= 0")
    canonical = format(quantize_money(amount), "f")
    if _MONEY_RE.match(canonical) is None:
        raise ApiError(422, "money_unparseable", f"{field}: money out of range")
    return canonical


def money_cents(canonical: str | None) -> int | None:
    if canonical is None:
        return None
    return int(Decimal(canonical) * 100)


def build_basis_json(
    *,
    scope_id: str,
    pbl_net: str | None,
    pbl_gross: str | None,
    tax_kind: str | None,
    period_months: int | None,
    currency: str | None,
) -> dict[str, Any]:
    """PriceBasis payload with zero inference: absent stays null.

    A lone pbl_net never produces a pbl_gross (or vice versa); ceiling and
    scoring reference stay null until explicitly reviewed. The gross amount
    lives on the tender metadata, never derived here.
    """
    kind = tax_kind if tax_kind in TAX_KINDS else "unknown"
    return {
        "scope_id": scope_id,
        "budget_net": pbl_net,
        "ceiling_net": None,
        "scoring_reference_net": None,
        "reference_kind": "pbl" if pbl_net is not None else "unknown",
        "currency": currency if currency == "EUR" else "EUR",
        "unit": "unknown",
        "period_months": period_months,
        "tax_kind": kind,
        "review_status": "pending",
        "evidence_ids": [],
        "metadata_evidence": [],
    }


def create_tender(session: Session, payload: g.TenderCreate) -> dict[str, Any]:
    data = payload.model_dump(mode="json")
    title = require_text(data.get("title"), field="title", max_length=TITLE_MAX)
    external_id = require_text(
        data.get("external_id"), field="external_id", max_length=EXTERNAL_ID_MAX
    )
    contracting_body = require_text(
        data.get("contracting_body"), field="contracting_body", max_length=CONTRACTING_BODY_MAX
    )
    source_url = optional_text(
        data.get("source_url"), field="source_url", max_length=SOURCE_URL_MAX
    )
    scope_label = optional_text(
        data.get("scope_label"), field="scope_label", max_length=SCOPE_LABEL_MAX
    )
    raw_basis = data.get("basis")
    basis_data = raw_basis if isinstance(raw_basis, dict) else {}
    pbl_net = parse_money_input(basis_data.get("pbl_net"), field="basis.pbl_net")
    pbl_gross = parse_money_input(basis_data.get("pbl_gross"), field="basis.pbl_gross")
    period_raw = basis_data.get("period_months")
    period_months = period_raw if isinstance(period_raw, int) and period_raw >= 1 else None

    tender_id = uuid.uuid4().hex
    scope_id = f"{tender_id}-whole"
    now = _now()
    session.add(
        models.Tender(
            id=tender_id,
            feed_id="local",
            atom_id=tender_id,
            external_id=external_id,
            title=title,
            source_url=source_url or "",
            source_updated_at=now,
            metadata_json={
                "contracting_body": contracting_body,
                "cpv_codes": [],
                "status_raw": "",
                "deadline_literal": None,
                "deadline_at": None,
                "pbl_gross": pbl_gross,
                "estimated_value": None,
                "quality_flags": [],
                "metadata_evidence": [],
            },
        )
    )
    session.flush()
    session.add(
        models.Scope(
            id=scope_id,
            tender_id=tender_id,
            lot_key=scope_label or "__whole__",
            basis_json=build_basis_json(
                scope_id=scope_id,
                pbl_net=pbl_net,
                pbl_gross=pbl_gross,
                tax_kind=basis_data.get("tax_kind"),
                period_months=period_months,
                currency=basis_data.get("currency"),
            ),
            budget_net_cents=money_cents(pbl_net),
        )
    )
    session.flush()
    return workspace_service.tender_to_dict(session, tender_id)


def require_pdf_magic(file_bytes: bytes) -> None:
    """Reject non-PDF uploads by magic bytes, never by extension."""
    if file_bytes[:5] != _PDF_MAGIC:
        raise ApiError(415, "upload_not_pdf", "uploaded file is not a PDF (magic bytes mismatch)")


def safe_display_name(filename: str | None) -> str:
    """User filename reduced to a confined display name (no directories)."""
    base = Path(filename or "").name.strip()
    if not base:
        return "upload.pdf"
    return base[:DISPLAY_NAME_MAX]


def blob_path_for(tender_id: str, document_id: str) -> tuple[str, Path]:
    """Confined storage location with an internal filename (never user input)."""
    root = get_settings().storage_path.resolve()
    candidate = (root / "uploads" / tender_id / f"{document_id}.pdf").resolve()
    if not candidate.is_relative_to(root):
        raise ApiError(400, "bad_request", "tender id escapes storage")
    return f"uploads/{tender_id}/{document_id}.pdf", candidate


def stage_document_upload(
    session: Session,
    tender_id: str,
    file_bytes: bytes,
    filename: str | None,
    kind: str | None,
    *,
    source_url: str | None = None,
    rights_status: str = RIGHTS_USER_SUPPLIED,
) -> tuple[dict[str, Any], Path]:
    """Validate and persist an uploaded PDF; the caller writes the bytes.

    Returns the Document payload plus the absolute blob path. Byte writing
    stays with the caller so a lost idempotency race leaves no orphan file.
    Official downloads (PLACSP import) pass their source URL and rights
    status; local uploads keep the defaults.
    """
    tender = session.get(models.Tender, tender_id)
    if tender is None:
        raise ApiError(404, "tender_not_found", f"unknown tender {tender_id}")
    resolved_kind = kind if kind in DOCUMENT_KINDS else "other" if kind is None else None
    if resolved_kind is None:
        raise ApiError(422, "validation_error", f"kind: unsupported value {kind!r}")
    require_pdf_magic(file_bytes)
    sha256 = hashlib.sha256(file_bytes).hexdigest()
    duplicate = session.scalars(
        select(models.Document).where(
            models.Document.tender_id == tender_id,
            models.Document.sha256 == sha256,
            models.Document.kind == resolved_kind,
        )
    ).first()
    if duplicate is not None:
        raise ApiError(
            409, "document_duplicate", f"document {duplicate.id} already stores this file"
        )
    # Reuses the backend PDF caps (bytes, pages, chars) and readability checks.
    pages = pdf_service.extract_pages(file_bytes)
    document_id = uuid.uuid4().hex
    blob_rel, blob_abs = blob_path_for(tender_id, document_id)
    parse_status = (
        "needs_review"
        if any("no_extractable_text" in page.quality_flags for page in pages)
        else "ready"
    )
    doc = models.Document(
        id=document_id,
        tender_id=tender_id,
        kind=resolved_kind,
        sha256=sha256,
        blob_path=blob_rel,
        display_name=safe_display_name(filename),
        pages_count=len(pages),
        source_url=source_url,
        rights_status=rights_status,
        parse_status=parse_status,
    )
    session.add(doc)
    session.flush()
    for page in pages:
        session.add(
            models.DocumentPage(
                document_id=document_id,
                page_number=page.page_number,
                raw_text=page.raw_text,
                normalized_text=page.normalized_text,
                text_sha256=page.text_sha256,
                extractor_version=page.extractor_version,
                flags_json=dict.fromkeys(page.quality_flags, True),
            )
        )
    session.flush()
    payload, _warnings = workspace_service.document_to_dict(doc)
    return payload, blob_abs


def render_staged_upload(
    storage_root: Path,
    tender_id: str,
    document_id: str,
    file_bytes: bytes,
    pdf_sha256: str,
) -> None:
    """Render an uploaded PDF to versioned PNGs. Never fails the upload.

    Text extraction already succeeded when this runs, so a render problem
    is recorded as a failed manifest (precise code for later stages)
    instead of failing the whole upload.
    """
    try:
        pages = render_service.render_document(file_bytes)
    except render_service.RenderError as exc:
        with contextlib.suppress(OSError):
            render_service.store_failed_render(storage_root, tender_id, document_id, code=exc.code)
        return
    try:
        render_service.store_render(
            storage_root,
            tender_id,
            document_id,
            pages,
            pdf_sha256=pdf_sha256,
            dpi=render_service.DEFAULT_DPI,
        )
    except OSError:
        with contextlib.suppress(OSError):
            render_service.store_failed_render(
                storage_root, tender_id, document_id, code="render_store_failed"
            )


__all__ = [
    "CONTRACTING_BODY_MAX",
    "DISPLAY_NAME_MAX",
    "DOCUMENT_KINDS",
    "EXTERNAL_ID_MAX",
    "RIGHTS_USER_SUPPLIED",
    "SCOPE_LABEL_MAX",
    "SOURCE_URL_MAX",
    "TITLE_MAX",
    "blob_path_for",
    "build_basis_json",
    "create_tender",
    "documents_route_for",
    "money_cents",
    "optional_text",
    "parse_money_input",
    "require_pdf_magic",
    "require_text",
    "safe_display_name",
    "stage_document_upload",
]
