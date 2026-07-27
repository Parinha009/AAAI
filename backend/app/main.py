"""FastAPI application entrypoint.

Only health endpoints for now — feature routers land in later slices. The DB
health check confirms the engine can reach Postgres.
"""

from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.routers import auth, interview, recruiter, responses

app = FastAPI(title=settings.app_name)

app.include_router(auth.router)
app.include_router(interview.router)
app.include_router(responses.router)
app.include_router(recruiter.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "app": settings.app_name, "environment": settings.environment}


@app.get("/health/db")
def health_db(db: Session = Depends(get_db)) -> dict:
    db.execute(text("SELECT 1"))
    return {"database": "ok"}
