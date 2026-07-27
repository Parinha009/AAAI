"""Declarative base and shared timestamp mixin.

Primary keys are integer SERIAL per API Contract v1 (job_id, candidate_id, ...),
so each model declares its own named PK; only created_at is shared here.
"""

from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    """Server-set creation timestamp (timezone-aware)."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
