"""SQLAlchemy models. Mirror of schemas/schema.sql (17 tables)."""

from __future__ import annotations

from sqlalchemy import (
    JSON,
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    MetaData,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(column_0_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class Tender(Base):
    __tablename__ = "tender"
    __table_args__ = (UniqueConstraint("feed_id", "atom_id"),)
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    feed_id: Mapped[str] = mapped_column(String, nullable=False)
    atom_id: Mapped[str] = mapped_column(String, nullable=False)
    external_id: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    source_url: Mapped[str] = mapped_column(String, nullable=False)
    source_updated_at: Mapped[str] = mapped_column(String, nullable=False)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)


class NoticeVersion(Base):
    __tablename__ = "notice_version"
    __table_args__ = (
        UniqueConstraint("tender_id", "updated_utc", "raw_sha256"),
        Index("ix_versions_latest", "tender_id", "updated_utc"),
    )
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    tender_id: Mapped[str] = mapped_column(String(80), ForeignKey("tender.id"), nullable=False)
    updated_utc: Mapped[str] = mapped_column(String, nullable=False)
    raw_sha256: Mapped[str] = mapped_column(String, nullable=False)
    blob_path: Mapped[str] = mapped_column(String, nullable=False)
    retrieved_at: Mapped[str] = mapped_column(String, nullable=False)
    source_url: Mapped[str] = mapped_column(String, nullable=False)
    tombstone: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Scope(Base):
    __tablename__ = "scope"
    __table_args__ = (UniqueConstraint("tender_id", "lot_key"),)
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    tender_id: Mapped[str] = mapped_column(String(80), ForeignKey("tender.id"), nullable=False)
    lot_key: Mapped[str] = mapped_column(String, nullable=False)
    basis_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    budget_net_cents: Mapped[int | None] = mapped_column(Integer)


class Document(Base):
    __tablename__ = "document"
    __table_args__ = (
        UniqueConstraint("tender_id", "sha256", "kind"),
        CheckConstraint("pages_count BETWEEN 1 AND 120"),
    )
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    tender_id: Mapped[str] = mapped_column(String(80), ForeignKey("tender.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    sha256: Mapped[str] = mapped_column(String, nullable=False)
    blob_path: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    pages_count: Mapped[int] = mapped_column(Integer, nullable=False)
    source_url: Mapped[str | None] = mapped_column(String)
    rights_status: Mapped[str] = mapped_column(String, nullable=False)
    parse_status: Mapped[str] = mapped_column(String, nullable=False)


class DocumentPage(Base):
    __tablename__ = "document_page"
    document_id: Mapped[str] = mapped_column(
        String(80), ForeignKey("document.id"), primary_key=True
    )
    page_number: Mapped[int] = mapped_column(Integer, primary_key=True)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_text: Mapped[str] = mapped_column(Text, nullable=False)
    text_sha256: Mapped[str] = mapped_column(String, nullable=False)
    extractor_version: Mapped[str] = mapped_column(String, nullable=False)
    flags_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)


class Citation(Base):
    __tablename__ = "citation"
    __table_args__ = (
        ForeignKeyConstraint(
            ["document_id", "page_number"],
            ["document_page.document_id", "document_page.page_number"],
        ),
    )
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    document_id: Mapped[str] = mapped_column(String(80), nullable=False)
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    document_sha256: Mapped[str] = mapped_column(String, nullable=False)
    quote: Mapped[str] = mapped_column(Text, nullable=False)
    match_status: Mapped[str] = mapped_column(String, nullable=False)
    normalized_start: Mapped[int | None] = mapped_column(Integer)
    normalized_end: Mapped[int | None] = mapped_column(Integer)
    normalization_version: Mapped[str] = mapped_column(String, nullable=False)


class InterpretationRevision(Base):
    __tablename__ = "interpretation_revision"
    tender_id: Mapped[str] = mapped_column(String(80), ForeignKey("tender.id"), primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, primary_key=True)
    mode: Mapped[str] = mapped_column(String, nullable=False)
    proposal_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    reviewed_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    document_hashes_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    actor: Mapped[str] = mapped_column(String, nullable=False)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class RuleRevision(Base):
    __tablename__ = "rule_revision"
    rule_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, primary_key=True)
    scope_id: Mapped[str] = mapped_column(String(80), ForeignKey("scope.id"), nullable=False)
    interpretation_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    rule_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    review_status: Mapped[str] = mapped_column(String, nullable=False)
    actor: Mapped[str] = mapped_column(String, nullable=False)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class Company(Base):
    __tablename__ = "company"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class CompanyRevision(Base):
    __tablename__ = "company_revision"
    company_id: Mapped[str] = mapped_column(String(80), ForeignKey("company.id"), primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, primary_key=True)
    scope_id: Mapped[str] = mapped_column(String(80), ForeignKey("scope.id"), nullable=False)
    direct_cost_cents: Mapped[int | None] = mapped_column(Integer)
    overhead_cents: Mapped[int | None] = mapped_column(Integer)
    profile_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class HistoricalAward(Base):
    __tablename__ = "historical_award"
    __table_args__ = (
        UniqueConstraint("notice_version_id", "result_index"),
        Index("ix_awards_scope_date", "scope_id", "award_date"),
    )
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    notice_version_id: Mapped[str] = mapped_column(
        String(80), ForeignKey("notice_version.id"), nullable=False
    )
    scope_id: Mapped[str | None] = mapped_column(String(80), ForeignKey("scope.id"))
    result_index: Mapped[int] = mapped_column(Integer, nullable=False)
    budget_net_cents: Mapped[int | None] = mapped_column(Integer)
    award_net_cents: Mapped[int | None] = mapped_column(Integer)
    award_date: Mapped[str | None] = mapped_column(String)
    comparability: Mapped[str] = mapped_column(String, nullable=False)
    basis_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    flags_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    reviewer: Mapped[str | None] = mapped_column(String)


class Scenario(Base):
    __tablename__ = "scenario"
    __table_args__ = (
        ForeignKeyConstraint(
            ["rule_id", "rule_revision"], ["rule_revision.rule_id", "rule_revision.revision"]
        ),
        ForeignKeyConstraint(
            ["company_id", "company_revision"],
            ["company_revision.company_id", "company_revision.revision"],
        ),
    )
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    scope_id: Mapped[str] = mapped_column(String(80), ForeignKey("scope.id"), nullable=False)
    rule_id: Mapped[str] = mapped_column(String(80), nullable=False)
    rule_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    company_id: Mapped[str] = mapped_column(String(80), nullable=False)
    company_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    snapshot_sha256: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class Report(Base):
    __tablename__ = "report"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    scenario_id: Mapped[str] = mapped_column(String(80), ForeignKey("scenario.id"), nullable=False)
    report_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class Job(Base):
    __tablename__ = "job"
    __table_args__ = (Index("ix_jobs_queue", "status", "created_at"),)
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    tender_id: Mapped[str] = mapped_column(String(80), ForeignKey("tender.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    request_json: Mapped[dict[str, object]] = mapped_column(
        MutableDict.as_mutable(JSON), nullable=False
    )
    stage: Mapped[str] = mapped_column(String, nullable=False)
    worker_id: Mapped[str | None] = mapped_column(String)
    lease_until: Mapped[str | None] = mapped_column(String)
    result_revision: Mapped[int | None] = mapped_column(Integer)
    error_code: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class ModelInvocation(Base):
    __tablename__ = "model_invocation"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    job_id: Mapped[str | None] = mapped_column(String(80), ForeignKey("job.id"))
    mode: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str | None] = mapped_column(String)
    prompt_version: Mapped[str] = mapped_column(String, nullable=False)
    input_hash: Mapped[str] = mapped_column(String, nullable=False)
    provider_request_id: Mapped[str | None] = mapped_column(String)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    cached_tokens: Mapped[int | None] = mapped_column(Integer)
    estimated_cost_usd: Mapped[str | None] = mapped_column(String)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class AuditEvent(Base):
    __tablename__ = "audit_event"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    entity_type: Mapped[str] = mapped_column(String, nullable=False)
    entity_id: Mapped[str] = mapped_column(String, nullable=False)
    actor: Mapped[str] = mapped_column(String, nullable=False)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    old_json: Mapped[dict[str, object] | None] = mapped_column(JSON)
    new_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class IdempotencyRecord(Base):
    __tablename__ = "idempotency_record"
    # Route embeds the tender id (method + path + 80-char id); key matches Header(max_length=100).
    route: Mapped[str] = mapped_column(String(128), primary_key=True)
    idempotency_key: Mapped[str] = mapped_column(String(100), primary_key=True)
    body_sha256: Mapped[str] = mapped_column(String, nullable=False)
    response_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    expires_at: Mapped[str] = mapped_column(String, nullable=False)
