"""Recruiter routes. Currently just `/me` — enough to prove role-scoping:
a candidate session cannot reach this endpoint (403). The dashboard (FR-14) lands
in a later slice.
"""

from fastapi import APIRouter, Depends

from app.models import Recruiter
from app.schemas.auth import RecruiterInfo
from app.security import get_current_recruiter

router = APIRouter(prefix="/api/recruiter", tags=["recruiter"])


@router.get("/me", response_model=RecruiterInfo, summary="Current recruiter session info")
def me(recruiter: Recruiter = Depends(get_current_recruiter)) -> RecruiterInfo:
    return RecruiterInfo(recruiter_id=recruiter.id, email=recruiter.email, name=recruiter.name)
