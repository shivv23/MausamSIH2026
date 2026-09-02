"""Async SQLAlchemy engine + session (optional Postgres/PostGIS persistence).

The demo defaults to in-memory storage (``store.py``) so it runs anywhere with
zero setup. When ``settings.database_enabled`` is true and Postgres is
reachable, the ORM-backed store is used instead. Any DB failure degrades back
to the in-memory store — CI stays green with no database.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

_engine = None
_session_factory: Optional[async_sessionmaker] = None


def _get_engine():
    global _engine, _session_factory
    if _engine is None:
        _engine = create_async_engine(settings.database_url, pool_pre_ping=True)
        _session_factory = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)
    return _engine


def database_enabled() -> bool:
    return bool(getattr(settings, "database_enabled", False))


async def get_session() -> AsyncSession:
    """Open a session; raises RuntimeError when the database is not enabled."""
    if not database_enabled():
        raise RuntimeError("database disabled; rely on in-memory store")
    return _get_engine() and _session_factory()  # type: ignore[return-value]


def engine():
    return _engine