"""Interview flow routes: consent (FR-01), base questions (FR-05), processing (FR-17)."""

import time
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import AuditLog, Candidate, Job
from app.schemas.interview import (
    BaseQuestion,
    ConsentRequest,
    ConsentResponse,
    ProcessingStartResponse,
    ProcessingStatusResponse,
    QuestionSetResponse,
)
from app.security import get_current_candidate, require_consent

router = APIRouter(prefix="/api/interview", tags=["interview"])


@router.post("/consent", response_model=ConsentResponse, summary="Log candidate consent (FR-01)")
def log_consent(
    payload: ConsentRequest,
    candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
) -> ConsentResponse:
    if not payload.consent:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Consent must be affirmatively given")

    # Idempotent: only write the first time consent is recorded.
    if candidate.consent_at is None:
        candidate.consent_at = datetime.now(timezone.utc)
        candidate.consent_version = settings.consent_version
        if candidate.status == "invited":
            candidate.status = "consented"
        # Append the consent event to the immutable audit trail (FR-13).
        db.add(
            AuditLog(
                candidate_id=candidate.id,
                job_id=candidate.job_id,
                event_type="CONSENT",
                event_data={"consent_version": settings.consent_version},
            )
        )
        db.commit()
        db.refresh(candidate)

    return ConsentResponse(
        candidate_id=candidate.id,
        status=candidate.status,
        consent_version=candidate.consent_version,
        consented_at=candidate.consent_at,
    )


@router.get(
    "/questions",
    response_model=QuestionSetResponse,
    summary="Fetch ordered base questions (FR-05) — requires consent (FR-01)",
)
def get_questions(
    candidate: Candidate = Depends(require_consent),
    db: Session = Depends(get_db),
) -> QuestionSetResponse:
    job = db.get(Job, candidate.job_id)
    questions = [
        BaseQuestion(index=i, text=text) for i, text in enumerate(job.base_questions or [])
    ]

    # Entering the base round moves the candidate to in_progress.
    if candidate.status == "consented":
        candidate.status = "in_progress"
        db.commit()

    return QuestionSetResponse(
        job_id=job.id,
        job_title=job.title,
        base_round_seconds=settings.base_round_seconds,
        questions=questions,
    )


# --- Async processing stub (FR-17) ---------------------------------------
# In-memory task registry standing in for real background jobs. Lets the
# frontend build the "Processing..." polling UX against a real contract:
# state transitions queued -> processing -> complete over ~15s.
_PROCESSING_TASKS: dict[str, float] = {}


@router.post(
    "/processing",
    response_model=ProcessingStartResponse,
    summary="Start a stub async processing job (FR-17)",
)
def start_processing(candidate: Candidate = Depends(get_current_candidate)) -> ProcessingStartResponse:
    task_id = uuid4().hex
    _PROCESSING_TASKS[task_id] = time.monotonic()
    return ProcessingStartResponse(task_id=task_id, state="queued")


@router.get(
    "/processing/{task_id}",
    response_model=ProcessingStatusResponse,
    summary="Poll a stub processing job (FR-17)",
)
def processing_status(
    task_id: str,
    candidate: Candidate = Depends(get_current_candidate),
) -> ProcessingStatusResponse:
    started = _PROCESSING_TASKS.get(task_id)
    if started is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown processing task")

    elapsed = time.monotonic() - started
    if elapsed < 2:
        state = "queued"
    elif elapsed < settings.processing_pause_seconds:
        state = "processing"
    else:
        state = "complete"

    result = {"message": "next_step_ready"} if state == "complete" else None
    return ProcessingStatusResponse(
        task_id=task_id, state=state, elapsed_seconds=round(elapsed, 1), result=result
    )
