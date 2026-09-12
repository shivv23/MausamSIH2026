"""DB-backed admin store (Postgres/PostGIS).

All admin data lives in Postgres. There is intentionally NO in-memory or
hard-coded store here; the API + dashboard read/write these tables directly.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select, update

from app.db import get_session
from app.models.orm import ActivityRow, AdminUserRow, AlertRow, UserRow
from app.models.schemas import GeoPoint, GeoPolygon, WarningSeverity
from app.providers.mock import pick_anchor


# ============================ Admin users ====================================

async def get_admin_by_username(username: str) -> AdminUserRow | None:
    async with get_session() as s:
        return (await s.execute(
            select(AdminUserRow).where(AdminUserRow.username == username))).scalar_one_or_none()


async def get_admin_by_id(admin_id: str) -> AdminUserRow | None:
    async with get_session() as s:
        return (await s.execute(
            select(AdminUserRow).where(AdminUserRow.id == admin_id))).scalar_one_or_none()


async def create_admin(username: str, password_hash: str, display_name: str | None,
                       role: str = "admin") -> AdminUserRow:
    row = AdminUserRow(username=username, password_hash=password_hash,
                       display_name=display_name, role=role)
    async with get_session() as s:
        s.add(row)
        await s.commit()
        return row


async def list_admin_users() -> list[AdminUserRow]:
    async with get_session() as s:
        return list((await s.execute(
            select(AdminUserRow).order_by(AdminUserRow.created_at))).scalars())


async def set_admin_active(admin_id: str, is_active: bool) -> int:
    async with get_session() as s:
        res = await s.execute(update(AdminUserRow).where(AdminUserRow.id == admin_id)
                              .values(is_active=is_active))
        await s.commit()
        return res.rowcount


# ============================ App users ======================================

async def list_users(limit: int = 200, offset: int = 0, q: str | None = None) -> list[UserRow]:
    async with get_session() as s:
        stmt = select(UserRow).order_by(UserRow.created_at.desc()).limit(limit).offset(offset)
        if q:
            like = f"%{q}%"
            stmt = (select(UserRow).where(
                UserRow.id.ilike(like) | UserRow.display_name.ilike(like)
                | UserRow.city.ilike(like)).order_by(UserRow.created_at.desc())
                .limit(limit).offset(offset))
        return list((await s.execute(stmt)).scalars())


async def count_users() -> int:
    async with get_session() as s:
        return (await s.execute(select(func.count()).select_from(UserRow))).scalar_one()


async def get_user(user_id: str) -> UserRow | None:
    async with get_session() as s:
        return (await s.execute(
            select(UserRow).where(UserRow.id == user_id))).scalar_one_or_none()


async def update_user(user_id: str, *, display_name: str | None = None,
                      personas: list[str] | None = None, language: str | None = None,
                      city: str | None = None, health: dict | None = None) -> bool:
    values: dict = {}
    if display_name is not None:
        values["display_name"] = display_name
    if personas is not None:
        values["personas"] = personas
    if language is not None:
        values["language"] = language
    if city is not None:
        values["city"] = city
    if health is not None:
        values["health"] = health
    if not values:
        return False
    async with get_session() as s:
        res = await s.execute(update(UserRow).where(UserRow.id == user_id).values(**values))
        await s.commit()
        return res.rowcount > 0


async def delete_user(user_id: str) -> int:
    async with get_session() as s:
        await s.execute(delete(ActivityRow).where(ActivityRow.user_id == user_id))
        res = await s.execute(delete(UserRow).where(UserRow.id == user_id))
        await s.commit()
        return res.rowcount


# ============================ Activities =====================================

async def list_activity_rows(user_id: str) -> list[ActivityRow]:
    async with get_session() as s:
        return list((await s.execute(
            select(ActivityRow).where(ActivityRow.user_id == user_id))).scalars())


async def delete_activity(user_id: str, activity_id: str) -> int:
    async with get_session() as s:
        res = await s.execute(delete(ActivityRow).where(
            ActivityRow.user_id == user_id, ActivityRow.id == activity_id))
        await s.commit()
        return res.rowcount


# ============================ Alerts =========================================

async def create_alert(*, severity: WarningSeverity, event_type: str, headline: str,
                       detail: str, region: str, radius_km: float | None,
                       center: GeoPoint | None, valid_hours: int,
                       issued_by: str = "IMD") -> AlertRow:
    anchor = center or pick_anchor(region)
    dlat = (radius_km or 40) / 111.0
    dlon = (radius_km or 40) / (111.0 * max(0.4, math.cos(math.radians(anchor.lat))))
    polygon = GeoPolygon(coordinates=[
        [anchor.lon - dlon, anchor.lat - dlat], [anchor.lon + dlon, anchor.lat - dlat],
        [anchor.lon + dlon, anchor.lat + dlat], [anchor.lon - dlon, anchor.lat + dlat],
        [anchor.lon - dlon, anchor.lat - dlat],
    ])
    now = datetime.now(timezone.utc)
    row = AlertRow(
        severity=severity.value if isinstance(severity, WarningSeverity) else severity,
        event_type=event_type, headline=headline,
        detail=detail, region=region,
        polygon_geom=_polygon_wkt(polygon),
        circles_json={"center": {"lat": anchor.lat, "lon": anchor.lon},
                      "radius_km": radius_km or 40},
        issued_at=now, valid_until=now + timedelta(hours=valid_hours),
    )
    async with get_session() as s:
        s.add(row)
        await s.commit()
        return row


async def list_alerts(active_only: bool = True) -> list[AlertRow]:
    now = datetime.now(timezone.utc)
    async with get_session() as s:
        stmt = select(AlertRow).order_by(AlertRow.issued_at.desc())
        if active_only:
            stmt = stmt.where(AlertRow.valid_until > now)
        return list((await s.execute(stmt)).scalars())


async def get_alert(alert_id: str) -> AlertRow | None:
    async with get_session() as s:
        return (await s.execute(
            select(AlertRow).where(AlertRow.id == alert_id))).scalar_one_or_none()


async def update_alert(alert_id: str, *, severity: str | None = None,
                       event_type: str | None = None, headline: str | None = None,
                       detail: str | None = None, region: str | None = None,
                       valid_hours: int | None = None) -> bool:
    values: dict = {}
    if severity is not None:
        values["severity"] = severity
    if event_type is not None:
        values["event_type"] = event_type
    if headline is not None:
        values["headline"] = headline
    if detail is not None:
        values["detail"] = detail
    if region is not None:
        values["region"] = region
    if valid_hours is not None:
        values["valid_until"] = datetime.now(timezone.utc) + timedelta(hours=valid_hours)
    if not values:
        return False
    async with get_session() as s:
        res = await s.execute(update(AlertRow).where(AlertRow.id == alert_id).values(**values))
        await s.commit()
        return res.rowcount > 0


async def delete_alert(alert_id: str) -> int:
    async with get_session() as s:
        res = await s.execute(delete(AlertRow).where(AlertRow.id == alert_id))
        await s.commit()
        return res.rowcount


# ============================ Impact / push targets =========================

async def users_in_range(alert: AlertRow, radius_km: float | None) -> list[dict]:
    """Users whose anchor falls inside the alert radius (circle distance, km)."""
    c = (alert.circles_json or {}).get("center", {})
    clat, clon = c.get("lat"), c.get("lon")
    if clat is None or clon is None:
        return []
    users = await list_users(limit=10000)
    results = []
    for u in users:
        loc = pick_anchor(u.city) if u.city else None
        if loc is None:
            continue
        # Haversine
        lat1, lon1 = math.radians(clat), math.radians(clon)
        lat2, lon2 = math.radians(loc.lat), math.radians(loc.lon)
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = (math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2)
        km = 6371.0 * 2 * math.asin(math.sqrt(a))
        in_range = km <= (radius_km or 40)
        results.append({
            "user_id": u.id, "display_name": u.display_name, "city": u.city,
            "personas": list(u.personas or []), "in_range": in_range,
            "distance_km": round(km, 1),
        })
    return results


def _polygon_wkt(polygon: GeoPolygon) -> str:
    ring = ", ".join(f"{lon} {lat}" for lon, lat in polygon.coordinates)
    return f"POLYGON(({ring}))"


async def bootstrap_admin() -> None:
    """Create the env-seeded admin account on first run (no hardcoded creds)."""
    from app.admin.security import hash_password
    from app.core.config import settings

    existing = await get_admin_by_username(settings.admin_username)
    if existing is not None:
        return
    secret_pwd = settings.admin_password
    if not secret_pwd:
        raise RuntimeError("DATABASE_ENABLED requires ADMIN_PASSWORD to bootstrap the admin account")
    await create_admin(
        settings.admin_username,
        hash_password(secret_pwd),
        display_name=settings.admin_username,
        role="admin",
    )