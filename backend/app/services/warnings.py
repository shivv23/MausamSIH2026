"""Disaster alerts + localized push-target resolution.

Provides:
  * point-in-polygon geofencing (ray-casting)
  * an in-memory active-warnings store so admins can publish/edit
  * "simulate" — draw an alert polygon over a region and compute which
    registered demo users fall inside it, with their personalized push body
    and a ready-to-send FCM payload (no live FCM needed for the demo).
"""
from __future__ import annotations

import math
import uuid
from datetime import datetime, timedelta, timezone
from threading import Lock

from app.models.schemas import (
    AlertSimulationRequest,
    AlertSummary,
    DisasterAlert,
    GeoPoint,
    GeoPolygon,
    PushTarget,
    SimulationResult,
    WarningSeverity,
)

# Demo user -> registered anchor (city) so "who's affected" is meaningful even
# without a DB. Mirrors the names used in the pitch demo.
DEMO_USERS: dict[str, str] = {
    "ananya": "Pune",
    "ramesh": "Pune",
    "asha": "Pune",
    "vikram": "Mumbai",
    "meena": "Chennai",
    "raj": "Pune",
}

_POLY_HELPERS = {
    "pune": [[73.70, 18.44], [73.86, 18.44], [73.86, 18.60], [73.70, 18.60], [73.70, 18.44]],
    "mumbai": [[72.80, 18.90], [72.98, 18.90], [72.98, 19.10], [72.80, 19.10], [72.80, 18.90]],
    "chennai": [[80.10, 12.90], [80.30, 12.90], [80.30, 13.15], [80.10, 13.15], [80.10, 12.90]],
}

_LOCK = Lock()
_ALERTS: dict[str, DisasterAlert] = {}


def point_in_polygon(point: GeoPoint, polygon: GeoPolygon) -> bool:
    """Ray-casting point-in-polygon test. coordinates are [lon, lat] rings."""
    ring = polygon.coordinates
    if not ring:
        return False
    x, y = point.lon, point.lat
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def _circle_polygon(center: GeoPoint, radius_km: float) -> GeoPolygon:
    """Approximate a radius on a rectangle-ish ring for the demo polygon."""
    dlat = radius_km / 111.0
    dlon = radius_km / (111.0 * max(0.4, math.cos(math.radians(center.lat))))
    return GeoPolygon(coordinates=[
        [center.lon - dlon, center.lat - dlat],
        [center.lon + dlon, center.lat - dlat],
        [center.lon + dlon, center.lat + dlat],
        [center.lon - dlon, center.lat + dlat],
        [center.lon - dlon, center.lat - dlat],
    ])


def publish(alert: AlertSimulationRequest) -> DisasterAlert:
    center = alert.center or _anchor_for(alert.region, _anchor("Pune"))
    polygon = _circle_polygon(center, alert.radius_km or 40) if alert.radius_km else _region_polygon(alert.region)
    now = datetime.now(timezone.utc)
    alert_obj = DisasterAlert(
        id=f"w-{uuid.uuid4().hex[:10]}",
        severity=alert.severity,
        event_type=alert.event_type,
        headline=alert.headline,
        detail=alert.detail or f"{alert.event_type.replace('_', ' ').title()} in {alert.region}",
        region=alert.region,
        polygon=polygon,
        issued_at=now,
        valid_until=now + timedelta(hours=alert.valid_hours),
        actionable=_actionable_for(alert.severity, alert.event_type, alert.impact),
    )
    with _LOCK:
        _ALERTS[alert_obj.id] = alert_obj
    return alert_obj


def list_alerts() -> list[AlertSummary]:
    now = datetime.now(timezone.utc)
    with _LOCK:
        active = [a for a in _ALERTS.values() if a.valid_until > now]
    return [AlertSummary(
        id=a.id, severity=a.severity, event_type=a.event_type,
        headline=a.headline, region=a.region,
        issued_at=a.issued_at, valid_until=a.valid_until,
    ) for a in sorted(active, key=lambda x: x.issued_at, reverse=True)]


