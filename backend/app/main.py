"""FastAPI application entrypoint.

All routes are mounted under /api/v1 per API Contract v1. A standard error
envelope wraps every non-2xx response.
"""

from datetime import datetime, timezone

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.errors import register_error_handlers
from app.routers import auth, interview, recruiter, system

API_PREFIX = "/api/v1"

app = FastAPI(title=settings.app_name)

# Allow the React dev server (Vite) to call the API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(interview.router, prefix=API_PREFIX)
app.include_router(system.router, prefix=API_PREFIX)
app.include_router(recruiter.router, prefix=API_PREFIX)


@app.get(f"{API_PREFIX}/health", tags=["system"])
def health() -> dict:
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}


@app.get(f"{API_PREFIX}/health/db", tags=["system"])
def health_db(db: Session = Depends(get_db)) -> dict:
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}
