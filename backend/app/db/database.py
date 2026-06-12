"""Database connection (Phase 1/2). Postgres via SQLAlchemy with SQLite fallback."""
from __future__ import annotations

import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

logger = logging.getLogger("venturegenesis.db")

Base = declarative_base()


def _sqlite_engine():
    return create_engine(
        settings.SQLITE_FALLBACK,
        connect_args={"check_same_thread": False},
        future=True,
    )


def _make_engine():
    url = settings.DATABASE_URL
    # If SQLite is configured outright, use it directly — no probe, no noise.
    if url.startswith("sqlite"):
        logger.info("Using SQLite (%s)", url)
        return _sqlite_engine()

    try:
        # Short connect timeout so startup fails fast when Postgres isn't running,
        # instead of hanging on the default ~socket timeout.
        engine = create_engine(
            url, pool_pre_ping=True, future=True,
            connect_args={"connect_timeout": 2},
        )
        with engine.connect():
            pass
        logger.info("Connected to Postgres")
        return engine
    except Exception as exc:  # pragma: no cover - infra dependent
        # SQLite fallback is a supported, intentional mode (e.g. local dev without
        # Docker), so this is informational — not an error.
        reason = str(exc).splitlines()[0][:120]
        logger.info("Postgres not reachable (%s); using SQLite at %s", reason, settings.SQLITE_FALLBACK)
        return _sqlite_engine()


engine = _make_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


def get_db():
    """FastAPI dependency yielding a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables. Import models so they register on Base.metadata."""
    from app.db import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
