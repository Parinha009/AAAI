"""Response — one recorded answer, base or follow-up (API Contract v1 §1).

`question_id` = 0 means the follow-up. `status` is the transcription state machine
the frontend polls. `audio_mime` is an internal column (not in shared shapes) kept
only to set the playback Content-Type.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.candidate import Candidate


class Response(TimestampMixin, Base):
    __tablename__ = "responses"
    __table_args__ = (
        CheckConstraint("type IN ('base','follow_up')", name="ck_responses_type"),
        CheckConstraint(
            "status IN ('uploaded','transcribing','transcribed','no_speech','failed')",
            name="ck_responses_status",
        ),
    )

    response_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("candidates.candidate_id", name="fk_responses_candidate_id"),
        nullable=False,
        index=True,
    )
    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.job_id", name="fk_responses_job_id"), nullable=False, index=True
    )
    question_id: Mapped[int] = mapped_column(Integer, nullable=False)  # 0 = follow-up
    type: Mapped[str] = mapped_column(String(12), nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False, server_default="uploaded")
    audio_path: Mapped[str | None] = mapped_column(String(500))
    audio_mime: Mapped[str | None] = mapped_column(String(100))  # internal (playback header)
    transcript: Mapped[str | None] = mapped_column(Text)
    no_speech_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    candidate: Mapped[Candidate] = relationship(back_populates="responses")
