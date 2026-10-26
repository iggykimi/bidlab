"""Perf insurance (audit 2026-10-26): indexes on hot FK lookups."""

from collections.abc import Sequence

from alembic import op

revision: str = "0002_perf_indexes"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_citation_document", "citation", ["document_id"])
    op.create_index("ix_rule_revision_scope", "rule_revision", ["scope_id"])


def downgrade() -> None:
    op.drop_index("ix_rule_revision_scope", table_name="rule_revision")
    op.drop_index("ix_citation_document", table_name="citation")
