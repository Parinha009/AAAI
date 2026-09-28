"""MagicLinkToken — backend-only login helper (API Contract v1 §1 note; FR-04).

Not shared with the frontend. Stores only a SHA-256 hash of the token, bound to
email + role (+ job for candidates). `consumed_at` = single-use, `expires_at` =
short window. The subject is resolved from email/job at verify time.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class MagicLinkToken(TimestampMixin, Base):
    __tablename__ = "magic_link_tokens"
    __table_args__ = (
        CheckConstraint("role IN ('candidate','recruiter')", name="ck_magic_link_role"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(254), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    job_id: Mapped[int | None] = mapped_column(
        ForeignKey("jobs.job_id", name="fk_magic_link_job_id")
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
