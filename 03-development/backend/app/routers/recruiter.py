"""Recruiter dashboard routes (API Contract v1 §3.4; FR-14/15).

Leaderboard, candidate drill-down, and raw audio playback. All recruiter-only,
gated by RBAC permissions. Review flags follow the contract §5 placeholder rules:
communication <= 2, tab_out_count >= 3, or a grading failure.
"""

import re
from pathlib import Path

from fastapi import APIRouter, Depends, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import pipeline
from app.config import settings
from app.database import get_db
from app.errors import api_error
from app.magic_links import issue_magic_link
from app.models import AuditLog, Candidate, Job, Recruiter, Response, Score
from app.rbac import require_permission
from app.roles import Permission
from app.schemas.recruiter import (
    CandidateDetail,
    CandidateInfo,
    InviteRequest,
    InviteResponse,
    JobCandidate,
    JobCandidatesResponse,
    JobInfo,
    JobSummary,
    JobsResponse,
    LeaderboardCandidate,
    LeaderboardResponse,
    ResponseDetail,
    ScoreDetail,
    TraitScores,
)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

router = APIRouter(tags=["recruiter"])

LOW_COMMUNICATION = 2
HIGH_TAB_OUT = 3


def _tab_out_count(db: Session, candidate_id: int) -> int:
    return db.scalar(
        select(func.count())
        .select_from(AuditLog)
        .where(AuditLog.candidate_id == candidate_id, AuditLog.event_type == "TAB_OUT")
    ) or 0


def _review_reasons(score: Score | None, tab_out_count: int, grading_failed: bool = False) -> list[str]:
    reasons: list[str] = []
    if score is not None and score.communication <= LOW_COMMUNICATION:
        reasons.append("LOW_COMMUNICATION")
    if tab_out_count >= HIGH_TAB_OUT:
        reasons.append("HIGH_TAB_OUT")
    if grading_failed or (score is not None and score.manual_review_flag):
        reasons.append("GRADING_FAILED")
    return reasons


def _aggregate(score: Score) -> int:
    return score.technical_skill + score.communication + score.problem_solving + score.job_fit


@router.get(
    "/jobs",
    response_model=JobsResponse,
    summary="List jobs for the dashboard (FR-14)",
    dependencies=[Depends(require_permission(Permission.VIEW_LEADERBOARD))],
)
def list_jobs(db: Session = Depends(get_db)) -> JobsResponse:
    jobs = db.execute(select(Job).order_by(Job.job_id)).scalars().all()
    out = []
    for j in jobs:
        count = db.scalar(
            select(func.count()).select_from(Candidate).where(Candidate.job_id == j.job_id)
        ) or 0
        out.append(JobSummary(job_id=j.job_id, title=j.title, candidate_count=count))
    return JobsResponse(jobs=out)


@router.get(
    "/jobs/{job_id}/leaderboard",
    response_model=LeaderboardResponse,
    summary="Ranked candidates for a job (FR-14/15)",
    dependencies=[Depends(require_permission(Permission.VIEW_LEADERBOARD))],
)
def leaderboard(job_id: int, db: Session = Depends(get_db)) -> LeaderboardResponse:
    job = db.get(Job, job_id)
    if job is None:
        raise api_error(404, "NOT_FOUND", "No such job")

    rows = db.execute(
        select(Candidate, Score)
        .join(Score, Score.candidate_id == Candidate.candidate_id)
        .where(Candidate.job_id == job_id)
    ).all()

    items = []
    for cand, score in rows:
        toc = _tab_out_count(db, cand.candidate_id)
        reasons = _review_reasons(score, toc)
        items.append(
            LeaderboardCandidate(
                candidate_id=cand.candidate_id,
                name=cand.name,
                aggregate_score=_aggregate(score),
                scores=TraitScores(
                    technical_skill=score.technical_skill,
                    communication=score.communication,
                    problem_solving=score.problem_solving,
                    job_fit=score.job_fit,
                ),
                tab_out_count=toc,
                needs_review=bool(reasons),
                review_reasons=reasons,
            )
        )
    items.sort(key=lambda c: c.aggregate_score, reverse=True)  # high → low
    return LeaderboardResponse(job_id=job.job_id, title=job.title, candidates=items)


@router.get(
    "/candidates/{candidate_id}",
    response_model=CandidateDetail,
    summary="Full candidate drill-down (FR-14/15)",
    dependencies=[Depends(require_permission(Permission.VIEW_CANDIDATE))],
)
def candidate_detail(candidate_id: int, db: Session = Depends(get_db)) -> CandidateDetail:
    cand = db.get(Candidate, candidate_id)
    if cand is None:
        raise api_error(404, "NOT_FOUND", "No such candidate")
    job = db.get(Job, cand.job_id)
    base_questions = (job.base_questions or []) if job else []
    follow_up_text = pipeline.follow_up_question(db, candidate_id)

    responses = db.execute(
        select(Response).where(Response.candidate_id == candidate_id).order_by(Response.type, Response.question_id)
    ).scalars().all()

    resp_out = []
    for r in responses:
        qtext = None
        if r.type == "base" and 1 <= r.question_id <= len(base_questions):
            qtext = base_questions[r.question_id - 1]
        elif r.type == "follow_up":
            qtext = follow_up_text
        resp_out.append(
            ResponseDetail(
                response_id=r.response_id,
                type=r.type,
                question_id=r.question_id,
                question_text=qtext,
                transcript=r.transcript,
                no_speech_flag=r.no_speech_flag,
                audio_url=f"/api/v1/responses/{r.response_id}/audio" if r.audio_path else None,
                created_at=r.created_at,
            )
        )

    score = db.execute(select(Score).where(Score.candidate_id == candidate_id)).scalar_one_or_none()
    toc = _tab_out_count(db, candidate_id)
    reasons = _review_reasons(score, toc, pipeline.scoring_failed(db, candidate_id))

    score_out = None
    if score is not None:
        score_out = ScoreDetail(
            technical_skill=score.technical_skill,
            communication=score.communication,
            problem_solving=score.problem_solving,
            job_fit=score.job_fit,
            aggregate_score=_aggregate(score),
            rationale=score.rationale,
            manual_review_flag=score.manual_review_flag,
        )

    return CandidateDetail(
        candidate=CandidateInfo(
            candidate_id=cand.candidate_id,
            name=cand.name,
            email=cand.email,
            status=cand.status,
            consent_at=cand.consent_at,
        ),
        job=JobInfo(job_id=job.job_id, title=job.title) if job else JobInfo(job_id=cand.job_id, title=""),
        responses=resp_out,
        score=score_out,
        tab_out_count=toc,
        review_reasons=reasons,
    )


