"""Candidate — a person invited to a specific Job.

Also carries the consent record (SRS-FR-01): consent_at + consent_version are
written when the candidate accepts the blocking consent modal.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.audit_log import AuditLog
    from app.models.job import Job
    from app.models.response import Response
    from app.models.score import Score


class Candidate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "candidates"
    __table_args__ = (
        CheckConstraint(
            "status IN ('invited','consented','in_progress','completed')",
            name="ck_candidates_status",
        ),
    )

    job_id: Mapped[UUID] = mapped_column(
        ForeignKey("jobs.id", name="fk_candidates_job_id"),
        nullable=False,
        index=True,
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="invited")

    # Consent record (SRS-FR-01).
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consent_version: Mapped[str | None] = mapped_column(String(50))

    job: Mapped[Job] = relationship(back_populates="candidates")
    responses: Mapped[list[Response]] = relationship(back_populates="candidate")
    score: Mapped[Score | None] = relationship(back_populates="candidate", uselist=False)
    audit_logs: Mapped[list[AuditLog]] = relationship(back_populates="candidate")
