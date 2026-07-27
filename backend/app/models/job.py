"""Job — a role a candidate is invited to interview for.

Holds the configuration authored by the Project Lead (SRS-2.6): base questions,
scoring rubric prompt, and follow-up prompt. Treated as config, not runtime input.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.candidate import Candidate


class Job(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "jobs"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    # Prompts / rubric configuration (SRS-FR-03, FR-08).
    rubric_prompt: Mapped[str | None] = mapped_column(Text)
    follow_up_prompt: Mapped[str | None] = mapped_column(Text)

    # Ordered list of 3–5 pre-seeded base questions (SRS-FR-05).
    base_questions: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )

    candidates: Mapped[list[Candidate]] = relationship(back_populates="job")
