"""Interview contract shapes (API Contract v1 §3.3)."""

from datetime import datetime

from pydantic import BaseModel, Field


# --- Consent (FR-01) ------------------------------------------------------
class ConsentRequest(BaseModel):
    consent_version: str = Field(..., description="Which consent text was agreed to")
    agreed: bool = Field(..., description="Must be true")


class ConsentResponse(BaseModel):
    candidate_status: str
    consent_at: datetime


# --- Base questions (FR-05) ----------------------------------------------
class Question(BaseModel):
    question_id: int
    order: int
    text: str


class QuestionsResponse(BaseModel):
    base_round_seconds: int
    questions: list[Question]


# --- Response upload + poll (FR-02/06/07/17) -----------------------------
class UploadResponse(BaseModel):
    response_id: int
    question_id: int
    type: str
    status: str = Field(..., description="uploaded | transcribing | transcribed | no_speech | failed")


class ResponseStatus(BaseModel):
    response_id: int
    status: str
    transcript: str | None = None
    no_speech_flag: bool = False


# --- Tab-out (FR-12) ------------------------------------------------------
class TabOutRequest(BaseModel):
    question_id: int
    occurred_at: datetime | None = None


class TabOutResponse(BaseModel):
    status: str = "logged"


# --- Screen-flow driver (FR-17) ------------------------------------------
class InterviewStatusResponse(BaseModel):
    candidate_status: str
    stage: str = Field(..., description="consent | base | processing | follow_up | scoring | completed")
    next_action: str
