"""Basic in-memory rate limiting for auth endpoints.

A sliding-window counter keyed by ``(client ip, endpoint)`` guards
``/api/v1/auth/*`` against credential stuffing. Limits live in settings
(``rate_limit_max`` per ``rate_limit_window_seconds``). The limiter instance is
exposed as ``app.state.rate_limiter`` so tests can inspect/reset it.
"""
from __future__ import annotations

import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import settings

_AUTH_PREFIX = "/api/v1/auth/"


class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int) -> None:
        # key -> list of request timestamps (recent window only)
        self._hits: dict[str, list[float]] = {}
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    def allowed(self, key: str) -> tuple[bool, float]:
        """Return (allowed, retry_after_seconds). Prunes stale timestamps."""
        now = time.monotonic()
        window = self._hits.get(key, [])
        cutoff = now - self.window_seconds
        window = [ts for ts in window if ts > cutoff]
        if len(window) >= self.max_requests:
            self._hits[key] = window
            retry_after = max(0.0, self.window_seconds - (now - window[0]))
            return False, round(retry_after, 1)
        window.append(now)
        self._hits[key] = window
        return True, 0.0

    def reset(self) -> None:
        self._hits.clear()


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.startswith(_AUTH_PREFIX):
            limiter = getattr(request.app.state, "rate_limiter", None)
            if limiter is None:
                limiter = RateLimiter(settings.rate_limit_max, settings.rate_limit_window_seconds)
                request.app.state.rate_limiter = limiter
            ip = request.client.host if request.client else "unknown"
            key = f"{ip}::{path}"
            allowed, retry_after = limiter.allowed(key)
            if not allowed:
                return JSONResponse(
                    {"detail": f"too many requests; retry in {retry_after}s"},
                    status_code=429,
                    headers={"Retry-After": str(int(retry_after))},
                )
        return await call_next(request)