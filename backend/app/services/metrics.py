"""Tiny in-memory runtime metrics in Prometheus text format (zero deps).

Scoped for demo/dev observability: counters for requests, latency and status
codes per method+path, plus uptime. A production deploy would swap this for
prometheus-client and distributed tracing; the contract here is just
``/metrics`` staying scrapeable.
"""
from __future__ import annotations

import time
from threading import Lock

_started = time.time()

_lock = Lock()
_requests: dict[str, int] = {}
_responses: dict[str, int] = {}
_latency_ns: dict[str, int] = {}
_samples: dict[str, int] = {}


def record(method: str, path: str, status_code: int, latency_ns: int) -> None:
    """Record one completed request (called from the metrics middleware)."""
    key = f"{method} {path}"
    with _lock:
        _requests[key] = _requests.get(key, 0) + 1
        _responses[f"{method} {path} {status_code}"] = _responses.get(f"{method} {path} {status_code}", 0) + 1
        _latency_ns[key] = _latency_ns.get(key, 0) + latency_ns
        _samples[key] = _samples.get(key, 0) + 1


def reset() -> None:
    """Wipe counters (test isolation)."""
    with _lock:
        _requests.clear()
        _responses.clear()
        _latency_ns.clear()
        _samples.clear()


def render(extra_lines: str = "") -> str:
    """Render the counter set as Prometheus text format."""
    out: list[str] = [
        "# HELP mausam_requests_total HTTP requests by method+path.",
        "# TYPE mausam_requests_total counter",
    ]
    with _lock:
        for key, n in sorted(_requests.items()):
            method, path = key.split(" ", 1)
            out.append(f'mausam_requests_total{{method="{method}",path="{path}"}} {n}')
        out.append("# HELP mausam_request_duration_milliseconds_total Total latency by method+path.")
        out.append("# TYPE mausam_request_duration_milliseconds_total counter")
        for key, ns in sorted(_latency_ns.items()):
            method, path = key.split(" ", 1)
            out.append(f"mausam_request_duration_milliseconds_total{{method=\"{method}\",path=\"{path}\"}} {ns / 1_000_000:.3f}")
        out.append("# HELP mausam_responses_by_status Responses by method+path+status.")
        out.append("# TYPE mausam_responses_by_status counter")
        for key, n in sorted(_responses.items()):
            method, path, status = key.split(" ", 2)
            out.append(f'mausam_responses_by_status{{method="{method}",path="{path}",status="{status}"}} {n}')
    out.append("# TYPE mausam_uptime_seconds gauge")
    out.append(f"mausam_uptime_seconds {time.time() - _started:.0f}")
    if extra_lines:
        out.append(extra_lines)
    return "\n".join(out) + "\n"