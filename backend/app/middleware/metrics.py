"""Request instrumentation for ``/metrics`` (see app.services.metrics).

Runs outermost so it sees every request including rate-limited (429) and
404 responses; its own endpoints are excluded to avoid counting themselves.
"""
from __future__ import annotations

import time

from starlette.middleware.base import BaseHTTPMiddleware

from app.services import metrics

_SKIP = frozenset({"/metrics", "/health", "/healthz"})


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.url.path
        if path in _SKIP:
            return await call_next(request)
        method = request.method
        start = time.perf_counter_ns()
        try:
            response = await call_next(request)
        except Exception:
            metrics.record(method, path, 500, time.perf_counter_ns() - start)
            raise
        metrics.record(method, path, response.status_code, time.perf_counter_ns() - start)
        return response