@router.get(
    "/responses/{response_id}/audio",
    summary="Stream one recording for playback (FR-15)",
    dependencies=[Depends(require_permission(Permission.PLAY_AUDIO))],
)
def response_audio(response_id: int, db: Session = Depends(get_db)) -> FileResponse:
    r = db.get(Response, response_id)
    if r is None or not r.audio_path:
        raise api_error(404, "NOT_FOUND", "No audio for this response")
    path = Path(r.audio_path)
    if not path.exists():
        raise api_error(404, "NOT_FOUND", "Audio file is missing")
    return FileResponse(str(path), media_type=r.audio_mime or "application/octet-stream")


@router.post(
    "/jobs/{job_id}/invite",
    response_model=InviteResponse,
    response_model_exclude_none=True,  # hide dev_* helpers in production
    status_code=status.HTTP_201_CREATED,
    summary="Invite a candidate to a job — emails them a magic link (FR-04)",
    dependencies=[Depends(require_permission(Permission.INVITE_CANDIDATE))],
)
def invite_candidate(job_id: int, payload: InviteRequest, db: Session = Depends(get_db)) -> InviteResponse:
    """Candidates are invited by a recruiter, never self-registered (SRS-2.3 / FR-04).
    Creates the candidate for this job (or re-uses an existing invite) and emails a
    single-use sign-in link. Re-inviting the same email simply re-sends the link."""
    job = db.get(Job, job_id)
    if job is None:
        raise api_error(404, "NOT_FOUND", "No such job")

    email = payload.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise api_error(422, "VALIDATION_ERROR", "Enter a valid email address", {"field": "email"})
    if db.query(Recruiter).filter(Recruiter.email == email).first() is not None:
        raise api_error(409, "CONFLICT", "That email belongs to a recruiter account")

    candidate = (
        db.query(Candidate).filter(Candidate.email == email, Candidate.job_id == job_id).first()
    )
    if candidate is None:
        candidate = Candidate(job_id=job_id, email=email, name=payload.name, status="invited")
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
    elif payload.name and not candidate.name:
        candidate.name = payload.name
        db.commit()

    raw, link = issue_magic_link(db, email=email, role="candidate", job_id=job_id)

    resp = InviteResponse(
        candidate_id=candidate.candidate_id,
        job_id=job_id,
        email=email,
        name=candidate.name,
        candidate_status=candidate.status,
    )
    if settings.environment == "development":
        resp.dev_magic_link = link
        resp.dev_token = raw
    return resp



@router.get(
    "/jobs/{job_id}/candidates",
    response_model=JobCandidatesResponse,
    summary="All candidates for a job — scored or not (v1.1, FR-14/15)",
    dependencies=[Depends(require_permission(Permission.VIEW_CANDIDATE))],
)
def job_candidates(job_id: int, db: Session = Depends(get_db)) -> JobCandidatesResponse:
    """Unlike the leaderboard (scored candidates only), this lists everyone invited
    to the job, so recruiters can review interviews before AI scoring exists.
    Scored candidates come first (high to low), then the rest by invite order."""
    job = db.get(Job, job_id)
    if job is None:
        raise api_error(404, "NOT_FOUND", "No such job")

    items = []
    for cand in db.execute(select(Candidate).where(Candidate.job_id == job_id)).scalars():
        score = db.execute(select(Score).where(Score.candidate_id == cand.candidate_id)).scalar_one_or_none()
        toc = _tab_out_count(db, cand.candidate_id)
        reasons = _review_reasons(score, toc, pipeline.scoring_failed(db, cand.candidate_id))
        count = db.scalar(
            select(func.count()).select_from(Response).where(Response.candidate_id == cand.candidate_id)
        ) or 0
        items.append(
            JobCandidate(
                candidate_id=cand.candidate_id,
                name=cand.name,
                email=cand.email,
                status=cand.status,
                response_count=count,
                aggregate_score=_aggregate(score) if score else None,
                scores=TraitScores(
                    technical_skill=score.technical_skill,
                    communication=score.communication,
                    problem_solving=score.problem_solving,
                    job_fit=score.job_fit,
                ) if score else None,
                tab_out_count=toc,
                needs_review=bool(reasons),
                review_reasons=reasons,
            )
        )
    items.sort(key=lambda c: (c.aggregate_score is None, -(c.aggregate_score or 0), c.candidate_id))
    return JobCandidatesResponse(job_id=job.job_id, title=job.title, candidates=items)
