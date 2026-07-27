"""Score — the structured, schema-validated scorecard for a candidate session.

Four traits, each 1–5 with a rationale (SRS-FR-03). `raw_scorecard` keeps the
exact validated JSON returned by GPT-4o-mini. `needs_review` drives the
human-in-the-loop flag (SRS-FR-15). One scorecard per candidate.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.candidate import Candidate

_TRAITS = ("technical_skill", "communication", "problem_solving", "job_fit")


class Score(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "scores"
    __table_args__ = tuple(
        CheckConstraint(f"{trait} BETWEEN 1 AND 5", name=f"ck_scores_{trait}_range")
        for trait in _TRAITS
    )

    candidate_id: Mapped[UUID] = mapped_column(
        ForeignKey("candidates.id", name="fk_scores_candidate_id"),
        nullable=False,
        unique=True,  # one scorecard per candidate session
    )
    job_id: Mapped[UUID] = mapped_column(
        ForeignKey("jobs.id", name="fk_scores_job_id"),
        nullable=False,
        index=True,
    )

    technical_skill: Mapped[int] = mapped_column(Integer, nullable=False)
    communication: Mapped[int] = mapped_column(Integer, nullable=False)
    problem_solving: Mapped[int] = mapped_column(Integer, nullable=False)
    job_fit: Mapped[int] = mapped_column(Integer, nullable=False)

    technical_rationale: Mapped[str | None] = mapped_column(Text)
    communication_rationale: Mapped[str | None] = mapped_column(Text)
    problem_solving_rationale: Mapped[str | None] = mapped_column(Text)
    job_fit_rationale: Mapped[str | None] = mapped_column(Text)

    # Human-in-the-loop (SRS-FR-15).
    needs_review: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    review_reason: Mapped[str | None] = mapped_column(Text)

    # Verbatim validated JSON payload from GPT-4o-mini (SRS-FR-03).
    raw_scorecard: Mapped[dict | None] = mapped_column(JSONB)

    candidate: Mapped[Candidate] = relationship(back_populates="score")
