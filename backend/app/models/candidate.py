"""Candidate — one person invited to one job (API Contract v1 §1)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.audit_log import AuditLog
    from app.models.job import Job
    from app.models.response import Response
    from app.models.score import Score


class Candidate(TimestampMixin, Base):
    __tablename__ = "candidates"
    __table_args__ = (
        CheckConstraint(
            "status IN ('invited','consented','in_progress','completed','expired')",
            name="ck_candidates_status",
        ),
    )

    candidate_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.job_id", name="fk_candidates_job_id"), nullable=False, index=True
    )
    name: Mapped[str | None] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    consent_version: Mapped[str | None] = mapped_column(String(20))
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="invited")

    job: Mapped[Job] = relationship(back_populates="candidates")
    responses: Mapped[list[Response]] = relationship(back_populates="candidate")
    score: Mapped[Score | None] = relationship(back_populates="candidate", uselist=False)
    audit_logs: Mapped[list[AuditLog]] = relationship(back_populates="candidate")
