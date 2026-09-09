"""System routes (API Contract v1 §3.1) — budget status (FR-16)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import budget
from app.database import get_db
from app.rbac import require_permission
from app.roles import Permission
from app.schemas.system import BudgetStatus

router = APIRouter(prefix="/system", tags=["system"])


@router.get(
    "/budget-status",
    response_model=BudgetStatus,
    summary="AI budget status — is the $10 cap tripped? (FR-16)",
    dependencies=[Depends(require_permission(Permission.VIEW_BUDGET))],
)
def budget_status(db: Session = Depends(get_db)) -> BudgetStatus:
    return BudgetStatus(**budget.status(db))
