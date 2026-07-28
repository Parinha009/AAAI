"""Auth contract shapes (API Contract v1 §3.2)."""

from datetime import datetime

from pydantic import BaseModel, Field


class MagicLinkRequest(BaseModel):
    email: str = Field(..., description="Email to send the sign-in link to")


class MagicLinkResponse(BaseModel):
    status: str = "sent"
    message: str = "If that email is registered, a sign-in link is on its way."
    # Development-only helpers so the flow is testable without real email.
    dev_magic_link: str | None = None
    dev_token: str | None = None


class VerifyRequest(BaseModel):
    token: str


class SessionContext(BaseModel):
    candidate_id: int | None = None
    job_id: int | None = None


class VerifyResponse(BaseModel):
    session_token: str
    role: str
    expires_at: datetime
    context: SessionContext


class MeResponse(BaseModel):
    role: str
    candidate_id: int | None = None
    job_id: int | None = None
    candidate_status: str | None = None
