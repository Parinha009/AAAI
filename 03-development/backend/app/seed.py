"""Seed demo data so the interview flow can run. Idempotent.

    python -m app.seed

Prints the demo JOB_ID plus the candidate/recruiter emails to request links for.

The rubric and questions below are the Lead-authored values from
`01-requirements/scoring-rubric-and-questions.md` — that document is the
human-readable source, this file is the machine-readable copy. Per contract §10
these are tunable *values*, not frozen shapes: editing wording here is not a
contract change.
"""

from app.database import SessionLocal
from app.models import Candidate, Job, Recruiter

DEMO_TITLE = "Junior Backend Engineer"
# Title used by the pre-rubric seed; looked up so an existing row is upgraded in
# place rather than duplicated.
LEGACY_TITLES = ("Demo — Backend Engineer",)
DEMO_CANDIDATE_EMAIL = "candidate@demo.local"
DEMO_RECRUITER_EMAIL = "recruiter@demo.local"

# --- Base questions (FR-05) ----------------------------------------------
# Ordered 3–5 questions. `trait` is the trait each question mainly probes; it is
# a hint for the scorer and is stripped before serving, because the frozen
# `GET /interview/questions` object has exactly question_id / order / text.
DEMO_QUESTIONS = [
    {
        "question_id": 1,
        "order": 1,
        "text": (
            "Tell us about a backend project you've worked on. "
            "What part did you build, and what were you responsible for?"
        ),
        "trait": "job_fit",
    },
    {
        "question_id": 2,
        "order": 2,
        "text": (
            "Describe a bug that was hard to track down. "
            "How did you find the cause, and how did you know you'd actually fixed it?"
        ),
        "trait": "problem_solving",
    },
    {
        "question_id": 3,
        "order": 3,
        "text": (
            "How would you explain to a non-technical teammate what an API is and why it matters?"
        ),
        "trait": "communication",
    },
    {
        "question_id": 4,
        "order": 4,
        "text": (
            "When would you store data in a relational database like PostgreSQL rather than "
            "somewhere else — and what would make you choose differently?"
        ),
        "trait": "technical_skill",
    },
]

