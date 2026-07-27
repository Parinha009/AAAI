"""MagicLinkToken — single-use, time-boxed sign-in token (SRS-FR-04 / NFR-04).

Only a SHA-256 *hash* of the random token is stored, so a DB leak never exposes
usable links. `consumed_at` enforces single-use; `expires_at` enforces the short
window. The token is bound to an email + role (+ job for candidates), which is
what makes candidate tokens unusable for the recruiter dashboard and vice versa.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class MagicLinkToken(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "magic_link_tokens"
    __table_args__ = (
        CheckConstraint("role IN ('candidate','recruiter')", name="ck_magic_link_role"),
    )

    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)

    # Bound subject — candidate (with job) or recruiter.
    job_id: Mapped[UUID | None] = mapped_column(ForeignKey("jobs.id", name="fk_magic_link_job_id"))
    candidate_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("candidates.id", name="fk_magic_link_candidate_id")
    )
    recruiter_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("recruiters.id", name="fk_magic_link_recruiter_id")
    )

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
