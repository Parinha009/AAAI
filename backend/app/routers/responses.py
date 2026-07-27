"""Audio upload & validation pipeline (SRS-FR-06).

Accepts a recorded answer as multipart upload, streams it to disk with a hard
20 MB ceiling (an oversized file is never persisted), validates the audio type,
records only the file *path* in Postgres, and enqueues transcription (FR-07).
"""

import logging
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Candidate, Response
from app.schemas.interview import ResponseItem, ResponseUploadResult
from app.security import require_consent

logger = logging.getLogger("aaai.responses")

router = APIRouter(prefix="/api/interview", tags=["responses"])

_CHUNK = 1024 * 1024  # 1 MB streaming chunk
_ALLOWED_EXT = {".webm", ".mp4", ".wav", ".m4a"}
_ALLOWED_MIME = {
    "audio/webm",
    "video/webm",
    "audio/mp4",
    "video/mp4",
    "audio/x-m4a",
    "audio/m4a",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/vnd.wave",
}


def enqueue_transcription(response_id: UUID) -> None:
    """STUB for FR-07 (Whisper) — the AI/Infra engineer's slice.

    Real implementation dispatches a background job that transcribes the stored
    audio and fills Response.transcript (or sets no_speech). For now it only logs.
    """
    logger.info("Enqueued response %s for transcription (stub)", response_id)


def _reject_by_content_length(request: Request) -> None:
    """Fast pre-check: reject before reading the body when a client is honest
    about the size via the Content-Length header."""
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > settings.max_upload_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Upload exceeds the {settings.max_upload_bytes // (1024 * 1024)} MB limit",
        )


@router.post(
    "/responses",
    response_model=ResponseUploadResult,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a recorded answer (FR-06)",
)
def upload_response(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Recorded audio (webm/mp4/wav/m4a, <=20 MB)"),
    response_type: str = Form(..., description="'base' or 'follow_up'"),
    question_index: int | None = Form(None, description="Required for base responses"),
    question_text: str | None = Form(None),
    candidate: Candidate = Depends(require_consent),
    db: Session = Depends(get_db),
) -> ResponseUploadResult:
    _reject_by_content_length(request)

    if response_type not in ("base", "follow_up"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "response_type must be 'base' or 'follow_up'")
    if response_type == "base" and question_index is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "question_index is required for base responses")

    # Validate audio type against the allow-list (FR-06 step 3).
    ext = Path(file.filename or "").suffix.lower()
    if ext not in _ALLOWED_EXT or (file.content_type or "") not in _ALLOWED_MIME:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Unsupported audio type (ext={ext!r}, mime={file.content_type!r}); "
            f"allowed extensions: {sorted(_ALLOWED_EXT)}",
        )

    media_root = Path(settings.media_dir) / str(candidate.id)
    media_root.mkdir(parents=True, exist_ok=True)
    dest = media_root / f"{uuid4().hex}{ext}"

    # Stream to disk, enforcing the hard ceiling. If exceeded, delete the partial
    # file and reject — an oversized file is never left in persistent storage.
    size = 0
    try:
        with dest.open("wb") as out:
            while True:
                chunk = file.file.read(_CHUNK)
                if not chunk:
                    break
                if size + len(chunk) > settings.max_upload_bytes:
                    out.close()
                    dest.unlink(missing_ok=True)
                    raise HTTPException(
                        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        f"Upload exceeds the {settings.max_upload_bytes // (1024 * 1024)} MB limit",
                    )
                size += len(chunk)
                out.write(chunk)
    except HTTPException:
        raise
    except Exception:
        dest.unlink(missing_ok=True)
        raise

    # Exactly one Responses row per question (FR-06 acceptance): upsert so a
    # retry replaces the prior audio instead of creating a duplicate row.
    query = db.query(Response).filter(
        Response.candidate_id == candidate.id,
        Response.response_type == response_type,
    )
    if response_type == "base":
        query = query.filter(Response.question_index == question_index)
    existing = query.first()

    if existing is not None:
        if existing.audio_path:
            Path(existing.audio_path).unlink(missing_ok=True)
        existing.audio_path = str(dest)
        existing.audio_mime = file.content_type
        existing.audio_size_bytes = size
        if question_text:
            existing.question_text = question_text
        existing.transcript = None
        existing.no_speech = False
        resp = existing
    else:
        resp = Response(
            candidate_id=candidate.id,
            job_id=candidate.job_id,
            response_type=response_type,
            question_index=question_index,
            question_text=question_text,
            audio_path=str(dest),
            audio_mime=file.content_type,
            audio_size_bytes=size,
        )
        db.add(resp)

    db.commit()
    db.refresh(resp)

    # Hand off to transcription (FR-07) without blocking the response (FR-17).
    background_tasks.add_task(enqueue_transcription, resp.id)

    return ResponseUploadResult(
        response_id=resp.id,
        response_type=resp.response_type,
        question_index=resp.question_index,
        audio_mime=resp.audio_mime,
        audio_size_bytes=resp.audio_size_bytes,
    )


@router.get(
    "/responses",
    response_model=list[ResponseItem],
    summary="List the current candidate's responses",
)
def list_responses(
    candidate: Candidate = Depends(require_consent),
    db: Session = Depends(get_db),
) -> list[Response]:
    return (
        db.query(Response)
        .filter(Response.candidate_id == candidate.id)
        .order_by(Response.response_type, Response.question_index)
        .all()
    )
