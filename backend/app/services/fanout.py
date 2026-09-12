"""Alert fan-out shared by both delivery paths.

* **Sync fallback** (FastAPI ``BackgroundTasks``) — used when Celery is not
  configured; the endpoint writes durable inbox entries inline and schedules
  the Expo push.
* **Celery worker** — when ``CELERY_ENABLED=1`` the same logic runs inside
  ``app.tasks.fan_out_alert`` so the HTTP request never blocks on delivery.

Keeping one implementation here means inbox archives and push payloads can't
drift between paths.
"""
from __future__ import annotations

from app.core.config import settings
from app.services import push as push_service
from app.services import store


def _push_tokens(user_ids: list[str]) -> list[str]:
    return [
        d["expo_push_token"]
        for user_id in user_ids
        for d in store.list_push_tokens(user_id)
    ]


def archive_delivery_intent(
    *,
    user_ids: list[str],
    alert_id: str,
    severity: str,
    event_type: str,
    headline: str,
    body: str,
    region: str,
) -> None:
    """Create one durable inbox entry per affected user (appears once)."""
    for user_id in user_ids:
        store.add_notification(
            user_id=user_id,
            alert_id=alert_id,
            severity=severity,
            event_type=event_type,
            headline=headline,
            body=body,
            region=region,
        )


async def push_to_devices(
    *,
    user_ids: list[str],
    title: str,
    body: str,
    alert_id: str,
    severity: str,
) -> dict[str, int]:
    """Send the notification to every registered device (no-op when disabled)."""
    tokens = _push_tokens(user_ids)
    if not settings.push_enabled or not tokens:
        return {"sent": 0, "failed": 0}
    return await push_service.send_push(
        tokens=tokens,
        title=title,
        body=body,
        data={"alertId": alert_id, "severity": severity},
    )