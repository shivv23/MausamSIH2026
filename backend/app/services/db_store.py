"""Optional Postgres/PostGIS-backed store (same interface as store.py).

Enables durable persistence of users/activities/alerts behind the same thin
API the endpoints use. Endpoints never call this directly — they go through
``store.py``, which dispatches here only when ``settings.database_enabled``.
"""
from __future__ import annotations

from sqlalchemy import delete, select

from app.db import get_session
from app.models.orm import ActivityRow, UserCredRow, UserRow
from app.models.schemas import Activity, ActivityInput, UserProfile


async def profile_for(user_id: str, city: str = "pune") -> UserProfile:
    async with get_session() as s:
        row = (await s.execute(select(UserRow).where(UserRow.id == user_id))).scalar_one_or_none()
        if row is None:
            prof = UserProfile(user_id=user_id, personas=["commuter"])
            row = UserRow(id=user_id, personas=["commuter"])
            s.add(row)
            await s.commit()
            return prof
        return UserProfile(
            user_id=row.id, personas=list(row.personas or []),
            language=row.language or "en",
        )


async def list_activities(user_id: str) -> list[Activity]:
    async with get_session() as s:
        rows = (await s.execute(select(ActivityRow).where(ActivityRow.user_id == user_id))).scalars().all()
        return [_row_to_activity(r) for r in rows]


async def add_activity(user_id: str, inp: ActivityInput) -> Activity:
    from app.services.activity import input_to_activity
    act = input_to_activity(inp, user_id)
    async with get_session() as s:
        s.add(ActivityRow(
            id=act.id, user_id=user_id, activity_type=act.type.value,
            label=act.label, days=act.days,
            preferred_start=act.preferred_start, preferred_end=act.preferred_end,
            latitude=act.loc.lat if act.loc else None,
            longitude=act.loc.lon if act.loc else None,
        ))
        await s.commit()
    return act


async def remove_activity(user_id: str, activity_id: str) -> bool:
    async with get_session() as s:
        result = await s.execute(
            delete(ActivityRow).where(ActivityRow.user_id == user_id, ActivityRow.id == activity_id))
        await s.commit()
        return result.rowcount > 0


async def upsert_profile(profile: UserProfile) -> None:
    async with get_session() as s:
        row = (await s.execute(select(UserRow).where(UserRow.id == profile.user_id))).scalar_one_or_none()
        if row is None:
            row = UserRow(id=profile.user_id)
            s.add(row)
        row.personas = list(profile.personas)
        row.language = profile.language
        if profile.display_name is not None:
            row.display_name = profile.display_name
        if profile.city is not None:
            row.city = profile.city
        row.health = dict(profile.health)
        await s.commit()


# ---- Cross-device profile sync (opaque JSON blob per user) ------------------

async def get_synced_profile(user_id: str) -> dict | None:
    async with get_session() as s:
        row = (await s.execute(select(UserRow).where(UserRow.id == user_id))).scalar_one_or_none()
        if row is None or not row.profile_jsonb:
            return None
        return dict(row.profile_jsonb)


async def get_synced_updated_at(user_id: str) -> str | None:
    async with get_session() as s:
        row = (await s.execute(select(UserRow).where(UserRow.id == user_id))).scalar_one_or_none()
        if row is None or row.profile_updated_at is None:
            return None
        return row.profile_updated_at.isoformat()


async def delete_synced_profile(user_id: str) -> bool:
    async with get_session() as s:
        row = (await s.execute(select(UserRow).where(UserRow.id == user_id))).scalar_one_or_none()
        if row is None:
            return False
        row.profile_jsonb = {}
        row.profile_updated_at = None
        await s.commit()
        return True


async def put_synced_profile(user_id: str, data: dict) -> None:
    from datetime import datetime, timezone
    async with get_session() as s:
        row = (await s.execute(select(UserRow).where(UserRow.id == user_id))).scalar_one_or_none()
        if row is None:
            row = UserRow(id=user_id)
            s.add(row)
        row.profile_jsonb = data
        row.profile_updated_at = datetime.now(timezone.utc)
        if "name" in data:
            row.display_name = data["name"]
        if "city" in data:
            row.city = data["city"]
        if "language" in data:
            row.language = data["language"]
        if "personas" in data:
            row.personas = list(data["personas"])
        if "conditions" in data:
            row.health = {c: True for c in data["conditions"]}
        await s.commit()


# ---- Mobile account credentials ---------------------------------------------

async def get_password_hash(user_id: str) -> str | None:
    async with get_session() as s:
        row = (await s.execute(
            select(UserCredRow).where(UserCredRow.user_id == user_id))).scalar_one_or_none()
        return row.password_hash if row else None


async def set_password_hash(user_id: str, password_hash: str) -> None:
    async with get_session() as s:
        row = (await s.execute(
            select(UserCredRow).where(UserCredRow.user_id == user_id))).scalar_one_or_none()
        if row is None:
            row = UserCredRow(user_id=user_id, password_hash=password_hash)
            s.add(row)
        else:
            row.password_hash = password_hash
        await s.commit()


def _row_to_activity(r: ActivityRow) -> Activity:
    return Activity(
        id=r.id, type=r.activity_type, label=r.label or "",
        days=list(r.days or []), preferred_start=r.preferred_start, preferred_end=r.preferred_end,
    )