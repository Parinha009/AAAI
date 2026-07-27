"""Response — one recorded answer (base or follow-up) and its transcript.

Stores only a *path/reference* to the audio artifact, not the blob itself
(SRS-FR-06). Transcript is filled in asynchronously by Whisper (SRS-FR-07);
`no_speech` flags empty/unintelligible audio rather than fabricating text.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, Boolean, CheckConstraint, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.candidate import Candidate


class Response(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "responses"
    __table_args__ = (
        CheckConstraint(
            "response_type IN ('base','follow_up')",
            name="ck_responses_type",
        ),
    )

    candidate_id: Mapped[UUID] = mapped_column(
        ForeignKey("candidates.id", name="fk_responses_candidate_id"),
        nullable=False,
        index=True,
    )
    job_id: Mapped[UUID] = mapped_column(
        ForeignKey("jobs.id", name="fk_responses_job_id"),
        nullable=False,
        index=True,
    )

    response_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # Position within the base round; NULL for the single follow-up.
    question_index: Mapped[int | None] = mapped_column(Integer)
    # Snapshot of the prompt shown (base text, or the AI-generated follow-up).
    question_text: Mapped[str | None] = mapped_column(Text)

    # Audio artifact (SRS-FR-06) — reference only.
    audio_path: Mapped[str | None] = mapped_column(String(1024))
    audio_mime: Mapped[str | None] = mapped_column(String(100))
    audio_size_bytes: Mapped[int | None] = mapped_column(BigInteger)

    # Transcription (SRS-FR-07).
    transcript: Mapped[str | None] = mapped_column(Text)
    no_speech: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    detected_language: Mapped[str | None] = mapped_column(String(20))

    candidate: Mapped[Candidate] = relationship(back_populates="responses")
