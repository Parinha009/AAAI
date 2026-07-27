"""Interview flow contract: consent, base questions, and the async processing stub."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# --- Consent (SRS-FR-01) --------------------------------------------------
class ConsentRequest(BaseModel):
    consent: bool = Field(..., description="Must be true — affirmative agreement to be recorded and AI-evaluated")


class ConsentResponse(BaseModel):
    candidate_id: UUID
    status: str
    consent_version: str
    consented_at: datetime


# --- Base questions (SRS-FR-05) ------------------------------------------
class BaseQuestion(BaseModel):
    index: int = Field(..., description="0-based position in the base round")
    text: str


class QuestionSetResponse(BaseModel):
    job_id: UUID
    job_title: str
    base_round_seconds: int = Field(..., description="Single global countdown for the whole base round (FR-05)")
    questions: list[BaseQuestion]


# --- Audio responses (SRS-FR-06) -----------------------------------------
class ResponseUploadResult(BaseModel):
    response_id: UUID
    response_type: str
    question_index: int | None
    audio_mime: str | None
    audio_size_bytes: int
    transcription_status: str = Field("pending", description="Queued for Whisper (FR-07)")


class ResponseItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    response_type: str
    question_index: int | None
    question_text: str | None
    audio_mime: str | None
    audio_size_bytes: int | None
    transcript: str | None
    no_speech: bool
    created_at: datetime


# --- Async processing stub (SRS-FR-17) -----------------------------------
class ProcessingStartResponse(BaseModel):
    task_id: str
    state: str = Field(..., description="queued | processing | complete")


class ProcessingStatusResponse(BaseModel):
    task_id: str
    state: str = Field(..., description="queued | processing | complete")
    elapsed_seconds: float
    result: dict | None = Field(None, description="Populated once state == complete")
