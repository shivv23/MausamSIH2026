"""Async SQLAlchemy engine + session (optional Postgres/PostGIS persistence).

The demo defaults to in-memory storage (``store.py``) so it runs anywhere with
zero setup. When ``settings.database_enabled`` is true and Postgres is
reachable, the ORM-backed store is used instead. Any DB failure degrades back
to the in-memory store — CI stays green with no database.
"""
from __future__ import annotations

from typing import Optional

import logging
import re
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings

logger = logging.getLogger("mausam")

_engine = None
_session_factory: Optional[async_sessionmaker] = None

# Runtime health of the database. ``None`` = never probed (default until the
# lifespan probe runs); ``False`` = enabled but unreachable → all stores fall
# back to the in-memory implementation so the app still starts.
_health_checked: bool = False
_db_available: bool = True


def async_database_url(url: str) -> str:
    """Normalize a database URL for the asyncpg driver.

    - PaaS (e.g. Render) hand out plain ``postgresql://`` DSNs; SQLAlchemy's
      async engine needs the ``postgresql+asyncpg://`` scheme or it falls back
      to sync psycopg2.
    - asyncpg expresses TLS via the ``ssl`` connect arg, not psycopg2's
      ``sslmode`` query parameter.
    """
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    url = re.sub(r"sslmode=([^&\s]+)", r"ssl=\1", url)
    return url


def _get_engine():
    global _engine, _session_factory
    if _engine is None:
        # Store helpers may run database coroutines in a worker event loop
        # while FastAPI owns the request loop. Do not reuse asyncpg
        # connections across those loops.
        _engine = create_async_engine(async_database_url(settings.database_url), poolclass=NullPool, pool_pre_ping=True)
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
    except Exception as e:  # noqa: BLE001 - probe must never raise
        logger.warning("Postgres probe failed: %s: %s", type(e).__name__, e)
        return False


def ensure_probed() -> None:
    """Probe the database once, whatever the entry point.

    ASGI apps probe in their lifespan, but Celery workers and sync store
    helpers never run that hook; this makes ``store`` decisions (memory vs
    asyncpg) deterministic even when no HTTP request ever fired — e.g. running
    a single pytest file, or a worker that writes inbox entries.
    """
    global _health_checked, _db_available  # noqa: PLW0603
    if _health_checked:
        return
    if not database_enabled():
        _health_checked = True
        _db_available = False
        return
    import asyncio
    import threading

    out: dict[str, bool] = {}

    def _runner() -> None:
        try:
            out["ok"] = asyncio.run(probe())
        except Exception:  # noqa: BLE001 - probe must never raise
            out["ok"] = False

    thread = threading.Thread(target=_runner, daemon=True)
    thread.start()
    thread.join()
    _db_available = bool(out.get("ok"))
    _health_checked = True


def get_session() -> AsyncSession:
    """Open a session; raises RuntimeError when the database is unavailable."""
    if not database_available():
        raise RuntimeError("database disabled/unreachable; rely on in-memory store")
    return _get_engine() and _session_factory()  # type: ignore[return-value]


def engine():
    return _engine