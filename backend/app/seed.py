"""Seed a demo Job so the interview flow has questions to fetch.

Idempotent — run as many times as you like:

    python -m app.seed

Prints the demo Job's id, which the frontend (or /docs) uses to dev-login.
"""

from app.database import SessionLocal
from app.models import Job, Recruiter

DEMO_TITLE = "Demo — Backend Engineer"
DEMO_RECRUITER_EMAIL = "recruiter@demo.local"

DEMO_QUESTIONS = [
    "Tell us about a backend project you built and what you were responsible for.",
    "How do you decide between a relational database and a document store?",
    "Walk us through how you would design a REST endpoint that accepts a file upload.",
    "Describe a bug you debugged recently and how you found the root cause.",
]

RUBRIC_PROMPT = (
    "Score the candidate 1-5 on Technical Skill, Communication, Problem Solving, and "
    "Job Fit for a junior backend engineer role. Return strict JSON."
)
FOLLOW_UP_PROMPT = (
    "Ask exactly one specific, technical follow-up question grounded in the candidate's "
    "base answers. Plain text only."
)


def main() -> None:
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.title == DEMO_TITLE).first()
        if job is None:
            job = Job(
                title=DEMO_TITLE,
                description="Auto-seeded demo job for local development.",
                base_questions=DEMO_QUESTIONS,
                rubric_prompt=RUBRIC_PROMPT,
                follow_up_prompt=FOLLOW_UP_PROMPT,
            )
            db.add(job)
            db.commit()
            db.refresh(job)
            print("Created demo job.")
        else:
            print("Demo job already exists.")
        print(f"JOB_ID: {job.id}")

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
