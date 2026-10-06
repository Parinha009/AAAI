"""per-interview question draw (FR-05)

Each job now holds a bank of questions; every interview draws its own random set.
The draw is stored on the candidate so a refresh or resume shows the same questions,
and so the recruiter can see exactly which questions that interview was asked.

Revision ID: 0003_assigned_questions
Revises: 0002_budget_usage
Create Date: 2026-10-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0003_assigned_questions"
down_revision: Union[str, None] = "0002_budget_usage"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ordered list of the job's question_ids drawn for this interview (null = not drawn yet).
    op.add_column("candidates", sa.Column("assigned_questions", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("candidates", "assigned_questions")
