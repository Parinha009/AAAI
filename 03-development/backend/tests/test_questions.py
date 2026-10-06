"""Per-interview random question draw (FR-05): a bank per job, a different set per
interview, one question per trait, saved so a refresh shows the same questions."""

import random
import uuid

from app import questions
from app.database import SessionLocal
from app.models import Candidate, Job
from tests.conftest import API, consent

TRAITS = ("technical_skill", "communication", "problem_solving", "job_fit")


def _bank(n_per_trait=3):
    return [
        {"question_id": i * 10 + k, "text": f"{t} question {k}", "trait": t}
        for i, t in enumerate(TRAITS, 1) for k in range(1, n_per_trait + 1)
    ]


def test_draw_is_balanced_and_random():
    bank = _bank()
    seen_sets = set()
    for seed in range(40):
        picks = questions.draw(bank, 5, rng=random.Random(seed))
        assert len(picks) == 5
        assert {q["trait"] for q in picks} == set(TRAITS)  # every trait covered
        seen_sets.add(tuple(sorted(q["question_id"] for q in picks)))
    assert len(seen_sets) > 10  # interviews really do differ


def test_draw_avoids_previous_questions_when_possible():
    bank = _bank()
    first = questions.draw(bank, 5, rng=random.Random(1))
    avoid = {q["question_id"] for q in first}
    second = questions.draw(bank, 5, avoid, rng=random.Random(2))
    assert not avoid & {q["question_id"] for q in second}
    # a bank too small to avoid repeats still gives a full set
    small = _bank(n_per_trait=1)
    assert len(questions.draw(small, 4, {q["question_id"] for q in small})) == 4


def _job_with_bank():
    db = SessionLocal()
    try:
        job = Job(title=f"Bank job {uuid.uuid4().hex[:6]}", rubric_config={"questions_per_interview": 5},
                  base_questions=_bank())
        db.add(job)
        db.commit()
        db.refresh(job)
        return job.job_id
    finally:
        db.close()


def _candidate(job_id, email):
    db = SessionLocal()
    try:
        c = Candidate(job_id=job_id, email=email, name="Bank", status="invited")
        db.add(c)
        db.commit()
        db.refresh(c)
        return c.candidate_id
    finally:
        db.close()


def test_interview_gets_saved_random_draw(client, login):
    job_id = _job_with_bank()
    email = f"bank-{uuid.uuid4().hex[:8]}@test.local"
    _candidate(job_id, email)
    h = {"Authorization": f"Bearer {login(email)}"}
    consent(client, h)

    first = client.get(f"{API}/interview/questions", headers=h).json()["questions"]
    assert len(first) == 5
    assert client.get(f"{API}/interview/questions", headers=h).json()["questions"] == first  # stable on refresh

    traits = {q["question_id"] // 10 for q in first}
    assert traits == {1, 2, 3, 4}  # one per trait

    # uploading an answer for a question this interview was not asked is rejected
    not_asked = next(q["question_id"] for q in _bank() if q["question_id"] not in {x["question_id"] for x in first})
    r = client.post(f"{API}/interview/responses", headers=h,
                    files={"audio": ("a.webm", b"\0" * 2048, "audio/webm")},
                    data={"question_id": str(not_asked), "type": "base"})
    assert r.status_code == 422


def test_reinterview_gets_new_questions(client, login):
    job_id = _job_with_bank()
    email = f"again-{uuid.uuid4().hex[:8]}@test.local"
    first_id = _candidate(job_id, email)
    h = {"Authorization": f"Bearer {login(email)}"}
    consent(client, h)
    first = {q["question_id"] for q in client.get(f"{API}/interview/questions", headers=h).json()["questions"]}

    db = SessionLocal()
    try:
        db.get(Candidate, first_id).status = "completed"
        db.commit()
    finally:
        db.close()
    _candidate(job_id, email)  # the re-invite's new interview

    h2 = {"Authorization": f"Bearer {login(email)}"}
    consent(client, h2)
    second = {q["question_id"] for q in client.get(f"{API}/interview/questions", headers=h2).json()["questions"]}
    assert len(second) == 5 and not first & second  # no repeats for the same person
