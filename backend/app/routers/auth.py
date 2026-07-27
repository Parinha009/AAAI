"""Auth routes — a stub session issuer for the vertical slice.

`POST /api/auth/dev-login` stands in for the real email magic-link (SRS-FR-04):
given a job + email it finds-or-creates the candidate and returns a signed
session token. Swap this for real magic-link issuance in a later slice.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.email import send_magic_link
from app.models import Candidate, Job, MagicLinkToken, Recruiter
from app.schemas.auth import (
    DevLoginRequest,
    RequestLinkRequest,
    RequestLinkResponse,
    SessionInfo,
    SessionResponse,
    VerifiedSession,
    VerifyRequest,
)
from app.security import create_session_token, get_current_candidate

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


@router.post(
    "/request-link",
    response_model=RequestLinkResponse,
    summary="Request a passwordless sign-in link (FR-04)",
)
def request_link(payload: RequestLinkRequest, db: Session = Depends(get_db)) -> RequestLinkResponse:
    if payload.role not in ("candidate", "recruiter"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "role must be 'candidate' or 'recruiter'")

    candidate = recruiter = None
    if payload.role == "candidate":
        if payload.job_id is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "job_id is required for candidate links")
        candidate = (
            db.query(Candidate)
            .filter(Candidate.job_id == payload.job_id, Candidate.email == payload.email)
            .first()
        )
    else:
        recruiter = db.query(Recruiter).filter(Recruiter.email == payload.email).first()

    # Generic response either way — don't reveal whether the account exists.
    resp = RequestLinkResponse(message="If that account exists, a sign-in link has been sent.")

    subject = candidate or recruiter
    if subject is not None:
        raw = secrets.token_urlsafe(32)
        token = MagicLinkToken(
            token_hash=_hash_token(raw),
            email=payload.email,
            role=payload.role,
            job_id=payload.job_id if payload.role == "candidate" else None,
            candidate_id=candidate.id if candidate else None,
            recruiter_id=recruiter.id if recruiter else None,
            expires_at=datetime.now(timezone.utc)
            + timedelta(seconds=settings.magic_link_ttl_seconds),
        )
        db.add(token)
        db.commit()

        link = f"{settings.frontend_base_url}/auth/callback?token={raw}"
        send_magic_link(payload.email, link)
        if settings.environment == "development":
            resp.dev_magic_link = link
            resp.dev_token = raw

    return resp


@router.post(
    "/verify",
    response_model=VerifiedSession,
    summary="Exchange a magic-link token for a session (FR-04)",
)
def verify_link(payload: VerifyRequest, db: Session = Depends(get_db)) -> VerifiedSession:
    token = (
        db.query(MagicLinkToken)
        .filter(MagicLinkToken.token_hash == _hash_token(payload.token))
        .first()
    )
    if token is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid sign-in link")
    if token.consumed_at is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This sign-in link has already been used")
    if token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This sign-in link has expired")

    # Single-use: consume before issuing the session (FR-04 step 5).
    token.consumed_at = datetime.now(timezone.utc)

    if token.role == "candidate":
        subject_id, job_id = token.candidate_id, token.job_id
    else:
        subject_id, job_id = token.recruiter_id, None

    access = create_session_token(subject_id, job_id, role=token.role)
    db.commit()

    return VerifiedSession(access_token=access, role=token.role, subject_id=subject_id, job_id=job_id)


@router.post("/dev-login", response_model=SessionResponse, summary="Dev login (stub for magic-link, FR-04)")
def dev_login(payload: DevLoginRequest, db: Session = Depends(get_db)) -> SessionResponse:
    job = db.get(Job, payload.job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

    candidate = (
        db.query(Candidate)
        .filter(Candidate.job_id == payload.job_id, Candidate.email == payload.email)
        .first()
    )
    if candidate is None:
        candidate = Candidate(
            job_id=payload.job_id,
            email=payload.email,
            name=payload.name,
            status="invited",
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)

    token = create_session_token(candidate.id, candidate.job_id)
    return SessionResponse(access_token=token, candidate_id=candidate.id, job_id=candidate.job_id)


@router.get("/me", response_model=SessionInfo, summary="Current session info")
def me(candidate: Candidate = Depends(get_current_candidate)) -> SessionInfo:
    return SessionInfo(
        candidate_id=candidate.id,
        job_id=candidate.job_id,
        role="candidate",
        email=candidate.email,
        status=candidate.status,
        consented=candidate.consent_at is not None,
    )
