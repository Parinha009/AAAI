"""budget usage counter (FR-16 / NFR-03)

One row per billing month holding the running estimated OpenAI spend, so the
$10 kill-switch survives restarts and can't lose track of money.

Revision ID: 0002_budget_usage
Revises: 0001_initial
Create Date: 2026-07-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_budget_usage"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "budget_usage",
        sa.Column("month", sa.String(7), primary_key=True),  # 'YYYY-MM'
        sa.Column("estimated_spend_usd", sa.Numeric(10, 4), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("budget_usage")
