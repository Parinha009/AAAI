"""Auth routes (API Contract v1 §3.2) — passwordless magic-link (FR-04)."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.email import send_magic_link
from app.errors import api_error
from app.models import Candidate, MagicLinkToken, Recruiter
from app.schemas.auth import (
    MagicLinkRequest,
    MagicLinkResponse,
    MeResponse,
    SessionContext,
    VerifyRequest,
    VerifyResponse,
)
from app.security import create_session_token, get_session, session_expires_at

router = APIRouter(prefix="/auth", tags=["auth"])


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


@router.post(
    "/magic-link",
    response_model=MagicLinkResponse,
    response_model_exclude_none=True,  # hide dev_* helpers in production
    status_code=status.HTTP_202_ACCEPTED,
    summary="Request a passwordless sign-in link (FR-04)",
)
def magic_link(payload: MagicLinkRequest, db: Session = Depends(get_db)) -> MagicLinkResponse:
    # Email is matched case-insensitively: addresses are not case-sensitive in
    # practice, and a capitalised address must not silently yield no sign-in link.
    email = payload.email.strip().lower()

    # Resolve the subject by email: recruiter first, else invited candidate.
    recruiter = db.query(Recruiter).filter(func.lower(Recruiter.email) == email).first()
    candidate = None
    if recruiter is None:
        candidate = db.query(Candidate).filter(func.lower(Candidate.email) == email).first()

    resp = MagicLinkResponse()  # generic — never reveals whether the email exists

    subject = recruiter or candidate
    if subject is not None:
        raw = secrets.token_urlsafe(32)
        token = MagicLinkToken(
            token_hash=_hash(raw),
            email=email,
            role="recruiter" if recruiter else "candidate",
            job_id=candidate.job_id if candidate else None,
            expires_at=datetime.now(timezone.utc)
            + timedelta(seconds=settings.magic_link_ttl_seconds),
        )
        db.add(token)
        db.commit()

        link = f"{settings.frontend_base_url}/auth/callback?token={raw}"
        send_magic_link(email, link)
        if settings.environment == "development":
            resp.dev_magic_link = link
            resp.dev_token = raw

    return resp


@router.post(
    "/verify",
    response_model=VerifyResponse,
    response_model_exclude_none=True,  # recruiter context omits candidate_id (FR-04)
    summary="Trade a link token for a session (FR-04)",
)
def verify(payload: VerifyRequest, db: Session = Depends(get_db)) -> VerifyResponse:
    # .strip() only: surrounding whitespace is a copy/paste artifact, never part
    # of a token (secrets.token_urlsafe emits no whitespace). The hash, and so
    # the single-use and expiry checks below, are otherwise unchanged.
    token = (
        db.query(MagicLinkToken)
        .filter(MagicLinkToken.token_hash == _hash(payload.token.strip()))
        .first()
    )
    if token is None or token.consumed_at is not None or token.expires_at < datetime.now(timezone.utc):
        # One 401 for invalid / used / expired — don't leak which (FR-04).
        raise api_error(401, "UNAUTHORIZED", "Invalid, expired, or already-used sign-in link")

    token.consumed_at = datetime.now(timezone.utc)  # single-use (FR-04 step 5)

    if token.role == "candidate":
        candidate = (
            db.query(Candidate)
            .filter(func.lower(Candidate.email) == token.email, Candidate.job_id == token.job_id)
            .first()
        )
        if candidate is None:
            raise api_error(401, "UNAUTHORIZED", "Invalid sign-in link")
        session = create_session_token(role="candidate", subject_id=candidate.candidate_id, job_id=candidate.job_id)
        context = SessionContext(candidate_id=candidate.candidate_id, job_id=candidate.job_id)
    else:
        recruiter = db.query(Recruiter).filter(func.lower(Recruiter.email) == token.email).first()
        if recruiter is None:
            raise api_error(401, "UNAUTHORIZED", "Invalid sign-in link")
        session = create_session_token(role="recruiter", subject_id=recruiter.recruiter_id)
        context = SessionContext()

    db.commit()
    return VerifyResponse(
        session_token=session, role=token.role, expires_at=session_expires_at(), context=context
    )


@router.get(
    "/me",
    response_model=MeResponse,
    response_model_exclude_none=True,  # recruiter /me omits candidate-only fields
    summary="Who am I? (after page reload)",
)
def me(session: dict = Depends(get_session), db: Session = Depends(get_db)) -> MeResponse:
    role = session.get("role")
    if role == "candidate":
        candidate = db.get(Candidate, int(session["sub"]))
        if candidate is None:
            raise api_error(401, "UNAUTHORIZED", "Candidate not found")
        return MeResponse(
            role="candidate",
            candidate_id=candidate.candidate_id,
            job_id=candidate.job_id,
            candidate_status=candidate.status,
        )
    if role == "recruiter":
        return MeResponse(role="recruiter")
    raise api_error(401, "UNAUTHORIZED", "Unknown session role")
