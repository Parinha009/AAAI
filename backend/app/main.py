"""FastAPI application entrypoint.

All routes are mounted under /api/v1 per API Contract v1. A standard error
envelope wraps every non-2xx response.
"""

from datetime import datetime, timezone

from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.errors import register_error_handlers
from app.routers import auth, interview

API_PREFIX = "/api/v1"

app = FastAPI(title=settings.app_name)

register_error_handlers(app)

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(interview.router, prefix=API_PREFIX)


@app.get(f"{API_PREFIX}/health", tags=["system"])
def health() -> dict:
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}


@app.get(f"{API_PREFIX}/health/db", tags=["system"])
def health_db(db: Session = Depends(get_db)) -> dict:
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}
