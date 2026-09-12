"""Small distributed cache for alert fan-out idempotency.

Uses Redis (``REDIS_URL``) when reachable; degrades to an in-process dict so
the demo, CI and tests work with zero infrastructure. After the first failed
Redis call the process stops trying (never pays a connect timeout per request)
and stays on the memory fallback. Values are short-lived (5 minute TTL) and
every Redis call is best-effort.
"""
from __future__ import annotations

import time

from app.core.config import settings

_TTL_SECONDS = 300
_store: dict[str, tuple[float, str]] = {}
_redis = None
_redis_broken = False


def _client():
    """Return a Redis client if usable so far, else None (memory fallback)."""
    global _redis, _redis_broken  # noqa: PLW0603
    if _redis_broken:
        return None
    if _redis is None:
        try:
            import redis.asyncio as aioredis

            _redis = aioredis.from_url(settings.redis_url, socket_connect_timeout=1)
        except Exception:  # redis not installed -> memory fallback
            _redis_broken = True
            return None
    return _redis


def _mark_broken() -> None:
    global _redis_broken  # noqa: PLW0603
    _redis_broken = True


def _decode(value):
    return value.decode() if isinstance(value, (bytes, bytearray)) else value


async def cache_get(key: str) -> str | None:
    client = _client()
    if client is not None:
        try:
            return _decode(await client.get(key))
        except Exception:  # noqa: BLE001 - cache is best-effort
            _mark_broken()
            return None
    entry = _store.get(key)
    if entry is None:
        return None
    ts, value = entry
    if time.monotonic() - ts > _TTL_SECONDS:
        _store.pop(key, None)
        return None
    return value


async def cache_set(key: str, value: str) -> None:
    client = _client()
    if client is not None:
        try:
            await client.set(key, value, ex=_TTL_SECONDS)
            return
        except Exception:  # noqa: BLE001
            _mark_broken()
    _store[key] = (time.monotonic(), value)


def clear() -> None:
    """Wipe the in-process cache + forget a dead Redis (test isolation)."""
    _store.clear()
    _redis_broken = False