"""Job — one job opening with its questions & rubric (API Contract v1 §1)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.candidate import Candidate


class Job(TimestampMixin, Base):
    __tablename__ = "jobs"

    job_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # 4-trait rubric + scoring anchors (Lead-authored). Shape locked, values pending.
    rubric_config: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    # Ordered list of 3–5 base questions.
    base_questions: Mapped[list] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))

    candidates: Mapped[list[Candidate]] = relationship(back_populates="job")
