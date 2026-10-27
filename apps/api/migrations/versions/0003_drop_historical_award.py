"""Purge dead historical_award table (model removed with O1; no readers)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_drop_historical_award"
down_revision: str | None = "0002_perf_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("ix_awards_scope_date", table_name="historical_award")
    op.drop_table("historical_award")


def downgrade() -> None:
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
