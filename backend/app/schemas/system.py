"""System contract shapes (API Contract v1 §3.1)."""

from pydantic import BaseModel, Field


class BudgetStatus(BaseModel):
    status: str = Field(..., description="'ok' or 'paused'")
    month: str = Field(..., description="Billing month, YYYY-MM")
    estimated_spend_usd: float
    ceiling_usd: float
