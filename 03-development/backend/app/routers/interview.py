"""Interview flow routes (API Contract v1 §3.3).

consent (FR-01), base questions (FR-05), audio upload (FR-02/06), transcription
poll (FR-07/17), follow-up (FR-08), tab-out (FR-12), screen-flow status (FR-17).
The AI work itself runs in background tasks - see app/pipeline.py.
"""

import logging
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Request, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app import pipeline
from app.questions import assigned_questions
from app.config import settings
from app.database import get_db
from app.errors import api_error
from app.models import AuditLog, Candidate, Job, Response
from app.schemas.interview import (
    ConsentRequest,
    ConsentResponse,
    FollowUpQuestion,
    InterviewStatusResponse,
    Question,
    QuestionsResponse,
    ResponseStatus,
    TabOutRequest,
    TabOutResponse,
    UploadResponse,
)
from app.security import get_current_candidate, require_consent

logger = logging.getLogger("aaai.interview")
router = APIRouter(prefix="/interview", tags=["interview"])

_CHUNK = 1024 * 1024
_ALLOWED_EXT = {".webm", ".mp4", ".wav", ".m4a"}
_ALLOWED_MIME = {
    "audio/webm", "video/webm", "audio/mp4", "video/mp4",
    "audio/x-m4a", "audio/m4a", "audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave",
}


def enqueue_transcription(response_id: int) -> None:
    """Background task: Whisper transcription (FR-07), then advance the pipeline."""
    logger.info("Transcribing response %s", response_id)
    pipeline.transcribe_response(response_id)


# --- Consent (FR-01) ------------------------------------------------------
@router.post(
    "/consent",
    response_model=ConsentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record consent, unlock the interview (FR-01)",
)
def consent(
    payload: ConsentRequest,
    candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
) -> ConsentResponse:
    if not payload.agreed:
        raise api_error(422, "VALIDATION_ERROR", "'agreed' must be true to proceed")

    if candidate.consent_at is None:
        candidate.consent_at = datetime.now(timezone.utc)
        candidate.consent_version = payload.consent_version
        if candidate.status == "invited":
            candidate.status = "consented"
        db.add(
            AuditLog(
                candidate_id=candidate.candidate_id,
                job_id=candidate.job_id,
                event_type="CONSENT",
                payload={"consent_version": payload.consent_version},
            )
        )
        db.commit()
        db.refresh(candidate)

    return ConsentResponse(candidate_status=candidate.status, consent_at=candidate.consent_at)


# --- Base questions (FR-05) ----------------------------------------------
@router.get("/questions", response_model=QuestionsResponse, summary="Base questions + 5:00 timer (FR-05)")
def questions(
    candidate: Candidate = Depends(require_consent),
    db: Session = Depends(get_db),
) -> QuestionsResponse:
    # This interview's own random draw from the job's question bank (saved on first
    # call, so a refresh shows the same questions). We emit only the three fields the
    # contract freezes: question_id (stable id in the bank), order, text.
    items = [
        Question(question_id=q["question_id"], order=i + 1, text=q["text"])
        for i, q in enumerate(assigned_questions(db, candidate))
    ]
    if candidate.status == "consented":
        candidate.status = "in_progress"
        db.commit()
    return QuestionsResponse(base_round_seconds=settings.base_round_seconds, questions=items)


