"""Session tokens and auth dependencies (API Contract v1 §0, §3.2).

A signed, time-boxed session token (itsdangerous) is issued by /auth/verify and
sent as `Authorization: Bearer <token>`. Tokens are role-scoped: a candidate token
is rejected from recruiter routes and vice versa (FR-04).
"""

from datetime import datetime, timedelta, timezone

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.errors import api_error
from app.models import Candidate, Recruiter

_SALT = "aaai-session"
_serializer = URLSafeTimedSerializer(settings.secret_key, salt=_SALT)

bearer_scheme = HTTPBearer(auto_error=False)


def create_session_token(*, role: str, subject_id: int, job_id: int | None = None) -> str:
    payload: dict = {"role": role, "sub": subject_id}
    if job_id is not None:
        payload["job_id"] = job_id
    return _serializer.dumps(payload)


def session_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=settings.session_ttl_seconds)


def _decode(token: str) -> dict:
    try:
        return _serializer.loads(token, max_age=settings.session_ttl_seconds)
    except SignatureExpired:
        raise api_error(401, "UNAUTHORIZED", "Session expired")
    except BadSignature:
        raise api_error(401, "UNAUTHORIZED", "Invalid session token")


def _payload(creds: HTTPAuthorizationCredentials | None) -> dict:
    if creds is None:
        raise api_error(401, "UNAUTHORIZED", "Not authenticated")
    return _decode(creds.credentials)


def get_session(creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> dict:
    """Decoded session payload for role-agnostic routes (e.g. /auth/me)."""
    return _payload(creds)


def get_current_candidate(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Candidate:
    data = _payload(creds)
    if data.get("role") != "candidate":
        raise api_error(403, "FORBIDDEN", "Candidate session required")
    candidate = db.get(Candidate, int(data["sub"]))
    if candidate is None:
        raise api_error(401, "UNAUTHORIZED", "Candidate not found")
    return candidate


def get_current_recruiter(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Recruiter:
    data = _payload(creds)
    if data.get("role") != "recruiter":
        raise api_error(403, "FORBIDDEN", "Recruiter session required")
    recruiter = db.get(Recruiter, int(data["sub"]))
    if recruiter is None:
        raise api_error(401, "UNAUTHORIZED", "Recruiter not found")
    return recruiter


def require_consent(candidate: Candidate = Depends(get_current_candidate)) -> Candidate:
    """Gate: enforces FR-01 — no interview content until consent is persisted."""
    if candidate.consent_at is None:
        raise api_error(403, "CONSENT_REQUIRED", "Consent must be recorded before this action")
    return candidate
