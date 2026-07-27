"""AuditLog — append-only trail of AI calls and anti-cheat events.

Every AI request/response pair and every anti-cheat event (e.g. TAB_OUT) is a new
row here, foreign-keyed to Candidate and Job (SRS-FR-13, SRS-NFR-01).

IMMUTABILITY IS ENFORCED AT THE DATABASE LEVEL. A BEFORE UPDATE/DELETE/TRUNCATE
trigger (see the initial Alembic migration) raises an exception, so no code path
— application or ad-hoc SQL — can alter or remove a persisted row. `seq` is a
monotonic identity column giving a strict chronological ordering.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Identity, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.candidate import Candidate

_EVENT_TYPES = ("AI_REQUEST", "AI_RESPONSE", "TAB_OUT", "CONSENT", "PASTE_BLOCKED")


class AuditLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        CheckConstraint(
            "event_type IN ('AI_REQUEST','AI_RESPONSE','TAB_OUT','CONSENT','PASTE_BLOCKED')",
            name="ck_audit_logs_event_type",
        ),
        Index("ix_audit_logs_candidate_created", "candidate_id", "created_at"),
    )

    # Strict chronological ordering, independent of clock resolution.
    seq: Mapped[int] = mapped_column(BigInteger, Identity(always=True), nullable=False, unique=True)

    candidate_id: Mapped[UUID] = mapped_column(
        ForeignKey("candidates.id", name="fk_audit_logs_candidate_id"),
        nullable=False,
    )
    job_id: Mapped[UUID] = mapped_column(
        ForeignKey("jobs.id", name="fk_audit_logs_job_id"),
        nullable=False,
    )

    event_type: Mapped[str] = mapped_column(String(30), nullable=False)

    # Verbatim payloads (SRS-NFR-01: stored raw, not summarized).
    request_payload: Mapped[dict | None] = mapped_column(JSONB)
    response_payload: Mapped[dict | None] = mapped_column(JSONB)
    event_data: Mapped[dict | None] = mapped_column(JSONB)

    candidate: Mapped[Candidate] = relationship(back_populates="audit_logs")
