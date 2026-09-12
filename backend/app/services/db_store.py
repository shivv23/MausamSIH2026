"""Optional Postgres/PostGIS-backed store (same interface as store.py).

Enables durable persistence of users/activities/alerts behind the same thin
API the endpoints use. Endpoints never call this directly — they go through
``store.py``, which dispatches here only when ``settings.database_enabled``.
"""
from __future__ import annotations

from sqlalchemy import delete, select

from app.db import get_session
from app.models.orm import ActivityRow, PushTokenRow, UserCredRow, UserNotificationRow, UserRow
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


# ---- Full account records (contact/OTP/version/lockout) ----------------------

_ACCOUNT_FIELDS = {
    "email", "phone", "email_verified", "phone_verified", "token_version",
    "otp_code_hash", "otp_purpose", "otp_expires_at", "otp_attempts",
    "otp_verified_flag", "otp_verified_at", "failed_logins", "locked_until",
}

_DT_FIELDS = {"otp_expires_at", "otp_verified_at", "locked_until"}


async def get_account(user_id: str) -> dict | None:
    async with get_session() as s:
        row = (await s.execute(
            select(UserCredRow).where(UserCredRow.user_id == user_id))).scalar_one_or_none()
        if row is None:
            return None
        return {
            "user_id": row.user_id,
            "password_hash": row.password_hash,
            "email": row.email,
            "phone": row.phone,
            "email_verified": bool(row.email_verified),
            "phone_verified": bool(row.phone_verified),
            "token_version": int(row.token_version or 0),
            "otp_code_hash": row.otp_code_hash,
            "otp_purpose": row.otp_purpose,
            "otp_expires_at": row.otp_expires_at.isoformat() if row.otp_expires_at else None,
            "otp_attempts": int(row.otp_attempts or 0),
            "otp_verified_flag": row.otp_verified_flag,
            "otp_verified_at": row.otp_verified_at.isoformat() if row.otp_verified_at else None,
            "failed_logins": int(row.failed_logins or 0),
            "locked_until": row.locked_until.isoformat() if row.locked_until else None,
        }


async def save_account(user_id: str, fields: dict) -> dict:
    from datetime import datetime
    async with get_session() as s:
        row = (await s.execute(
            select(UserCredRow).where(UserCredRow.user_id == user_id))).scalar_one_or_none()
        if row is None:
            raise RuntimeError(f"account {user_id} does not exist (register first)")
        for key, value in fields.items():
            if key not in _ACCOUNT_FIELDS:
                continue
            if key in _DT_FIELDS and isinstance(value, str) and value:
                value = datetime.fromisoformat(value)
            setattr(row, key, value)
        await s.commit()
    return await get_account(user_id)


# ---- Push-token registry -----------------------------------------------------

async def list_push_tokens(user_id: str) -> list[dict]:
    async with get_session() as s:
        rows = (await s.execute(
            select(PushTokenRow).where(PushTokenRow.user_id == user_id))
        ).scalars().all()
        return [{"user_id": r.user_id, "platform": r.platform,
                 "expo_push_token": r.expo_push_token} for r in rows]


async def upsert_push_token(user_id: str, platform: str, expo_push_token: str) -> None:
    from datetime import datetime, timezone
    async with get_session() as s:
        row = (await s.execute(
            select(PushTokenRow).where(PushTokenRow.expo_push_token == expo_push_token)
        )).scalar_one_or_none()
        if row is None:
            row = PushTokenRow(user_id=user_id, platform=platform, expo_push_token=expo_push_token)
            s.add(row)
        else:
            row.user_id = user_id
            row.platform = platform
            row.updated_at = datetime.now(timezone.utc)
        await s.commit()


async def delete_push_token(user_id: str, expo_push_token: str) -> bool:
    async with get_session() as s:
        result = await s.execute(
            delete(PushTokenRow).where(
                PushTokenRow.user_id == user_id,
                PushTokenRow.expo_push_token == expo_push_token))
        await s.commit()
        return result.rowcount > 0


async def list_all_push_tokens() -> list[dict]:
    async with get_session() as s:
        rows = (await s.execute(select(PushTokenRow))).scalars().all()
        return [{"user_id": r.user_id, "platform": r.platform,
                 "expo_push_token": r.expo_push_token} for r in rows]


async def delete_push_token_all(expo_push_token: str) -> None:
    async with get_session() as s:
        await s.execute(delete(PushTokenRow).where(PushTokenRow.expo_push_token == expo_push_token))
        await s.commit()


# ---- In-app notification centre / alert archive ------------------------------

async def list_notifications(user_id: str) -> list[dict]:
    async with get_session() as s:
        rows = (await s.execute(
            select(UserNotificationRow).where(UserNotificationRow.user_id == user_id)
        )).scalars().all()
    rows = sorted(rows, key=lambda r: r.created_at, reverse=True)
    return [{
        "id": r.id, "user_id": r.user_id, "alert_id": r.alert_id,
        "severity": r.severity, "event_type": r.event_type,
        "headline": r.headline, "body": r.body, "region": r.region,
        "read_at": r.read_at.isoformat() if r.read_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in rows]


async def add_notification(user_id: str, alert_id: str, severity: str, event_type: str,
                           headline: str, body: str, region: str) -> None:
    from datetime import datetime, timezone
    async with get_session() as s:
        existing = (await s.execute(
            select(UserNotificationRow).where(
                UserNotificationRow.user_id == user_id,
                UserNotificationRow.alert_id == alert_id,
            ))).scalar_one_or_none()
        if existing is not None:
            return
        s.add(UserNotificationRow(
            user_id=user_id, alert_id=alert_id, severity=severity,
            event_type=event_type, headline=headline, body=body, region=region,
            created_at=datetime.now(timezone.utc),
        ))
        await s.commit()


async def ack_notification(user_id: str, notification_id: str) -> bool:
    from datetime import datetime, timezone
    async with get_session() as s:
        row = (await s.execute(
            select(UserNotificationRow).where(
                UserNotificationRow.user_id == user_id,
                UserNotificationRow.id == notification_id,
            ))).scalar_one_or_none()
        if row is None:
            return False
        row.read_at = datetime.now(timezone.utc)
        await s.commit()
        return True


async def delete_account(user_id: str) -> bool:
    """Full right-to-erasure: account, backup, inbox, push tokens, activities."""
    async with get_session() as s:
        result = (await s.execute(
            delete(UserCredRow).where(UserCredRow.user_id == user_id)))
        await s.execute(delete(UserNotificationRow).where(UserNotificationRow.user_id == user_id))
        await s.execute(delete(PushTokenRow).where(PushTokenRow.user_id == user_id))
        await s.execute(delete(ActivityRow).where(ActivityRow.user_id == user_id))
        row = (await s.execute(select(UserRow).where(UserRow.id == user_id))).scalar_one_or_none()
        if row is not None:
            await s.execute(delete(UserRow).where(UserRow.id == user_id))
        await s.commit()
        return result.rowcount > 0


def _row_to_activity(r: ActivityRow) -> Activity:
    return Activity(
        id=r.id, type=r.activity_type, label=r.label or "",
        days=list(r.days or []), preferred_start=r.preferred_start, preferred_end=r.preferred_end,
    )