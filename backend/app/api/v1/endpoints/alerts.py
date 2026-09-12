"""Admin / disaster-simulation endpoints.

An IMD operator can publish a warning (optionally "simulate" a live disaster),
and the service computes which registered users fall inside the geofence and
resolves personalized push payloads. This is the "Orange alert -> geofence ->
localized push" demo flow.

Fan-out has two paths:

* **sync fallback** (default) — durable inbox entries are written inline and
  the Expo push is scheduled on FastAPI ``BackgroundTasks``;
* **Celery fan-out** — when ``CELERY_ENABLED=1`` the whole delivery (archive +
  push) is deferred to ``app.tasks.fan_out_alert`` so the HTTP response never
  blocks on delivery.
"""
from __future__ import annotations

import hashlib

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.core.config import settings
from app.models.schemas import AlertSimulationRequest, AlertSummary, SimulationResult
from app.services import cache, store, warnings
from app.services import push as push_service

router = APIRouter(prefix="/api/v1", tags=["alerts"])


@router.get("/alerts", response_model=list[AlertSummary])
async def alerts() -> list[AlertSummary]:
    return warnings.list_alerts()


@router.post("/alerts/simulate", response_model=SimulationResult)
async def simulate(body: AlertSimulationRequest, background_tasks: BackgroundTasks) -> SimulationResult:
    if body.event_type not in ("heavy_rain", "cyclone", "heatwave", "thunderstorm", "flood"):
        raise HTTPException(400, "unknown event_type; use heavy_rain|cyclone|heatwave|thunderstorm|flood")
    result = warnings.simulate(body)
    affected_user_ids = sorted({t.user_id for t in result.affected_users if t.in_polygon})
    if not affected_user_ids:
        return result
    # Idempotency: re-publishing the same alert (same severity/type/headline/
    # region) inside the cache window never fans out twice, so duplicate admin
    # clicks can't double-notify a user within the 5-minute TTL.
    fingerprint = hashlib.sha1(
        f"{body.severity.value}|{body.event_type}|{body.headline}|{body.region}".encode()
    ).hexdigest()
    cache_key = f"alert:sim:{fingerprint}:fanout"
    if await cache.cache_get(cache_key):
        return result
    await cache.cache_set(cache_key, "1")

    if settings.celery_enabled:
        from app.tasks import fan_out_alert

        fan_out_alert.delay(
            alert_id=result.alert.id,
            event_type=result.alert.event_type,
            severity=result.alert.severity.value,
            headline=result.alert.headline,
            region=result.alert.region,
            detail=result.alert.detail,
            user_ids=affected_user_ids,
        )
        return result

    # Sync fallback: durable inbox entries inline, pushes on background tasks.
    for target in result.affected_users:
        if not target.in_polygon:
            continue
        store.add_notification(
            user_id=target.user_id,
            alert_id=result.alert.id,
            severity=result.alert.severity.value,
            event_type=result.alert.event_type,
            headline=result.alert.headline,
            body=target.body,
            region=result.alert.region,
        )
    tokens = [
        d["expo_push_token"]
        for user_id in affected_user_ids
        for d in store.list_push_tokens(user_id)
    ]
    background_tasks.add_task(
        push_service.send_push,
        tokens=tokens,
        title=result.alert.headline,
        body=f"{result.alert.region} · {result.alert.detail or result.alert.event_type}",
        data={"alertId": result.alert.id, "severity": result.alert.severity.value},
    )
    return result


@router.delete("/alerts")
async def clear() -> dict[str, int]:
    return {"cleared": warnings.clear_alerts()}