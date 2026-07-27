"""Recruiter — a provisioned, trusted dashboard user (SRS-2.3).

Recruiters are provisioned (not self-registered) and sign in via magic link
(SRS-FR-04), same as candidates but role-scoped to the recruiter dashboard.
"""

from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Recruiter(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "recruiters"

    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    name: Mapped[str | None] = mapped_column(String(255))
