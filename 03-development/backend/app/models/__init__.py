"""Model registry — importing this package registers every table on Base.metadata."""

from app.models.audit_log import AuditLog
from app.models.base import Base
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.magic_link import MagicLinkToken
from app.models.recruiter import Recruiter
from app.models.response import Response
from app.models.score import Score

__all__ = [
    "Base",
    "Job",
    "Candidate",
    "Response",
    "Score",
    "AuditLog",
    "Recruiter",
    "MagicLinkToken",
]
