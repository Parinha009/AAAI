"""Per-interview question draw (FR-05).

Each job stores a *bank* of questions in `jobs.base_questions`. Every interview gets
its own random set (5 questions) from that bank, so two candidates - or the same person
interviewing again - don't get the same questions:

- one question per trait first (technical_skill, communication, problem_solving,
  job_fit), so every scorecard trait has evidence, then random fill;
- questions this email already answered in an earlier interview for the job are
  avoided when the bank is big enough;
- the draw is random in order too, and is saved on the candidate
  (`candidates.assigned_questions`) so a refresh or resume shows the same set.

The API shape is unchanged: GET /interview/questions still returns question_id /
order / text, where question_id is the question's stable id in the bank.
"""

import random

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Candidate, Job, Response

DEFAULT_PER_INTERVIEW = 5
MIN_PER_INTERVIEW, MAX_PER_INTERVIEW = 3, 5  # SRS FR-05: 3-5 base questions

_rng = random.SystemRandom()


def question_bank(job: Job | None) -> list[dict]:
    """The job's questions as {question_id, text, trait}. Accepts plain strings (early
    seed) or Lead-authored objects."""
    bank = []
    for i, q in enumerate((job.base_questions or []) if job else []):
        if isinstance(q, dict):
            bank.append({"question_id": q.get("question_id", i + 1), "text": q.get("text", ""), "trait": q.get("trait")})
        else:
            bank.append({"question_id": i + 1, "text": str(q), "trait": None})
    return bank


def per_interview(job: Job) -> int:
    n = (job.rubric_config or {}).get("questions_per_interview", DEFAULT_PER_INTERVIEW)
    if not isinstance(n, int):
        n = DEFAULT_PER_INTERVIEW
    return max(MIN_PER_INTERVIEW, min(MAX_PER_INTERVIEW, n))


def _previously_asked(db: Session, candidate: Candidate) -> set[int]:
    """Question ids this email was asked in its earlier interviews for the same job."""
    earlier = db.execute(
        select(Candidate.assigned_questions).where(
            Candidate.job_id == candidate.job_id,
            Candidate.email == candidate.email,
            Candidate.candidate_id != candidate.candidate_id,
        )
    ).scalars().all()
    asked = {qid for ids in earlier for qid in (ids or [])}
    answered = db.execute(
        select(Response.question_id)
        .join(Candidate, Candidate.candidate_id == Response.candidate_id)
        .where(
            Candidate.job_id == candidate.job_id,
            Candidate.email == candidate.email,
            Candidate.candidate_id != candidate.candidate_id,
            Response.type == "base",
        )
    ).scalars().all()
    return asked | set(answered)


def draw(bank: list[dict], n: int, avoid: set[int] = frozenset(), rng=_rng) -> list[dict]:
    """Pick n questions: one per trait first, then random fill; prefer ones not in `avoid`."""
    fresh = [q for q in bank if q["question_id"] not in avoid]
    pool = fresh if len(fresh) >= n else bank
    n = min(n, len(pool))

    by_trait: dict = {}
    for q in pool:
        by_trait.setdefault(q["trait"], []).append(q)
    traits = [t for t in by_trait if t is not None]
    rng.shuffle(traits)

    picks = []
    for trait in traits:
        if len(picks) < n:
            picks.append(rng.choice(by_trait[trait]))
    rest = [q for q in pool if q not in picks]
    rng.shuffle(rest)
    picks += rest[: n - len(picks)]
    rng.shuffle(picks)  # random order too
    return picks


def assigned_questions(db: Session, candidate: Candidate) -> list[dict]:
    """This interview's questions, drawing (and saving) them on first use."""
    job = db.get(Job, candidate.job_id)
    bank = question_bank(job)
    by_id = {q["question_id"]: q for q in bank}

    if candidate.assigned_questions:
        kept = [by_id[qid] for qid in candidate.assigned_questions if qid in by_id]
        if kept:
            return kept

    picks = draw(bank, per_interview(job), _previously_asked(db, candidate)) if bank else []
    candidate.assigned_questions = [q["question_id"] for q in picks]
    db.commit()
    return picks
