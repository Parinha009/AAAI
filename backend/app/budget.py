"""Budget kill-switch & cost tracking (SRS-FR-16 / NFR-03).

Enforces the $10/month OpenAI ceiling in application code (the second, provider-side
hard cap must be set manually in the OpenAI dashboard — see the README).

The AI pipeline (FR-07/08/03) uses this in two places:
- `guard(db, ...)` BEFORE every OpenAI call — raises 429 if the ceiling is reached.
- `charge(db, usd, ...)` AFTER every OpenAI call — adds the estimated cost to the month.
"""

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.config import settings
from app.errors import api_error
from app.models import AuditLog, BudgetUsage

# Rough per-unit pricing used to estimate cost (USD).
GPT_INPUT_PER_1K_TOKENS = 0.00015   # gpt-4o-mini input  (~$0.15 / 1M)
GPT_OUTPUT_PER_1K_TOKENS = 0.00060  # gpt-4o-mini output (~$0.60 / 1M)
WHISPER_PER_MINUTE = 0.006          # whisper-1 (~$0.006 / minute)


def current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _row(db: Session) -> BudgetUsage:
    month = current_month()
    row = db.get(BudgetUsage, month)
    if row is None:
        row = BudgetUsage(month=month, estimated_spend_usd=Decimal("0"))
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def estimate_gpt_cost(input_tokens: int, output_tokens: int) -> float:
    return round(
        input_tokens / 1000 * GPT_INPUT_PER_1K_TOKENS
        + output_tokens / 1000 * GPT_OUTPUT_PER_1K_TOKENS,
        6,
    )


def estimate_whisper_cost(audio_seconds: float) -> float:
    return round(audio_seconds / 60 * WHISPER_PER_MINUTE, 6)


def status(db: Session) -> dict:
    """Current budget snapshot in the API-contract shape (FR-16 / endpoint #12)."""
    row = _row(db)
    spend = float(row.estimated_spend_usd)
    ceiling = float(settings.openai_monthly_budget_usd)
    return {
        "status": "paused" if spend >= ceiling else "ok",
        "month": row.month,
        "estimated_spend_usd": round(spend, 2),
        "ceiling_usd": round(ceiling, 2),
    }


def is_frozen(db: Session) -> bool:
    return float(_row(db).estimated_spend_usd) >= float(settings.openai_monthly_budget_usd)


def guard(db: Session, *, candidate_id: int | None = None, job_id: int | None = None) -> None:
    """Call BEFORE dispatching an OpenAI request (FR-16 step 2). Raises 429 if frozen."""
    if is_frozen(db):
        raise api_error(
            429,
            "BUDGET_EXCEEDED",
            "AI processing is paused for this billing cycle.",
            {"ceiling_usd": round(float(settings.openai_monthly_budget_usd), 2)},
        )


def charge(
    db: Session,
    usd: float,
    *,
    model: str,
    candidate_id: int | None = None,
    job_id: int | None = None,
) -> float:
    """Record estimated cost AFTER an OpenAI call (FR-16 step 1). Returns the new monthly total.

    Writes a BUDGET_FREEZE audit row the moment the ceiling is first crossed (needs
    candidate/job context for the audit FK).
    """
    row = _row(db)
    ceiling = float(settings.openai_monthly_budget_usd)
    was_frozen = float(row.estimated_spend_usd) >= ceiling

    row.estimated_spend_usd = row.estimated_spend_usd + Decimal(str(usd))
    db.commit()
    db.refresh(row)

    now_frozen = float(row.estimated_spend_usd) >= ceiling
    if now_frozen and not was_frozen and candidate_id and job_id:
        db.add(
            AuditLog(
                candidate_id=candidate_id,
                job_id=job_id,
                event_type="BUDGET_FREEZE",
                payload={
                    "month": row.month,
                    "estimated_spend_usd": float(row.estimated_spend_usd),
                    "ceiling_usd": ceiling,
                    "trigger_model": model,
                },
            )
        )
        db.commit()

    return float(row.estimated_spend_usd)
