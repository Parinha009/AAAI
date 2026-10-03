"""Issue magic-link sign-in tokens (SRS-FR-04).

Shared by self sign-in (`POST /auth/magic-link`) and recruiter invites
(`POST /jobs/{job_id}/invite`). Only a SHA-256 hash of the token is stored;
email delivery failures are logged and never break the request.
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.email import send_magic_link
from app.models import MagicLinkToken

logger = logging.getLogger("aaai.magic_links")


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def issue_magic_link(db: Session, *, email: str, role: str, job_id: int | None = None) -> tuple[str, str]:
    """Create a single-use, time-boxed token, email the sign-in link, and return
    (raw_token, link). The raw token is only returned for dev-mode helpers."""
    raw = secrets.token_urlsafe(32)
    db.add(
        MagicLinkToken(
            token_hash=hash_token(raw),
            email=email,
            role=role,
            job_id=job_id,
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=settings.magic_link_ttl_seconds),
        )
    )
    db.commit()

    link = f"{settings.frontend_base_url}/auth/callback?token={raw}"
    try:
        send_magic_link(email, link)
    except Exception:
        logger.exception("Failed to send magic-link email to %s", email)
    return raw, link