def list_alerts_with_polygon() -> list[DisasterAlert]:
    now = datetime.now(timezone.utc)
    with _LOCK:
        return sorted([a for a in _ALERTS.values() if a.valid_until > now],
                      key=lambda x: x.issued_at, reverse=True)


def clear_alerts() -> int:
    with _LOCK:
        n = len(_ALERTS)
        _ALERTS.clear()
    return n


def resolve_targets(alert: DisasterAlert) -> list[PushTarget]:
    """Users whose registered anchor falls inside the alert polygon."""
    targets: list[PushTarget] = []
    for uid, city in DEMO_USERS.items():
        loc = _anchor(city)
        inside = point_in_polygon(loc, alert.polygon)
        body = _body_for(uid, alert, inside)
        targets.append(PushTarget(
            user_id=uid,
            registered_city=city,
            in_polygon=inside,
            headline=alert.headline,
            body=body,
            fcm_payload=_fcm_payload(alert, uid, city, inside),
        ))
    return targets


def simulate(req: AlertSimulationRequest) -> SimulationResult:
    alert = publish(req)
    return SimulationResult(alert=alert, affected_users=resolve_targets(alert))


# ---- helpers ----------------------------------------------------------------

def _anchor_for(city: str, fallback: GeoPoint) -> GeoPoint:
    table = {
        "Pune": GeoPoint(lat=18.5204, lon=73.8567, name="Pune"),
        "Mumbai": GeoPoint(lat=19.0760, lon=72.8777, name="Mumbai"),
        "Chennai": GeoPoint(lat=13.0827, lon=80.2707, name="Chennai"),
        "Delhi": GeoPoint(lat=28.6139, lon=77.2090, name="Delhi"),
        "Kochi": GeoPoint(lat=9.9312, lon=76.2673, name="Kochi"),
    }
    return table.get(city.strip().title(), fallback)


def _anchor(city: str) -> GeoPoint:
    return _anchor_for(city, GeoPoint(lat=18.5204, lon=73.8567, name="Pune"))


def _region_polygon(region: str) -> GeoPolygon:
    key = region.strip().lower()
    if key in _POLY_HELPERS:
        return GeoPolygon(coordinates=[list(p) for p in _POLY_HELPERS[key]])
    return _circle_polygon(_anchor_for(region, _anchor("Pune")), 40)


def _actionable_for(severity: WarningSeverity, event: str, impacts: list[str]) -> list[str]:
    base = {
        "heavy_rain": ["Avoid low-lying roads", "Keep an umbrella & waterproofs", "Allow extra commute time"],
        "cyclone": ["Stay indoors, away from windows", "Secure loose objects", "Listen to official updates"],
        "heatwave": ["Stay hydrated", "Avoid midday sun", "Check on elders"],
        "thunderstorm": ["Move indoors", "Unplug electronics", "Avoid open fields"],
    }
    steps = base.get(event, [f"Review official guidance for {impacts[0]}" if impacts else "Stay informed"])
    if severity == WarningSeverity.RED:
        steps.insert(0, "Seek safe shelter immediately")
    elif severity == WarningSeverity.ORANGE:
        steps.insert(0, "Be prepared to act")
    return steps


def _body_for(user_id: str, alert: DisasterAlert, inside: bool) -> str:
    scope = "inside the affected zone" if inside else "near the affected zone"
    return f"{alert.headline} — you are {scope}. {alert.actionable[0] if alert.actionable else 'Stay safe'}."


def _fcm_payload(alert: DisasterAlert, user_id: str, city: str, inside: bool) -> dict:
    return {
        "to": f"/topics/{alert.region.lower().replace(' ', '_')}::{user_id}",
        "notification": {
            "title": alert.headline,
            "body": f"{alert.headline} in {alert.region}. {'You are affected — please act.' if inside else 'Be aware.'}",
            "sound": "default",
        },
        "data": {
            "alert_id": alert.id,
            "severity": alert.severity.value,
            "event_type": alert.event_type,
            "region": alert.region,
            "affected": str(inside).lower(),
            "click_action": "MAUSAM_ALERT",
        },
    }