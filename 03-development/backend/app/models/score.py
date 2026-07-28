"""Score — one scorecard per candidate (API Contract v1 §1)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.candidate import Candidate

_TRAITS = ("technical_skill", "communication", "problem_solving", "job_fit")


class Score(TimestampMixin, Base):
    __tablename__ = "scores"
    __table_args__ = tuple(
        CheckConstraint(f"{t} BETWEEN 1 AND 5", name=f"ck_scores_{t}_range") for t in _TRAITS
    )

    score_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("candidates.candidate_id", name="fk_scores_candidate_id"),
        nullable=False,
        unique=True,  # one scorecard per candidate
    )
    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.job_id", name="fk_scores_job_id"), nullable=False, index=True
    )
    technical_skill: Mapped[int] = mapped_column(Integer, nullable=False)
    communication: Mapped[int] = mapped_column(Integer, nullable=False)
    problem_solving: Mapped[int] = mapped_column(Integer, nullable=False)
    job_fit: Mapped[int] = mapped_column(Integer, nullable=False)
    # { "<trait>": "<why>" } — includes any robotic-language trigger (FR-10).
    rationale: Mapped[dict | None] = mapped_column(JSONB)
    manual_review_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    candidate: Mapped[Candidate] = relationship(back_populates="score")
