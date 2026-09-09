"""Shared pytest fixtures. Tests run against the live dev Postgres (Docker must be up)
via FastAPI's in-process TestClient. Each candidate uses a unique email so tests
don't collide.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Candidate, Job, Recruiter, Score

API = "/api/v1"


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def job_id():
    db = SessionLocal()
    try:
        job = db.query(Job).first()
        if job is None:
            job = Job(title="Test Job", base_questions=["Q1?", "Q2?", "Q3?"], rubric_config={})
            db.add(job)
            db.commit()
            db.refresh(job)
        return job.job_id
    finally:
        db.close()


@pytest.fixture(scope="session")
def recruiter_email():
    db = SessionLocal()
    try:
        email = "recruiter@demo.local"
        if db.query(Recruiter).filter(Recruiter.email == email).first() is None:
            db.add(Recruiter(email=email, name="Demo Recruiter"))
            db.commit()
        return email
    finally:
        db.close()


@pytest.fixture
def new_candidate(job_id):
    """A fresh, un-consented invited candidate with a unique email."""
    db = SessionLocal()
    try:
        email = f"cand-{uuid.uuid4().hex[:10]}@test.local"
        c = Candidate(job_id=job_id, email=email, name="Test", status="invited")
        db.add(c)
        db.commit()
        db.refresh(c)
        return {"email": email, "candidate_id": c.candidate_id, "job_id": job_id}
    finally:
        db.close()


@pytest.fixture
def scored_candidate(job_id):
    """A completed candidate with a perfect (20) scorecard, for leaderboard tests."""
    db = SessionLocal()
    try:
        email = f"scored-{uuid.uuid4().hex[:10]}@test.local"
        c = Candidate(job_id=job_id, email=email, name="Scored Test", status="completed")
        db.add(c)
        db.commit()
        db.refresh(c)
        db.add(
            Score(
                candidate_id=c.candidate_id, job_id=job_id,
                technical_skill=5, communication=5, problem_solving=5, job_fit=5,
                manual_review_flag=False, rationale={},
            )
        )
        db.commit()
        return {"email": email, "candidate_id": c.candidate_id, "job_id": job_id}
    finally:
        db.close()


@pytest.fixture
def login(client):
    """Return a helper that logs in by email and returns a session token."""

    def _login(email):
        r = client.post(f"{API}/auth/magic-link", json={"email": email})
        token = r.json().get("dev_token")
        assert token, f"no dev_token issued for {email}"
        r = client.post(f"{API}/auth/verify", json={"token": token})
        assert r.status_code == 200, r.text
        return r.json()["session_token"]

    return _login


@pytest.fixture
def candidate_headers(login, new_candidate):
    return {"Authorization": f"Bearer {login(new_candidate['email'])}"}


@pytest.fixture
def recruiter_headers(login, recruiter_email):
    return {"Authorization": f"Bearer {login(recruiter_email)}"}


def consent(client, headers):
    return client.post(
        f"{API}/interview/consent", headers=headers, json={"consent_version": "v1", "agreed": True}
    )
