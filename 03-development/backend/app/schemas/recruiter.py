"""Recruiter dashboard contract shapes (API Contract v1 §3.4)."""

from datetime import datetime

from pydantic import BaseModel, Field


# --- POST /jobs/{id}/invite (v1.1 addition — recruiter invites a candidate) ---
class InviteRequest(BaseModel):
    email: str = Field(..., description="Candidate's email — the sign-in link is sent here")
    name: str | None = Field(None, description="Optional display name")


class InviteResponse(BaseModel):
    candidate_id: int
    job_id: int
    email: str
    name: str | None = None
    candidate_status: str
    invite_sent: bool = True
    # True when the email's previous interview was finished, so a new one was created.
    new_interview: bool = False
    # Development-only helpers (hidden in production).
    dev_magic_link: str | None = None
    dev_token: str | None = None


# --- GET /jobs (#13) ---
class JobSummary(BaseModel):
    job_id: int
    title: str
    candidate_count: int


class JobsResponse(BaseModel):
    jobs: list[JobSummary]


# --- GET /jobs/{id}/leaderboard (#14) ---
class TraitScores(BaseModel):
    technical_skill: int
    communication: int
    problem_solving: int
    job_fit: int


class LeaderboardCandidate(BaseModel):
    candidate_id: int
    name: str | None
    aggregate_score: int  # sum of the four traits (4–20)
    scores: TraitScores
    tab_out_count: int
    needs_review: bool
    review_reasons: list[str]


class LeaderboardResponse(BaseModel):
    job_id: int
    title: str
    candidates: list[LeaderboardCandidate]


# --- GET /candidates/{id} (#15) ---
class CandidateInfo(BaseModel):
    candidate_id: int
    name: str | None
    email: str
    status: str
    consent_at: datetime | None


class JobInfo(BaseModel):
    job_id: int
    title: str


class ResponseDetail(BaseModel):
    response_id: int
    type: str
    question_id: int
    question_text: str | None
    transcript: str | None
    no_speech_flag: bool
    audio_url: str | None
    created_at: datetime


class ScoreDetail(BaseModel):
    technical_skill: int
    communication: int
    problem_solving: int
    job_fit: int
    aggregate_score: int
    rationale: dict | None
    manual_review_flag: bool


class CandidateDetail(BaseModel):
    candidate: CandidateInfo
    job: JobInfo
    responses: list[ResponseDetail]
    score: ScoreDetail | None
    tab_out_count: int
    review_reasons: list[str]


# --- GET /jobs/{id}/candidates (v1.1 addition) — every candidate, scored or not ---
class JobCandidate(BaseModel):
    candidate_id: int
    name: str | None
    email: str
    status: str
    response_count: int
    aggregate_score: int | None = Field(None, description="null until AI scoring has run")
    scores: TraitScores | None = None
    tab_out_count: int
    needs_review: bool
    review_reasons: list[str]


class JobCandidatesResponse(BaseModel):
    job_id: int
    title: str
    candidates: list[JobCandidate]


# --- GET /candidates/{id}/audit (#17, FR-13) — read-only, chronological ---
class AuditEvent(BaseModel):
    log_id: int
    event_type: str
    created_at: datetime
    payload: dict | None = None


class AuditTrailResponse(BaseModel):
    candidate_id: int
    events: list[AuditEvent]
