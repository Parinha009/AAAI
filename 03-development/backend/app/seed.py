"""Seed demo data so the interview flow can run. Idempotent.

    python -m app.seed

Prints the demo JOB_ID plus the candidate/recruiter emails to request links for.
"""

from app.database import SessionLocal
from app.models import Candidate, Job, Recruiter

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
    finally:
        db.close()


if __name__ == "__main__":
    main()
