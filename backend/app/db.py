"""Async SQLAlchemy engine + session (optional Postgres/PostGIS persistence).

The demo defaults to in-memory storage (``store.py``) so it runs anywhere with
zero setup. When ``settings.database_enabled`` is true and Postgres is
reachable, the ORM-backed store is used instead. Any DB failure degrades back
to the in-memory store — CI stays green with no database.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

_engine = None
_session_factory: Optional[async_sessionmaker] = None

# Runtime health of the database. ``None`` = never probed (default until the
# lifespan probe runs); ``False`` = enabled but unreachable → all stores fall
# back to the in-memory implementation so the app still starts.
_health_checked: bool = False
_db_available: bool = True


def _get_engine():
    global _engine, _session_factory
    if _engine is None:
        _engine = create_async_engine(settings.database_url, pool_pre_ping=True)
        _session_factory = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)
    return _engine


def database_enabled() -> bool:
    return bool(getattr(settings, "database_enabled", False))


def set_db_available(value: bool) -> None:
    global _health_checked, _db_available
    _health_checked = True
    _db_available = value


def database_available() -> bool:
    """True when the DB is enabled AND known to be reachable."""
    if _health_checked and not _db_available:
        return False
    return database_enabled()


async def probe() -> bool:
    """Round-trip the database connection. Returns False when unreachable."""
    try:
        async with get_session() as s:
            await s.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def get_session() -> AsyncSession:
    """Open a session; raises RuntimeError when the database is unavailable."""
    if not database_available():
        raise RuntimeError("database disabled/unreachable; rely on in-memory store")
    return _get_engine() and _session_factory()  # type: ignore[return-value]


def engine():
    return _engine