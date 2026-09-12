"""Celery tasks: durable alert fan-out executed off the HTTP request path."""
from __future__ import annotations

import asyncio
import logging

from app.services import fanout
from app.workers import celery_app

logger = logging.getLogger("mausam.tasks")


@celery_app.task(name="alerts.fan_out", acks_late=True)
def fan_out_alert(
    *,
    alert_id: str,
    event_type: str,
    severity: str,
    headline: str,
    region: str,
    detail: str | None,
    user_ids: list[str],
) -> dict[str, int]:
    """Create durable inbox entries + fire push notifications for affected users.

    Runs inside a Celery worker when the alert broker is wired; mirrors the
    sync fallback in ``app/api/v1/endpoints/alerts.py``.
    """
    if not user_ids:
        return {"acknowledged": 0, "sent": 0, "failed": 0}
    body = f"{region} · {detail or event_type}"
    fanout.archive_delivery_intent(
        user_ids=user_ids,
        alert_id=alert_id,
        severity=severity,
        event_type=event_type,
        headline=headline,
        body=body,
        region=region,
    )
    try:
        result = asyncio.run(
            fanout.push_to_devices(
                user_ids=user_ids,
                title=headline,
                body=body,
                alert_id=alert_id,
                severity=severity,
            )
        )
        sent, failed = result.get("sent", 0), result.get("failed", 0)
    except Exception:  # noqa: BLE001 - a worker must never crash on push failure
        logger.exception("fan-out push failed; inbox entries already durable")
        sent, failed = 0, len(user_ids)
    return {"acknowledged": len(user_ids), "sent": sent, "failed": failed}