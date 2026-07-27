"""Session tokens and auth dependencies.

STUB auth for the vertical slice: a signed, time-boxed token (itsdangerous)
stands in for the real magic-link (SRS-FR-04). It is enough to enforce the
FR-01 acceptance criterion — routes are gated server-side, and bypass attempts
are rejected with 401/403.
"""

from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Candidate, Recruiter

_SALT = "aaai-session"
_serializer = URLSafeTimedSerializer(settings.secret_key, salt=_SALT)

# auto_error=False so we can return our own 401 with a clear message.
bearer_scheme = HTTPBearer(auto_error=False)


def create_session_token(subject_id: UUID, job_id: UUID | None = None, role: str = "candidate") -> str:
    """Signed, role-scoped session token. `job_id` is included for candidates only."""
    payload: dict = {"sub": str(subject_id), "role": role}
    if job_id is not None:
        payload["job_id"] = str(job_id)
    return _serializer.dumps(payload)


def _decode(token: str) -> dict:
    try:
        return _serializer.loads(token, max_age=settings.session_ttl_seconds)
    except SignatureExpired:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    except BadSignature:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session token")


def get_current_candidate(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Candidate:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    data = _decode(creds.credentials)
    if data.get("role") != "candidate":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Candidate session required")
    candidate = db.get(Candidate, UUID(data["sub"]))
    if candidate is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Candidate not found")
    return candidate


def get_current_recruiter(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Recruiter:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    data = _decode(creds.credentials)
    # Role-scoping (FR-04): a candidate token must never reach recruiter routes.
    if data.get("role") != "recruiter":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Recruiter session required")
    recruiter = db.get(Recruiter, UUID(data["sub"]))
    if recruiter is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Recruiter not found")
    return recruiter


def require_consent(candidate: Candidate = Depends(get_current_candidate)) -> Candidate:
    """Gate: enforces FR-01 — no interview content until consent is persisted."""
    if candidate.consent_at is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Consent required before accessing interview questions (SRS-FR-01)",
        )
    return candidate
