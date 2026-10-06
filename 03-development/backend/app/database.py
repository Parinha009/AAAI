"""SQLAlchemy engine and session factory.

The engine reads its URL from settings (env-driven). `get_db` is the FastAPI
dependency that yields a request-scoped session and always closes it.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

# connect_timeout: without it, an unreachable database makes every request hang
# indefinitely with no error, which is indistinguishable from an application bug.
# Failing fast turns "the API is mysteriously stuck" into a clear, logged error.
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    future=True,
    connect_args={"connect_timeout": 5},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
