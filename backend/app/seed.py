"""Seed demo data so the interview flow can run. Idempotent.

    python -m app.seed

Prints the demo JOB_ID plus the candidate/recruiter emails to request links for.
"""

from datetime import datetime, timezone

from app.config import settings
from app.database import SessionLocal
from app.models import AuditLog, Candidate, Job, Recruiter, Response, Score

DEMO_TITLE = "Demo — Backend Engineer"
DEMO_CANDIDATE_EMAIL = "candidate@demo.local"
DEMO_RECRUITER_EMAIL = "recruiter@demo.local"

DEMO_QUESTIONS = [
    "Tell us about a backend project you built and what you were responsible for.",
    "How do you decide between a relational database and a document store?",
    "Walk us through how you would design a REST endpoint that accepts a file upload.",
    "Describe a bug you debugged recently and how you found the root cause.",
]

DEMO_RUBRIC = {
    "traits": ["technical_skill", "communication", "problem_solving", "job_fit"],
    "scale": {"min": 1, "max": 5},
    "notes": "Placeholder rubric — Lead authors final anchors in Week 4.",
}


def main() -> None:
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.title == DEMO_TITLE).first()
        if job is None:
            job = Job(title=DEMO_TITLE, rubric_config=DEMO_RUBRIC, base_questions=DEMO_QUESTIONS)
            db.add(job)
            db.commit()
            db.refresh(job)
            print("Created demo job.")
        else:
            print("Demo job already exists.")
        print(f"JOB_ID: {job.job_id}")

        candidate = (
            db.query(Candidate)
            .filter(Candidate.email == DEMO_CANDIDATE_EMAIL, Candidate.job_id == job.job_id)
            .first()
        )
        if candidate is None:
            candidate = Candidate(
                job_id=job.job_id, email=DEMO_CANDIDATE_EMAIL, name="Demo Candidate", status="invited"
            )
            db.add(candidate)
            db.commit()
            db.refresh(candidate)
            print("Created demo candidate.")
        else:
            print("Demo candidate already exists.")
        print(f"CANDIDATE_EMAIL: {candidate.email}")

        recruiter = db.query(Recruiter).filter(Recruiter.email == DEMO_RECRUITER_EMAIL).first()
        if recruiter is None:
            recruiter = Recruiter(email=DEMO_RECRUITER_EMAIL, name="Demo Recruiter")
            db.add(recruiter)
            db.commit()
            db.refresh(recruiter)
            print("Created demo recruiter.")
        else:
            print("Demo recruiter already exists.")
        print(f"RECRUITER_EMAIL: {recruiter.email}")

        _seed_real_inbox(db, job)
        _seed_scored_candidates(db, job)
    finally:
        db.close()


def _seed_real_inbox(db, job) -> None:
    """If SEED_REAL_EMAIL is set in .env, provision it so magic links reach a real
    inbox: the address itself as a recruiter, and its "+candidate" alias as a
    candidate (Gmail delivers +aliases to the same inbox)."""
    email = settings.seed_real_email.strip().lower()
    if not email or "@" not in email:
        return
    local, domain = email.split("@", 1)
    cand_email = f"{local}+candidate@{domain}"

    if db.query(Recruiter).filter(Recruiter.email == email).first() is None:
        db.add(Recruiter(email=email, name="Recruiter (real inbox)"))
    if db.query(Candidate).filter(Candidate.email == cand_email, Candidate.job_id == job.job_id).first() is None:
        db.add(Candidate(job_id=job.job_id, email=cand_email, name="Candidate (real inbox)", status="invited"))
    db.commit()
    print(f"REAL_RECRUITER_EMAIL: {email}")
    print(f"REAL_CANDIDATE_EMAIL: {cand_email}")


def _seed_scored_candidates(db, job) -> None:
    """Two demo candidates with scores so the recruiter leaderboard has data.
    (Stands in until the real AI scoring pipeline exists.)"""
    demos = [
        {
            "email": "dara@demo.local", "name": "Dara Chen",
            "scores": (4, 5, 4, 4), "review": False, "tab_outs": 0,
            "rationale": {
                "technical_skill": "Explained a load-dependent race condition clearly.",
                "communication": "Natural, specific phrasing.",
                "problem_solving": "Isolated the fault methodically.",
                "job_fit": "Relevant backend experience.",
            },
        },
        {
            "email": "pisey@demo.local", "name": "Sok Pisey",
            "scores": (3, 2, 3, 3), "review": False, "tab_outs": 4,
            "rationale": {
                "technical_skill": "Some gaps in depth.",
                "communication": "Templated, textbook phrasing detected.",
                "problem_solving": "Adequate.",
                "job_fit": "Partial match.",
            },
        },
    ]
    now = datetime.now(timezone.utc)
    for d in demos:
        if db.query(Candidate).filter(Candidate.email == d["email"], Candidate.job_id == job.job_id).first():
            continue
        cand = Candidate(job_id=job.job_id, email=d["email"], name=d["name"],
                         status="completed", consent_at=now, consent_version="v1")
        db.add(cand)
        db.commit()
        db.refresh(cand)

        for i, q in enumerate((job.base_questions or [])[:2], start=1):
            db.add(Response(candidate_id=cand.candidate_id, job_id=job.job_id, question_id=i,
                            type="base", status="transcribed",
                            transcript=f"[demo] answer to question {i}."))
        ts, comm, ps, jf = d["scores"]
        db.add(Score(candidate_id=cand.candidate_id, job_id=job.job_id,
                     technical_skill=ts, communication=comm, problem_solving=ps, job_fit=jf,
                     rationale=d["rationale"], manual_review_flag=d["review"]))
        for _ in range(d["tab_outs"]):
            db.add(AuditLog(candidate_id=cand.candidate_id, job_id=job.job_id,
                            event_type="TAB_OUT", payload={"seed": True}))
        db.commit()
        print(f"Created scored demo candidate: {d['name']}")


if __name__ == "__main__":
    main()
