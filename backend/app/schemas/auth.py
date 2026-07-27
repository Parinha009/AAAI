"""Auth / session contract.

`dev-login` is a STUB standing in for the real email magic-link (SRS-FR-04),
just enough to issue a candidate session so the interview flow can run.
"""

from uuid import UUID

from pydantic import BaseModel, Field


class DevLoginRequest(BaseModel):
    job_id: UUID = Field(..., description="Job the candidate is interviewing for")
    email: str = Field(..., description="Candidate email (identity for this stub)")
    name: str | None = Field(None, description="Optional display name")


class SessionResponse(BaseModel):
    access_token: str = Field(..., description="Signed session token — send as 'Authorization: Bearer <token>'")
    token_type: str = "bearer"
    candidate_id: UUID
    job_id: UUID
    role: str = "candidate"


class SessionInfo(BaseModel):
    candidate_id: UUID
    job_id: UUID
    role: str
    email: str
    status: str
    consented: bool


# --- Magic-link auth (SRS-FR-04) -----------------------------------------
class RequestLinkRequest(BaseModel):
    email: str = Field(..., description="Email on file (invited candidate or provisioned recruiter)")
    role: str = Field("candidate", description="'candidate' or 'recruiter'")
    job_id: UUID | None = Field(None, description="Required when role == 'candidate'")


class RequestLinkResponse(BaseModel):
    message: str
    # Populated in development only, so the flow is testable without real email.
    dev_magic_link: str | None = None
    dev_token: str | None = None


class VerifyRequest(BaseModel):
    token: str = Field(..., description="The raw token from the magic link")


class VerifiedSession(BaseModel):
    access_token: str = Field(..., description="Signed session token — send as 'Authorization: Bearer <token>'")
    token_type: str = "bearer"
    role: str
    subject_id: UUID = Field(..., description="candidate_id or recruiter_id")
    job_id: UUID | None = None


class RecruiterInfo(BaseModel):
    recruiter_id: UUID
    email: str
    name: str | None
