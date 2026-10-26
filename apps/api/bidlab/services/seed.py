"""Seed the local demo database from fixtures/demo/*. Idempotent.

- Ensures schema via alembic upgrade head (single DDL path, never schema.sql too).
- --reset wipes the demo DB first (demo mode only).
- Re-running without --reset keeps existing rows: same counts (I01).
"""

import datetime as dt
import json
import unicodedata
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
FIX = ROOT / "fixtures" / "demo"
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import func, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from bidlab.db import models  # noqa: E402
from bidlab.db.session import get_engine  # noqa: E402

TABLES = [
    "tender",
    "notice_version",
    "scope",
    "document",
    "document_page",
    "citation",
    "interpretation_revision",
    "rule_revision",
    "company",
    "company_revision",
    "audit_event",
]


def _load(name: str) -> dict[str, object]:
    return json.loads((FIX / name).read_text(encoding="utf-8"))  # type: ignore[no-any-return]


def _cents(money: str | None) -> int | None:
    if money is None:
        return None
    return int(Decimal(money) * 100)


def _now() -> str:
    return dt.datetime.now(dt.UTC).isoformat()


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).replace("­", "")
    return " ".join(text.split())


def migrate() -> None:
    cfg = Config(str(ROOT / "apps" / "api" / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "apps" / "api" / "migrations"))
    command.upgrade(cfg, "head")


def counts(session: Session) -> dict[str, int]:
    out: dict[str, int] = {}
    for table in TABLES:
        model = getattr(models, "".join(p[:1].upper() + p[1:] for p in table.split("_")))
        out[table] = int(session.execute(select(func.count()).select_from(model)).scalar() or 0)
    return out


