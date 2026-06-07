"""Database connection (Phase 1/2). Postgres via SQLAlchemy with SQLite fallback."""
from __future__ import annotations

import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

logger = logging.getLogger("venturegenesis.db")

Base = declarative_base()


def _make_engine():
    try:
        engine = create_engine(
            settings.DATABASE_URL, pool_pre_ping=True, future=True
        )
        # Probe the connection so we can fall back gracefully if Postgres is down.
        with engine.connect():
            pass
        logger.info("Connected to Postgres")
        return engine
    except Exception as exc:  # pragma: no cover - infra dependent
        logger.warning("Postgres unavailable (%s); falling back to SQLite", exc)
        return create_engine(
            settings.SQLITE_FALLBACK,
            connect_args={"check_same_thread": False},
            future=True,
        )


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
