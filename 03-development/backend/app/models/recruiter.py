"""Recruiter — provisioned dashboard user (backend-only helper, not in the shared
contract). Recruiter identity is never exposed with an id in shared payloads.
"""

from __future__ import annotations

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Recruiter(TimestampMixin, Base):
    __tablename__ = "recruiters"

    recruiter_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(254), nullable=False, unique=True)
    name: Mapped[str | None] = mapped_column(String(150))
