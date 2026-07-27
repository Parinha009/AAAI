"""AuditLog — append-only history (API Contract v1 §1; FR-13 / NFR-01).

Immutability is enforced at the DATABASE level: BEFORE UPDATE/DELETE/TRUNCATE
triggers (see the initial migration) reject any mutation. Chronological order
comes from the SERIAL log_id.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.candidate import Candidate


class AuditLog(TimestampMixin, Base):
    __tablename__ = "auditlogs"
    __table_args__ = (
        CheckConstraint(
            "event_type IN ('CONSENT','AI_REQUEST','AI_RESPONSE','TAB_OUT','BUDGET_FREEZE')",
            name="ck_auditlogs_event_type",
        ),
        Index("ix_auditlogs_candidate_created", "candidate_id", "created_at"),
    )

    log_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("candidates.candidate_id", name="fk_auditlogs_candidate_id"),
        nullable=False,
    )
    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.job_id", name="fk_auditlogs_job_id"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(24), nullable=False)
    # Raw AI request/response or event data, stored verbatim (NFR-01).
    payload: Mapped[dict | None] = mapped_column(JSONB)

    candidate: Mapped[Candidate] = relationship(back_populates="audit_logs")
