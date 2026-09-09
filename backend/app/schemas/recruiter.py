"""Recruiter dashboard contract shapes (API Contract v1 §3.4)."""

from datetime import datetime

from pydantic import BaseModel


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
