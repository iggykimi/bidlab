"""Initial schema. Equivalent to schemas/schema.sql (alembic does not run that file too)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tender",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("feed_id", sa.String, nullable=False),
        sa.Column("atom_id", sa.String, nullable=False),
        sa.Column("external_id", sa.String, nullable=False),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("source_url", sa.String, nullable=False),
        sa.Column("source_updated_at", sa.String, nullable=False),
        sa.Column("metadata_json", sa.JSON, nullable=False),
        sa.UniqueConstraint("feed_id", "atom_id"),
        sa.CheckConstraint("json_valid(metadata_json)"),
    )
    op.create_table(
        "notice_version",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("tender_id", sa.String, sa.ForeignKey("tender.id"), nullable=False),
        sa.Column("updated_utc", sa.String, nullable=False),
        sa.Column("raw_sha256", sa.String, nullable=False),
        sa.Column("blob_path", sa.String, nullable=False),
        sa.Column("retrieved_at", sa.String, nullable=False),
        sa.Column("source_url", sa.String, nullable=False),
        sa.Column("tombstone", sa.Integer, nullable=False, server_default="0"),
        sa.UniqueConstraint("tender_id", "updated_utc", "raw_sha256"),
        sa.CheckConstraint("tombstone IN (0, 1)"),
    )
    op.create_index("ix_versions_latest", "notice_version", ["tender_id", "updated_utc"])
    op.create_table(
        "scope",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("tender_id", sa.String, sa.ForeignKey("tender.id"), nullable=False),
        sa.Column("lot_key", sa.String, nullable=False),
        sa.Column("basis_json", sa.JSON, nullable=False),
        sa.Column("budget_net_cents", sa.Integer),
        sa.UniqueConstraint("tender_id", "lot_key"),
        sa.CheckConstraint("budget_net_cents IS NULL OR budget_net_cents >= 0"),
        sa.CheckConstraint("json_valid(basis_json)"),
    )
    op.create_table(
        "document",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("tender_id", sa.String, sa.ForeignKey("tender.id"), nullable=False),
        sa.Column("kind", sa.String, nullable=False),
        sa.Column("sha256", sa.String, nullable=False),
        sa.Column("blob_path", sa.String, nullable=False),
        sa.Column("display_name", sa.String, nullable=False),
        sa.Column("pages_count", sa.Integer, nullable=False),
        sa.Column("source_url", sa.String),
        sa.Column("rights_status", sa.String, nullable=False),
        sa.Column("parse_status", sa.String, nullable=False),
        sa.UniqueConstraint("tender_id", "sha256", "kind"),
        sa.CheckConstraint("pages_count BETWEEN 1 AND 120"),
    )
    op.create_table(
        "document_page",
        sa.Column("document_id", sa.String, sa.ForeignKey("document.id"), primary_key=True),
        sa.Column("page_number", sa.Integer, primary_key=True),
        sa.Column("raw_text", sa.Text, nullable=False),
        sa.Column("normalized_text", sa.Text, nullable=False),
        sa.Column("text_sha256", sa.String, nullable=False),
        sa.Column("extractor_version", sa.String, nullable=False),
        sa.Column("flags_json", sa.JSON, nullable=False),
        sa.CheckConstraint("page_number >= 1"),
        sa.CheckConstraint("json_valid(flags_json)"),
    )
    op.create_table(
        "citation",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("document_id", sa.String, nullable=False),
        sa.Column("page_number", sa.Integer, nullable=False),
        sa.Column("document_sha256", sa.String, nullable=False),
        sa.Column("quote", sa.Text, nullable=False),
        sa.Column("match_status", sa.String, nullable=False),
        sa.Column("normalized_start", sa.Integer),
        sa.Column("normalized_end", sa.Integer),
        sa.Column("normalization_version", sa.String, nullable=False),
        sa.ForeignKeyConstraint(
            ["document_id", "page_number"],
            ["document_page.document_id", "document_page.page_number"],
        ),
    )
    op.create_table(
        "interpretation_revision",
        sa.Column("tender_id", sa.String, sa.ForeignKey("tender.id"), primary_key=True),
        sa.Column("revision", sa.Integer, primary_key=True),
        sa.Column("mode", sa.String, nullable=False),
        sa.Column("proposal_json", sa.JSON, nullable=False),
        sa.Column("reviewed_json", sa.JSON, nullable=False),
        sa.Column("document_hashes_json", sa.JSON, nullable=False),
        sa.Column("actor", sa.String, nullable=False),
        sa.Column("reason", sa.String, nullable=False),
        sa.Column("created_at", sa.String, nullable=False),
        sa.CheckConstraint("revision >= 1"),
        sa.CheckConstraint("mode IN ('live', 'fixture', 'manual')"),
        sa.CheckConstraint("json_valid(proposal_json)"),
        sa.CheckConstraint("json_valid(reviewed_json)"),
        sa.CheckConstraint("json_valid(document_hashes_json)"),
    )
    op.create_table(
        "rule_revision",
        sa.Column("rule_id", sa.String, primary_key=True),
        sa.Column("revision", sa.Integer, primary_key=True),
        sa.Column("scope_id", sa.String, sa.ForeignKey("scope.id"), nullable=False),
        sa.Column("interpretation_revision", sa.Integer, nullable=False),
        sa.Column("rule_json", sa.JSON, nullable=False),
        sa.Column("review_status", sa.String, nullable=False),
        sa.Column("actor", sa.String, nullable=False),
        sa.Column("reason", sa.String, nullable=False),
        sa.Column("created_at", sa.String, nullable=False),
        sa.CheckConstraint("revision >= 1"),
        sa.CheckConstraint("json_valid(rule_json)"),
    )
    op.create_table(
        "company",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("created_at", sa.String, nullable=False),
    )
    op.create_table(
        "company_revision",
        sa.Column("company_id", sa.String, sa.ForeignKey("company.id"), primary_key=True),
        sa.Column("revision", sa.Integer, primary_key=True),
        sa.Column("scope_id", sa.String, sa.ForeignKey("scope.id"), nullable=False),
        sa.Column("direct_cost_cents", sa.Integer),
        sa.Column("overhead_cents", sa.Integer),
        sa.Column("profile_json", sa.JSON, nullable=False),
        sa.Column("created_at", sa.String, nullable=False),
        sa.CheckConstraint("revision >= 1"),
        sa.CheckConstraint("direct_cost_cents IS NULL OR direct_cost_cents >= 0"),
        sa.CheckConstraint("overhead_cents IS NULL OR overhead_cents >= 0"),
        sa.CheckConstraint("json_valid(profile_json)"),
    )
    op.create_table(
        "historical_award",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column(
            "notice_version_id", sa.String, sa.ForeignKey("notice_version.id"), nullable=False
        ),
        sa.Column("scope_id", sa.String, sa.ForeignKey("scope.id")),
        sa.Column("result_index", sa.Integer, nullable=False),
        sa.Column("budget_net_cents", sa.Integer),
        sa.Column("award_net_cents", sa.Integer),
        sa.Column("award_date", sa.String),
        sa.Column("comparability", sa.String, nullable=False),
        sa.Column("basis_json", sa.JSON, nullable=False),
        sa.Column("flags_json", sa.JSON, nullable=False),
        sa.Column("reviewer", sa.String),
        sa.UniqueConstraint("notice_version_id", "result_index"),
        sa.CheckConstraint("result_index >= 0"),
        sa.CheckConstraint("comparability IN ('unreviewed', 'comparable', 'excluded')"),
        sa.CheckConstraint("json_valid(basis_json)"),
        sa.CheckConstraint("json_valid(flags_json)"),
    )
    op.create_index("ix_awards_scope_date", "historical_award", ["scope_id", "award_date"])
    op.create_table(
        "scenario",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("scope_id", sa.String, sa.ForeignKey("scope.id"), nullable=False),
        sa.Column("rule_id", sa.String, nullable=False),
        sa.Column("rule_revision", sa.Integer, nullable=False),
        sa.Column("company_id", sa.String, nullable=False),
        sa.Column("company_revision", sa.Integer, nullable=False),
        sa.Column("snapshot_json", sa.JSON, nullable=False),
        sa.Column("snapshot_sha256", sa.String, nullable=False),
        sa.Column("created_at", sa.String, nullable=False),
        sa.ForeignKeyConstraint(
            ["rule_id", "rule_revision"], ["rule_revision.rule_id", "rule_revision.revision"]
        ),
        sa.ForeignKeyConstraint(
            ["company_id", "company_revision"],
            ["company_revision.company_id", "company_revision.revision"],
        ),
        sa.CheckConstraint("json_valid(snapshot_json)"),
    )
    op.create_table(
        "report",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("scenario_id", sa.String, sa.ForeignKey("scenario.id"), nullable=False),
        sa.Column("report_json", sa.JSON, nullable=False),
        sa.Column("created_at", sa.String, nullable=False),
        sa.CheckConstraint("json_valid(report_json)"),
    )
    op.create_table(
        "job",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("tender_id", sa.String, sa.ForeignKey("tender.id"), nullable=False),
        sa.Column("status", sa.String, nullable=False),
        sa.Column("request_json", sa.JSON, nullable=False),
        sa.Column("stage", sa.String, nullable=False),
        sa.Column("worker_id", sa.String),
        sa.Column("lease_until", sa.String),
        sa.Column("result_revision", sa.Integer),
        sa.Column("error_code", sa.String),
        sa.Column("created_at", sa.String, nullable=False),
        sa.Column("updated_at", sa.String, nullable=False),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'succeeded', 'needs_review', 'failed', 'cancelled')"
        ),
        sa.CheckConstraint("json_valid(request_json)"),
    )
    op.create_index("ix_jobs_queue", "job", ["status", "created_at"])
    op.create_table(
        "model_invocation",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("job_id", sa.String, sa.ForeignKey("job.id")),
        sa.Column("mode", sa.String, nullable=False),
        sa.Column("model", sa.String),
        sa.Column("prompt_version", sa.String, nullable=False),
        sa.Column("input_hash", sa.String, nullable=False),
        sa.Column("provider_request_id", sa.String),
        sa.Column("prompt_tokens", sa.Integer),
        sa.Column("completion_tokens", sa.Integer),
        sa.Column("cached_tokens", sa.Integer),
        sa.Column("estimated_cost_usd", sa.String),
        sa.Column("latency_ms", sa.Integer),
        sa.Column("status", sa.String, nullable=False),
        sa.Column("created_at", sa.String, nullable=False),
        sa.CheckConstraint("mode IN ('live', 'fixture', 'manual')"),
        sa.CheckConstraint("prompt_tokens IS NULL OR prompt_tokens >= 0"),
        sa.CheckConstraint("completion_tokens IS NULL OR completion_tokens >= 0"),
        sa.CheckConstraint("cached_tokens IS NULL OR cached_tokens >= 0"),
        sa.CheckConstraint(
            "mode = 'live' OR (prompt_tokens IS NULL"
            " AND completion_tokens IS NULL AND cached_tokens IS NULL)"
        ),
    )
    op.create_table(
        "audit_event",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("entity_type", sa.String, nullable=False),
        sa.Column("entity_id", sa.String, nullable=False),
        sa.Column("actor", sa.String, nullable=False),
        sa.Column("reason", sa.String, nullable=False),
        sa.Column("old_json", sa.JSON),
        sa.Column("new_json", sa.JSON, nullable=False),
        sa.CheckConstraint("json_valid(new_json)"),
        sa.Column("created_at", sa.String, nullable=False),
    )
    op.create_table(
        "idempotency_record",
        sa.Column("route", sa.String, primary_key=True),
        sa.Column("idempotency_key", sa.String, primary_key=True),
        sa.Column("body_sha256", sa.String, nullable=False),
        sa.Column("response_json", sa.JSON, nullable=False),
        sa.Column("expires_at", sa.String, nullable=False),
        sa.CheckConstraint("json_valid(response_json)"),
    )


def downgrade() -> None:
    for table in (
        "idempotency_record",
        "audit_event",
        "model_invocation",
        "job",
        "report",
        "scenario",
        "historical_award",
        "company_revision",
        "company",
        "rule_revision",
        "interpretation_revision",
        "citation",
        "document_page",
        "document",
        "scope",
        "notice_version",
        "tender",
    ):
        op.drop_table(table)