# --- Scoring rubric (FR-03) ----------------------------------------------
# Four traits, integer 1–5 each, aggregate = plain sum (4–20, contract §9.2).
# Written for a grader reading a spoken transcript, not a CV or a code sample.
DEMO_RUBRIC = {
    "version": 1,
    "role": DEMO_TITLE,
    "scale": {"min": 1, "max": 5},
    "aggregate": "sum",
    "traits": {
        "technical_skill": {
            "label": "Technical skill",
            "description": "Correct, specific backend knowledge.",
            "anchors": {
                "1": "No backend concepts named, or names them wrongly (e.g. calls a database a "
                     "server). Answers are entirely non-technical.",
                "2": "Uses correct terms (API, database, endpoint) but cannot say what they do. "
                     "Repeats the question's own vocabulary without adding anything.",
                "3": "Correctly explains common concepts (REST endpoint, table, query) and names "
                     "real tools they have used. Stays at textbook level — no depth beyond definitions.",
                "4": "Explains how something works and why it is built that way (e.g. why an index "
                     "speeds up a lookup, why input is validated server-side). Cites specific work they did.",
                "5": "Explains a trade-off with both sides (e.g. when a relational DB beats a document "
                     "store and when it does not) and mentions failure modes — errors, load, bad data.",
            },
        },
        "communication": {
            "label": "Communication",
            "description": "Clear, natural, human speech. Also carries the FR-10 robotic-language heuristic.",
            "anchors": {
                "1": "Cannot be followed. Fragments, long silences, or off-topic. Or: the transcript is "
                     "clearly read aloud or AI-generated — flat, essay-like, no self-corrections.",
                "2": "Understandable but disorganised — jumps around, trails off, heavy filler. Or: "
                     "noticeably templated ('Firstly… Secondly… In conclusion…') with no personal detail.",
                "3": "Gets the point across in a sensible order. Some rambling or vagueness, but a "
                     "listener follows it. Sounds like a real person talking.",
                "4": "Well-structured and easy to follow — situation, action, result. Natural spoken "
                     "rhythm. Adjusts the level of detail for the listener.",
                "5": "Genuinely engaging: concise, concrete, plain language for technical ideas, good "
                     "analogies. Clearly unscripted — natural pauses and self-corrections.",
            },
        },
        "problem_solving": {
            "label": "Problem solving",
            "description": "A method, not a lucky guess.",
            "anchors": {
                "1": "No approach described. Says it was fixed, or that they asked someone else, with "
                     "no reasoning of their own.",
                "2": "Trial and error only — 'I kept changing things until it worked.' No way to tell "
                     "what caused what.",
                "3": "Describes a recognisable process: reproduce it, read the error, add logging, "
                     "check the recent change. Linear but sound.",
                "4": "Narrows the problem deliberately — forms a guess, tests it, rules things out, "
                     "uses real tools (logs, debugger, git bisect). Explains how they confirmed the cause.",
                "5": "All of 4, plus reflection: what the root cause really was, what they changed so it "
                     "cannot recur, and what they would do differently. Handles the unknown out loud.",
            },
        },
        "job_fit": {
            "label": "Job fit",
            "description": "Suited to a junior backend role here.",
            "anchors": {
                "1": "No backend interest or experience evident; examples are unrelated to software.",
                "2": "Some coding background, but all examples are frontend or other, with nothing "
                     "showing server-side interest.",
                "3": "Real backend exposure — coursework, a personal project, an internship — and clear "
                     "motivation for the role. Appropriate for a junior.",
                "4": "Has actually built and shipped backend work (APIs, databases, deployment). Talks "
                     "about teamwork, code review, or requirements — signs they can work with others.",
                "5": "Strong junior fit: relevant hands-on work, visible drive to learn, and awareness of "
                     "engineering practice (testing, documentation, maintainability) beyond making it run.",
            },
        },
    },
    "grading_rules": [
        "Every trait gets an integer 1–5. No half points, no nulls.",
        "One sentence of rationale per trait, grounded in something the candidate actually said. "
        "Rationale that could apply to anybody is a grading failure.",
        "Robotic-language cap (FR-10): if the transcript reads as scripted, read aloud, or "
        "AI-generated, cap communication at 2 and name the trigger in rationale.communication.",
        "Missing evidence scores low, not blank: score 1 or 2 and say so in the rationale.",
        "Silent or empty answers (response.status = 'no_speech') contribute no evidence; they do "
        "not average out.",
        "If the model's JSON fails to parse, set manual_review_flag = true and route to human "
        "review. Never guess the numbers.",
    ],
    "flags": {"robotic_language_caps_communication_at": 2},
}


def main() -> None:
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.title.in_((DEMO_TITLE, *LEGACY_TITLES))).first()
        if job is None:
            job = Job(title=DEMO_TITLE, rubric_config=DEMO_RUBRIC, base_questions=DEMO_QUESTIONS)
            db.add(job)
            db.commit()
            db.refresh(job)
            print("Created demo job.")
        else:
            # Re-apply the Lead-authored rubric/questions so re-running the seed
            # upgrades an existing row instead of leaving stale placeholders.
            job.title = DEMO_TITLE
            job.rubric_config = DEMO_RUBRIC
            job.base_questions = DEMO_QUESTIONS
            db.commit()
            db.refresh(job)
            print("Demo job already exists — rubric and questions refreshed.")
        print(f"JOB_ID: {job.job_id}")
        print(f"JOB_TITLE: {job.title}")
        print(f"QUESTIONS: {len(job.base_questions)}  RUBRIC_TRAITS: {len(job.rubric_config['traits'])}")

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
