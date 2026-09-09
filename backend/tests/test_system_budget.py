"""RBAC on budget-status + the budget kill-switch guard (FR-16, RBAC)."""

from fastapi import HTTPException
from sqlalchemy import delete

from app import budget
from app.database import SessionLocal
from app.models import BudgetUsage

API = "/api/v1"


def test_budget_status_requires_recruiter(client, candidate_headers, recruiter_headers):
    # unauthenticated
    assert client.get(f"{API}/system/budget-status").status_code == 401
    # candidate lacks view_budget permission
    assert client.get(f"{API}/system/budget-status", headers=candidate_headers).status_code == 403
    # recruiter allowed
    r = client.get(f"{API}/system/budget-status", headers=recruiter_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] in ("ok", "paused")
    assert body["ceiling_usd"] == 10.0


def test_budget_guard_blocks_over_ceiling(monkeypatch, new_candidate):
    # isolate on a fake month so we don't touch the real counter
    monkeypatch.setattr(budget, "current_month", lambda: "1900-01")
    db = SessionLocal()
    try:
        db.execute(delete(BudgetUsage).where(BudgetUsage.month == "1900-01"))
        db.commit()

        assert budget.is_frozen(db) is False
        budget.guard(db)  # under ceiling -> no raise

        budget.charge(db, 10.5, model="test",
                      candidate_id=new_candidate["candidate_id"], job_id=new_candidate["job_id"])
        assert budget.is_frozen(db) is True

        raised = None
        try:
            budget.guard(db)
        except HTTPException as e:
            raised = e.status_code
        assert raised == 429  # blocked once frozen
    finally:
        db.execute(delete(BudgetUsage).where(BudgetUsage.month == "1900-01"))
        db.commit()
        db.close()


def test_cost_estimators():
    assert budget.estimate_whisper_cost(60) == 0.006
    assert budget.estimate_gpt_cost(1000, 1000) == round(0.00015 + 0.00060, 6)