# --- Upload one answer (FR-02 / FR-06) -----------------------------------
@router.post(
    "/responses",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload one recorded answer (FR-02/06)",
)
def upload_response(
    request: Request,
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(..., description="Recorded audio (webm/mp4/wav/m4a, <=20 MB)"),
    question_id: int = Form(..., description="0 for the follow-up"),
    type: str = Form(..., description="'base' or 'follow_up'"),
    candidate: Candidate = Depends(require_consent),
    db: Session = Depends(get_db),
) -> UploadResponse:
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > settings.max_upload_bytes:
        raise api_error(413, "PAYLOAD_TOO_LARGE", "Audio file exceeds the 20 MB limit",
                        {"max_bytes": settings.max_upload_bytes})

    if type not in ("base", "follow_up"):
        raise api_error(422, "VALIDATION_ERROR", "type must be 'base' or 'follow_up'")
    if type == "follow_up":
        question_id = 0  # contract: the follow-up is always question 0
    elif question_id not in {q["question_id"] for q in assigned_questions(db, candidate)}:
        raise api_error(422, "VALIDATION_ERROR", "That question is not part of this interview",
                        {"field": "question_id"})

    ext = Path(audio.filename or "").suffix.lower()
    if ext not in _ALLOWED_EXT or (audio.content_type or "") not in _ALLOWED_MIME:
        raise api_error(415, "UNSUPPORTED_MEDIA_TYPE",
                        f"Unsupported audio type (ext={ext!r}, mime={audio.content_type!r})")

    media_root = Path(settings.media_dir) / str(candidate.candidate_id)
    media_root.mkdir(parents=True, exist_ok=True)
    dest = media_root / f"{uuid4().hex}{ext}"

    size = 0
    try:
        with dest.open("wb") as out:
            while True:
                chunk = audio.file.read(_CHUNK)
                if not chunk:
                    break
                if size + len(chunk) > settings.max_upload_bytes:
                    out.close()
                    dest.unlink(missing_ok=True)
                    raise api_error(413, "PAYLOAD_TOO_LARGE", "Audio file exceeds the 20 MB limit",
                                    {"max_bytes": settings.max_upload_bytes})
                size += len(chunk)
                out.write(chunk)
    except Exception:
        dest.unlink(missing_ok=True)
        raise

    # One row per question (upsert so a retry replaces, never duplicates).
    existing = (
        db.query(Response)
        .filter(
            Response.candidate_id == candidate.candidate_id,
            Response.type == type,
            Response.question_id == question_id,
        )
        .first()
    )
    if existing is not None:
        if existing.audio_path:
            Path(existing.audio_path).unlink(missing_ok=True)
        existing.audio_path = str(dest)
        existing.audio_mime = audio.content_type
        existing.status = "transcribing"
        existing.transcript = None
        existing.no_speech_flag = False
        resp = existing
    else:
        resp = Response(
            candidate_id=candidate.candidate_id,
            job_id=candidate.job_id,
            question_id=question_id,
            type=type,
            status="transcribing",
            audio_path=str(dest),
            audio_mime=audio.content_type,
        )
        db.add(resp)
    db.commit()
    db.refresh(resp)

    background_tasks.add_task(enqueue_transcription, resp.response_id)
    return UploadResponse(response_id=resp.response_id, question_id=resp.question_id, type=resp.type, status=resp.status)


# --- Poll a response (FR-07 / FR-17) -------------------------------------
@router.get("/responses/{response_id}", response_model=ResponseStatus, summary="Poll transcription status (FR-07/17)")
def response_status(
    response_id: int,
    candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
) -> ResponseStatus:
    resp = db.get(Response, response_id)
    if resp is None or resp.candidate_id != candidate.candidate_id:
        raise api_error(404, "NOT_FOUND", "No such response")
    return ResponseStatus(
        response_id=resp.response_id,
        status=resp.status,
        transcript=resp.transcript,
        no_speech_flag=resp.no_speech_flag,
    )


# --- Follow-up question (FR-08) — 202 while generating, 200 when ready -----
@router.get(
    "/follow-up",
    response_model=FollowUpQuestion,
    responses={202: {"description": "Still generating - poll again"}},
    summary="Get the one AI follow-up question (FR-08)",
)
def follow_up(
    background_tasks: BackgroundTasks,
    candidate: Candidate = Depends(require_consent),
    db: Session = Depends(get_db),
):
    question = pipeline.follow_up_question(db, candidate.candidate_id)
    if question:
        return FollowUpQuestion(text=question, follow_up_seconds=settings.follow_up_seconds)
    # Generate only once every base answer is transcribed; until then keep polling.
    if not pipeline.base_pending(db, candidate.candidate_id):
        background_tasks.add_task(pipeline.generate_follow_up, candidate.candidate_id)
    return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content={"status": "generating"})


# --- Tab-out (FR-12) — fire-and-forget, must not block recording ---------
@router.post(
    "/events/tab-out",
    response_model=TabOutResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Log a tab-switch (anti-cheat, FR-12)",
)
def tab_out(
    payload: TabOutRequest,
    candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
) -> TabOutResponse:
    db.add(
        AuditLog(
            candidate_id=candidate.candidate_id,
            job_id=candidate.job_id,
            event_type="TAB_OUT",
            payload={
                "question_id": payload.question_id,
                "occurred_at": (payload.occurred_at or datetime.now(timezone.utc)).isoformat(),
            },
        )
    )
    db.commit()
    return TabOutResponse()


# --- Screen-flow driver (FR-17) ------------------------------------------
@router.get("/status", response_model=InterviewStatusResponse, summary="What screen should the UI show? (FR-17)")
def interview_status(
    candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
) -> InterviewStatusResponse:
    def out(stage: str, next_action: str) -> InterviewStatusResponse:
        return InterviewStatusResponse(candidate_status=candidate.status, stage=stage, next_action=next_action)

    if candidate.status == "invited":
        return out("consent", "show_consent")
    if candidate.status in ("completed", "expired"):
        return out("completed", "show_complete")
    answered_follow_up = (
        db.query(Response)
        .filter(Response.candidate_id == candidate.candidate_id, Response.type == "follow_up")
        .first()
    )
    if answered_follow_up is not None:
        return out("scoring", "await_score")
    if pipeline.follow_up_question(db, candidate.candidate_id):
        return out("follow_up", "answer_follow_up")
    return out("base", "answer_base")
