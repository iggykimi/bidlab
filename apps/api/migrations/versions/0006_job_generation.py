"""Job generation for worker claim fencing (PKG-T03)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_job_generation"
down_revision: str | None = "0005_spend_reservations"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("job", sa.Column("generation", sa.Integer, nullable=False, server_default="1"))


def downgrade() -> None:
    op.drop_column("job", "generation")
