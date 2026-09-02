"""Optional Postgres/PostGIS-backed store (same interface as store.py).

Enables durable persistence of users/activities/alerts behind the same thin
API the endpoints use. Endpoints never call this directly — they go through
``store.py``, which dispatches here only when ``settings.database_enabled``.
"""
from __future__ import annotations

from sqlalchemy import delete, select

from app.db import get_session
from app.models.orm import ActivityRow, UserRow
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
        row.city = profile.city
        row.health = dict(profile.health)
        await s.commit()


def _row_to_activity(r: ActivityRow) -> Activity:
    return Activity(
        id=r.id, type=r.activity_type, label=r.label or "",
        days=list(r.days or []), preferred_start=r.preferred_start, preferred_end=r.preferred_end,
    )