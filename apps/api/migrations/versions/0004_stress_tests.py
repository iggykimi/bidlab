"""Stress mesh snapshots (declared grid over the deterministic evaluator)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_stress_tests"
down_revision: str | None = "0003_drop_historical_award"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "stress_test",
        sa.Column("id", sa.String(80), primary_key=True),
        sa.Column("scope_id", sa.String(80), sa.ForeignKey("scope.id"), nullable=False),
        sa.Column("rule_id", sa.String(80), nullable=False),
        sa.Column("rule_revision", sa.Integer, nullable=False),
        sa.Column("company_id", sa.String(80), nullable=False),
        sa.Column("request_json", sa.JSON, nullable=False),
        sa.Column("result_json", sa.JSON, nullable=False),
        sa.Column("result_sha256", sa.String(64), nullable=False),
        sa.Column("created_at", sa.String, nullable=False),
        sa.CheckConstraint("json_valid(request_json)"),
        sa.CheckConstraint("json_valid(result_json)"),
    )
    op.create_index("ix_stress_test_scope", "stress_test", ["scope_id"])


def downgrade() -> None:
    op.drop_index("ix_stress_test_scope", table_name="stress_test")
    op.drop_table("stress_test")