def seed() -> dict[str, int]:
    migrate()
    engine = get_engine()
    with Session(engine) as session:
        if session.get(models.Tender, "tias") is not None:
            print("seed present, skip insert")
            return counts(session)
        tender = _load("tender.json")
        company = _load("company.json")
        interp = _load("interpretation.json")
        review = _load("review.json")
        created = _now()

        meta = tender["metadata_evidence"]
        assert isinstance(meta, list)
        session.add(
            models.Tender(
                id="tias",
                feed_id=str(meta[0]["source_url"]),
                atom_id=str(tender["source_id"]),
                external_id=str(tender["external_id"]),
                title=str(tender["title"]),
                source_url=str(tender["source_url"]),
                source_updated_at=str(tender["source_updated_at"]),
                metadata_json={
                    "contracting_body": tender["contracting_body"],
                    "cpv_codes": tender["cpv_codes"],
                    "status_raw": tender["status_raw"],
                    "deadline_literal": tender["deadline_literal"],
                    "deadline_at": tender["deadline_at"],
                    "pbl_gross": tender["pbl_gross"],
                    "estimated_value": tender["estimated_value"],
                    "quality_flags": tender["quality_flags"],
                    "metadata_evidence": meta,
                },
            )
        )
        # Staged flushes: this env's UOW misorders multi-table flushes (see T07 log).
        session.flush()
        session.add(
            models.NoticeVersion(
                id="nv-tias-20251025",
                tender_id="tias",
                updated_utc="2026-10-25T13:12:11.227Z",
                raw_sha256=str(tender["raw_snapshot_sha256"]),
                blob_path="",
                retrieved_at="2026-10-25T13:12:11.227Z",
                source_url=str(meta[0]["source_url"]),
                tombstone=0,
            )
        )
        scopes = tender["scopes"]
        assert isinstance(scopes, list)
        scope0 = scopes[0]
        assert isinstance(scope0, dict)
        basis_inner = scope0["basis"]
        assert isinstance(basis_inner, dict)
        basis = dict(basis_inner)
        basis["review_status"] = "approved"
        basis["evidence_ids"] = [
            "cit-pbl_gross",
            "cit-estimated_value",
            "cit-initial_duration_months",
        ]
        basis["metadata_evidence"] = meta
        session.flush()
        session.add(
            models.Scope(
                id="tias-whole",
                tender_id="tias",
                lot_key="__whole__",
                basis_json=basis,
                budget_net_cents=_cents(str(tender["pbl_net"])),
            )
        )
        session.flush()
        session.add(
            models.Document(
                id="doc-tias-pcap",
                tender_id="tias",
                kind="pcap",
                sha256="c74d063237b012df89543da73390d76d8996a558a85b0202890182bcee289677",
                blob_path="",
                display_name="PCAP Tías (research copy; bytes not redistributed)",
                pages_count=41,
                source_url=str(tender["source_url"]),
                rights_status="research_copy_pending_publication_review",
                parse_status="metadata_only_curated_excerpts",
            )
        )

        proposal = interp["proposal"]
        assert isinstance(proposal, dict)
        claims = proposal["claims"]
        assert isinstance(claims, list)
        by_page: dict[int, list[str]] = {}
        for claim in claims:
            for cit in claim["citations"]:
                by_page.setdefault(int(cit["page_number"]), []).append(str(cit["verbatim_excerpt"]))
        session.flush()
        extractor = "curated-excerpts-1"
        for page_number in sorted(by_page):
            raw = " […] ".join(by_page[page_number])
            norm = _normalize(raw)
            session.add(
                models.DocumentPage(
                    document_id="doc-tias-pcap",
                    page_number=page_number,
                    raw_text=raw,
                    normalized_text=norm,
                    text_sha256="",
                    extractor_version=extractor,
                    flags_json={"curated_excerpt_only": True},
                )
            )
        session.flush()
        for claim in claims:
            cit0 = claim["citations"][0]
            page_quotes = by_page[int(cit0["page_number"])]
            raw = " […] ".join(page_quotes)
            norm = _normalize(raw)
            quote = str(cit0["verbatim_excerpt"])
            start = norm.find(_normalize(quote))
            if start < 0:
                raise RuntimeError(f"seed quote not found for claim {claim['key']}")
            session.add(
                models.Citation(
                    id=f"cit-{claim['key']}",
                    document_id="doc-tias-pcap",
                    page_number=int(cit0["page_number"]),
                    document_sha256="c74d063237b012df89543da73390d76d8996a558a85b0202890182bcee289677",
                    quote=quote,
                    match_status="exact",
                    normalized_start=start,
                    normalized_end=start + len(_normalize(quote)),
                    normalization_version="nfkc-noshyphen-collapse-1",
                )
            )

        session.flush()
        session.add(
            models.InterpretationRevision(
                tender_id="tias",
                revision=1,
                mode="manual",
                proposal_json=proposal,
                reviewed_json=interp["reviewed"],
                document_hashes_json={
                    "doc-tias-pcap": (
                        "c74d063237b012df89543da73390d76d8996a558a85b0202890182bcee289677"
                    )
                },
                actor="demo-seed",
                reason=str(review["reason"]),
                created_at=created,
            )
        )
        rule = review["rule"]
        anomaly = review["anomaly_policy"]
        assert isinstance(rule, dict) and isinstance(anomaly, dict)
        session.flush()
        session.add(
            models.RuleRevision(
                rule_id=str(rule["rule_id"]),
                revision=int(rule["revision"]),
                scope_id="tias-whole",
                interpretation_revision=1,
                rule_json={
                    "id": rule["rule_id"],
                    "revision": rule["revision"],
                    "scope_id": "tias-whole",
                    "template_id": rule["template_id"],
                    "max_points": rule["max_points"],
                    "expression": {
                        "kind": "call",
                        "op": "div",
                        "args": [
                            {
                                "kind": "call",
                                "op": "mul",
                                "args": [
                                    {"kind": "var", "name": "max_points"},
                                    {"kind": "var", "name": "best_price"},
                                ],
                            },
                            {"kind": "var", "name": "own_price"},
                        ],
                    },
                    "review_status": rule["review_status"],
                    "zero_denominator_policy": "unknown",
                    "evidence_ids": ["cit-price_points"],
                    "anomaly_policy": {
                        "id": anomaly["id"],
                        "source_kind": anomaly["source_kind"],
                        "variant": anomaly["variant"],
                        "review_status": anomaly["review_status"],
                        "three_bidder_absolute_25": anomaly["three_bidder_absolute_25"],
                        "percentage_reduction_one_third": anomaly["percentage_reduction_one_third"],
                        "evidence_ids": [
                            "cit-anomaly_single_discount_gt",
                            "cit-anomaly_two_discount_gt",
                        ],
                    },
                },
                review_status=str(rule["review_status"]),
                actor="demo-seed",
                reason=str(rule["reason"]),
                created_at=created,
            )
        )
        session.flush()
        session.add(models.Company(id=str(company["id"]), created_at=created))
        session.flush()
        company_rev = company["revision"]
        assert isinstance(company_rev, int)
        session.add(
            models.CompanyRevision(
                company_id=str(company["id"]),
                revision=company_rev,
                scope_id=str(company["scope_id"]),
                direct_cost_cents=_cents(str(company["direct_cost_net"])),
                overhead_cents=_cents(str(company["overhead_net"])),
                profile_json=company,
                created_at=created,
            )
        )
        session.flush()
        session.add(
            models.AuditEvent(
                id="audit-seed-basis",
                entity_type="scope_basis",
                entity_id="tias-whole",
                actor="demo-seed",
                reason="basis approved from XML metadata + PCAP p.8-9 visual table",
                old_json=None,
                new_json={"review_status": "approved"},
                created_at=created,
            )
        )
        session.add(
            models.AuditEvent(
                id="audit-seed-rule",
                entity_type="pricing_rule",
                entity_id="tias-price-r1:1",
                actor="demo-seed",
                reason=str(rule["reason"]),
                old_json=None,
                new_json={"review_status": "approved", "template_id": rule["template_id"]},
                created_at=created,
            )
        )
        session.commit()
        result = counts(session)
        print(f"seeded demo rows: {result}")
        return result


__all__ = ["counts", "migrate", "seed"]
