"""Structured logging.

One JSON object per line (RFC-5424-ish fields) when ``LOG_JSON=1`` so logs can
be piped straight into a collector; otherwise standard human-readable output.
"""
from __future__ import annotations

import json
import logging
import sys
import time

from app.core.config import settings


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname.lower(),
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        for key in ("user_id", "alert_id", "tokens", "sent", "failed"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        return json.dumps(payload, default=str)


def configure_logging() -> None:
    root = logging.getLogger()
    root.setLevel(logging.INFO if not settings.debug else logging.DEBUG)
    handler = logging.StreamHandler(sys.stdout)
    if settings.log_json:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    # Tidy default logging from uvicorn access noise in JSON mode.
    if not root.handlers:
        root.addHandler(handler)