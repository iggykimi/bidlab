"""Live spend reservations ledger (atomic budget admission, PKG-T02)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_spend_reservations"
down_revision: str | None = "0004_stress_tests"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "model_spend_account",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("held_micro_usd", sa.Integer, nullable=False),
        sa.Column("spent_micro_usd", sa.Integer, nullable=False),
        sa.CheckConstraint("id = 1"),
        sa.CheckConstraint("held_micro_usd >= 0"),
        sa.CheckConstraint("spent_micro_usd >= 0"),
    )
    op.execute(
        "INSERT INTO model_spend_account (id, held_micro_usd, spent_micro_usd) VALUES (1, 0, 0)"
    )
    op.create_table(
        "model_spend_reservation",
        sa.Column("key", sa.String(80), primary_key=True),
        sa.Column("job_id", sa.String(80), nullable=False),
        sa.Column("amount_micro_usd", sa.Integer, nullable=False),
        sa.Column("state", sa.String, nullable=False),
        sa.Column("actual_micro_usd", sa.Integer),
        sa.Column("receipt", sa.String),
        sa.Column("created_at", sa.String, nullable=False),
        sa.CheckConstraint("amount_micro_usd > 0"),
        sa.CheckConstraint("actual_micro_usd IS NULL OR actual_micro_usd >= 0"),
        sa.CheckConstraint("state IN ('reserved','sent','uncertain','settled','released')"),
    )
    op.create_index("ix_spend_reservation_job", "model_spend_reservation", ["job_id"])


def downgrade() -> None:
    op.drop_index("ix_spend_reservation_job", table_name="model_spend_reservation")
    op.drop_table("model_spend_reservation")
    op.drop_table("model_spend_account")
