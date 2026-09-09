"""BudgetUsage — running estimated OpenAI spend per billing month (FR-16 / NFR-03)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class BudgetUsage(Base):
    __tablename__ = "budget_usage"

    month: Mapped[str] = mapped_column(String(7), primary_key=True)  # 'YYYY-MM'
    estimated_spend_usd: Mapped[Decimal] = mapped_column(
        Numeric(10, 4), nullable=False, server_default="0"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
