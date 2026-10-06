"""recruiter decisions + who invited each candidate

- candidates.invited_by_recruiter_id: the recruiter who sent the invite (shown to the
  candidate as "Invited by ...").
- candidates.decision / decided_at / decided_by_recruiter_id: the human decision
  (shortlisted / rejected) - AI suggests, people decide.
- auditlogs gains a DECISION event type, so every decision change is kept forever in
  the append-only trail (the immutability triggers are untouched).

Revision ID: 0004_decisions_invited_by
Revises: 0003_assigned_questions
Create Date: 2026-10-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004_decisions_invited_by"
down_revision: Union[str, None] = "0003_assigned_questions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD_TYPES = "'CONSENT','AI_REQUEST','AI_RESPONSE','TAB_OUT','BUDGET_FREEZE'"
_NEW_TYPES = _OLD_TYPES + ",'DECISION'"


def upgrade() -> None:
    op.add_column("candidates", sa.Column(
        "invited_by_recruiter_id", sa.Integer(),
        sa.ForeignKey("recruiters.recruiter_id", name="fk_candidates_invited_by"), nullable=True,
    ))
    op.add_column("candidates", sa.Column("decision", sa.String(12), nullable=True))
    op.add_column("candidates", sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("candidates", sa.Column(
        "decided_by_recruiter_id", sa.Integer(),
        sa.ForeignKey("recruiters.recruiter_id", name="fk_candidates_decided_by"), nullable=True,
    ))
    op.create_check_constraint(
        "ck_candidates_decision", "candidates", "decision IS NULL OR decision IN ('shortlisted','rejected')"
    )
    op.drop_constraint("ck_auditlogs_event_type", "auditlogs", type_="check")
    op.create_check_constraint("ck_auditlogs_event_type", "auditlogs", f"event_type IN ({_NEW_TYPES})")


def downgrade() -> None:
    op.drop_constraint("ck_auditlogs_event_type", "auditlogs", type_="check")
    op.create_check_constraint("ck_auditlogs_event_type", "auditlogs", f"event_type IN ({_OLD_TYPES})")
    op.drop_constraint("ck_candidates_decision", "candidates", type_="check")
    for col in ("decided_by_recruiter_id", "decided_at", "decision", "invited_by_recruiter_id"):
        op.drop_column("candidates", col)
