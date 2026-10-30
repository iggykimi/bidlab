"""Clarification drafts: stored live question drafts per tender."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_clarification_drafts"
down_revision: str | None = "0006_job_generation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "clarification_draft",
        sa.Column("id", sa.String(80), primary_key=True),
        sa.Column("tender_id", sa.String(80), sa.ForeignKey("tender.id"), nullable=False),
        sa.Column("interpretation_revision", sa.Integer, nullable=False),
        sa.Column("requirement_id", sa.String(80), nullable=False),
        sa.Column("requirement_label", sa.String, nullable=False),
        sa.Column("citation_id", sa.String(80), sa.ForeignKey("citation.id"), nullable=False),
        sa.Column("document_id", sa.String(80), nullable=False),
        sa.Column(
            "invocation_id",
            sa.String(80),
            sa.ForeignKey("model_invocation.id"),
            nullable=False,
        ),
        sa.Column("question", sa.Text, nullable=False),
        sa.Column("why_it_matters", sa.Text, nullable=False),
        sa.Column("cited_page", sa.Integer, nullable=False),
        sa.Column("quote_used", sa.Text, nullable=False),
        sa.Column("reasoning_tokens", sa.Integer),
        sa.Column("created_at", sa.String, nullable=False),
    )
    op.create_index("ix_clarification_tender", "clarification_draft", ["tender_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_clarification_tender", table_name="clarification_draft")
    op.drop_table("clarification_draft")
