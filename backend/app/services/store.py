"""In-memory activity + user profile registry.

Keeps the demo fully offline (no Postgres required). Each user's canonical
profile (personas, health, activities) is stored here so the homepage, My Day
and Ask endpoints share one source of truth. A DB-backed store will swap in
behind the same thin interface.
"""
from __future__ import annotations

import threading

from app.models.schemas import Activity, ActivityInput, UserProfile
from app.services.activity import input_to_activity
from app.services import db_store

_LOCK = threading.Lock()
_PROFILES: dict[str, UserProfile] = {}
_ACTIVITIES: dict[str, list[Activity]] = {}
_SYNC: dict[str, dict] = {}
_SYNC_AT: dict[str, str] = {}
# user_id -> account record (password hash + security/OTP/lockout state).
_ACCOUNTS: dict[str, dict] = {}
# user_id -> list of notification archive entries.
_NOTIFICATIONS: dict[str, list[dict]] = {}
# user_id -> list of registered push tokens.
_PUSH_TOKENS: dict[str, list[dict]] = {}

# Default persona mapping for named demo users (cold start without a DB).
_COLD_PERSONAS = {
    "ananya": ["fitness", "health", "commuter"],
    "ramesh": ["agriculture", "commuter"],
    "asha": ["parent", "commuter"],
}


def profile_for(user_id: str, city: str = "pune") -> UserProfile:
    """Get-or-create a canonical profile for a user."""
    if _db_enabled():
        return _run_async(db_store.profile_for, user_id, city)
    with _LOCK:
        prof = _PROFILES.get(user_id)
        if prof is None:
            prof = UserProfile(
                user_id=user_id,
                personas=_COLD_PERSONAS.get(user_id, ["commuter"]),
                saved_locations=[],
            )
            _PROFILES[user_id] = prof
    return prof


def upsert_profile(profile: UserProfile) -> UserProfile:
    if _db_enabled():
        _run_async(db_store.upsert_profile, profile)
        return profile
    with _LOCK:
        _PROFILES[profile.user_id] = profile
    return profile


def list_activities(user_id: str) -> list[Activity]:
    if _db_enabled():
        return _run_async(db_store.list_activities, user_id)
    return list(_ACTIVITIES.get(user_id, []))


def add_activity(user_id: str, inp: ActivityInput) -> Activity:
    if _db_enabled():
        return _run_async(db_store.add_activity, user_id, inp)
    act = input_to_activity(inp, user_id)
    with _LOCK:
        _ACTIVITIES.setdefault(user_id, []).append(act)
    return act


def remove_activity(user_id: str, activity_id: str) -> bool:
    if _db_enabled():
        return _run_async(db_store.remove_activity, user_id, activity_id)
    with _LOCK:
        acts = _ACTIVITIES.get(user_id, [])
        before = len(acts)
        _ACTIVITIES[user_id] = [a for a in acts if a.id != activity_id]
        return len(acts) != before


def _db_enabled() -> bool:
    from app.core.config import settings
    if not bool(getattr(settings, "database_enabled", False)):
        return False
    from app.db import database_available, ensure_probed
    ensure_probed()
    return database_available()


def _run_async(fn, *args):
    """Run an async store call, isolating any running event loop.

    Runs the coroutine in a fresh thread with its own loop so these sync-facing
    helpers (called from both sync and async contexts) never raise
    "asyncio.run() cannot be called from a running event loop".
    """
    import asyncio
    import threading

    out: dict = {}

    def _runner():
        out["result"] = asyncio.run(fn(*args))

    t = threading.Thread(target=_runner, daemon=True)
    t.start()
    t.join()
    if "result" not in out:
        raise RuntimeError("async store call failed")
    return out["result"]


def hydrate_city(user_id: str, city: str | None):
    """Attach a default anchor to the profile if it has none."""
    prof = profile_for(user_id, city or "pune")
    if city and not any(getattr(loc, "name", None) for loc in (prof.saved_locations or [])):
        from app.providers.mock import pick_anchor
        with _LOCK:
            changed = _PROFILES[user_id].model_copy(deep=True)
            changed.saved_locations = [pick_anchor(city)]
            _PROFILES[user_id] = changed
    return _PROFILES[user_id]


# ---- Cross-device profile sync (opaque JSON blob per user) ----

def get_synced_profile(user_id: str) -> dict | None:
    """Return the synced mobile profile for a user, or None if none exists."""
    if _db_enabled():
        return _run_async(db_store.get_synced_profile, user_id)
    with _LOCK:
        data = _SYNC.get(user_id)
        return dict(data) if data else None


def get_synced_updated_at(user_id: str) -> str | None:
    """Return the ISO timestamp of the last profile push for a user."""
    if _db_enabled():
        return _run_async(db_store.get_synced_updated_at, user_id)
    with _LOCK:
        return _SYNC_AT.get(user_id)


def delete_synced_profile(user_id: str) -> bool:
    """Remove the synced mobile profile (and its timestamp) for a user."""
    if _db_enabled():
        return _run_async(db_store.delete_synced_profile, user_id)
    with _LOCK:
        had = user_id in _SYNC
        _SYNC.pop(user_id, None)
        _SYNC_AT.pop(user_id, None)
        return had


def put_synced_profile(user_id: str, data: dict) -> None:
    """Overwrite the synced mobile profile for a user (last-write-wins)."""
    from datetime import datetime, timezone
    if _db_enabled():
        _run_async(db_store.put_synced_profile, user_id, data)
        return
    with _LOCK:
        _SYNC[user_id] = data
        _SYNC_AT[user_id] = datetime.now(timezone.utc).isoformat()


# ---- Mobile account credentials (register / login) ------------------------

def get_account(user_id: str) -> dict | None:
    """Return the full stored account record, or None if never registered."""
    if _db_enabled():
        return _run_async(db_store.get_account, user_id)
    with _LOCK:
        rec = _ACCOUNTS.get(user_id)
        return dict(rec) if rec else None


def get_password_hash(user_id: str) -> str | None:
    """Return the stored password hash for a mobile account, if registered."""
    rec = get_account(user_id)
    return rec.get("password_hash") if rec else None


def set_password_hash(user_id: str, password_hash: str) -> None:
    """Register a mobile account (or overwrite its password hash)."""
    if _db_enabled():
        _run_async(db_store.set_password_hash, user_id, password_hash)
        return
    with _LOCK:
        _ACCOUNTS.setdefault(user_id, {"user_id": user_id}).update({"password_hash": password_hash})


def save_account(user_id: str, fields: dict) -> dict:
    """Merge ``fields`` into a user's account record and return the record."""
    if _db_enabled():
        return _run_async(db_store.save_account, user_id, fields)
    with _LOCK:
        rec = _ACCOUNTS.setdefault(user_id, {"user_id": user_id})
        rec.update(fields)
        return dict(rec)


def get_token_version(user_id: str) -> int:
    """Server-side token version for revocation checks."""
    rec = get_account(user_id)
    return int((rec or {}).get("token_version", 0))


def bump_token_version(user_id: str) -> int:
    """Invalidate every issued token for a user (logout-everywhere / reset)."""
    version = get_token_version(user_id) + 1
    save_account(user_id, {"token_version": version})
    return version


# ---- OTP (email/phone verification + password reset) ------------------------

def request_otp(user_id: str, purpose: str, code_hash: str, ttl_seconds: int) -> None:
    """Store a single active OTP for an account (client controls validation)."""
    from datetime import datetime, timedelta, timezone
    save_account(user_id, {
        "otp_code_hash": code_hash,
        "otp_purpose": purpose,
        "otp_expires_at": (datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)).isoformat(),
        "otp_attempts": 0,
        "otp_verified_flag": None,
        "otp_verified_at": None,
    })


def record_otp_attempt(user_id: str) -> int:
    """Increment the failed-OTP counter; returns the new count."""
    rec = get_account(user_id) or {}
    attempts = int(rec.get("otp_attempts", 0)) + 1
    save_account(user_id, {"otp_attempts": attempts})
    return attempts


def consume_otp(user_id: str, purpose: str) -> None:
    """Clear the OTP state after a successful verification."""
    from datetime import datetime, timezone
    save_account(user_id, {
        "otp_code_hash": None,
        "otp_purpose": None,
        "otp_expires_at": None,
        "otp_attempts": 0,
        "otp_verified_flag": purpose,
        "otp_verified_at": datetime.now(timezone.utc).isoformat(),
    })


def clear_otp(user_id: str) -> None:
    save_account(user_id, {"otp_code_hash": None, "otp_purpose": None,
                           "otp_expires_at": None, "otp_attempts": 0})


# ---- Brute-force lockout ----------------------------------------------------

def register_login_failure(user_id: str) -> int:
    """Increment the failed-login counter; returns the new count."""
    rec = get_account(user_id) or {}
    failures = int(rec.get("failed_logins", 0)) + 1
    save_account(user_id, {"failed_logins": failures})
    return failures


def lock_account(user_id: str, minutes: int) -> None:
    from datetime import datetime, timedelta, timezone
    save_account(user_id, {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()})


def unlock_account(user_id: str) -> None:
    save_account(user_id, {"locked_until": None, "failed_logins": 0,
                           "otp_attempts": 0, "otp_code_hash": None, "otp_purpose": None,
                           "otp_expires_at": None})


def account_locked(user_id: str) -> bool:
    """True while a lockout (from failed logins or OTP attempts) is active."""
    rec = get_account(user_id)
    if not rec or not rec.get("locked_until"):
        return False
    from datetime import datetime
    try:
        locked_until = datetime.fromisoformat(rec["locked_until"])
    except (TypeError, ValueError):
        return False
    return locked_until > datetime.now(locked_until.tzinfo or datetime.now().astimezone().tzinfo)


# ---- Server-side push-token registry ----------------------------------------

def list_push_tokens(user_id: str) -> list[dict]:
    if _db_enabled():
        return _run_async(db_store.list_push_tokens, user_id)
    with _LOCK:
        return [dict(t) for t in _PUSH_TOKENS.get(user_id, [])]


def list_all_push_tokens() -> list[dict]:
    """Every registered device across all users (for broadcasts/geofence fan-out)."""
    if _db_enabled():
        return _run_async(db_store.list_all_push_tokens)
    with _LOCK:
        return [dict(t) for devices in _PUSH_TOKENS.values() for t in devices]


def delete_push_token_all(expo_push_token: str) -> None:
    """Drop a dead device token from every user's registry (Expo said so)."""
    if _db_enabled():
        _run_async(db_store.delete_push_token_all, expo_push_token)
        return
    with _LOCK:
        for user_id in list(_PUSH_TOKENS):
            before = len(_PUSH_TOKENS[user_id])
            _PUSH_TOKENS[user_id] = [
                d for d in _PUSH_TOKENS[user_id] if d["expo_push_token"] != expo_push_token
            ]
            if before != len(_PUSH_TOKENS[user_id]) and not _PUSH_TOKENS[user_id]:
                _PUSH_TOKENS.pop(user_id, None)


def upsert_push_token(user_id: str, platform: str, expo_push_token: str) -> None:
    """Register/unregister a device push token for a user (upsert by token)."""
    from datetime import datetime, timezone
    if _db_enabled():
        _run_async(db_store.upsert_push_token, user_id, platform, expo_push_token)
        return
    with _LOCK:
        devices = _PUSH_TOKENS.get(user_id, [])
        devices = [d for d in devices if d["expo_push_token"] != expo_push_token]
        devices.append({
            "user_id": user_id,
            "platform": platform,
            "expo_push_token": expo_push_token,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        # A user typically owns a handful of devices; cap to avoid unbounded growth.
        _PUSH_TOKENS[user_id] = devices[-10:]


def delete_push_token(user_id: str, expo_push_token: str) -> bool:
    if _db_enabled():
        return _run_async(db_store.delete_push_token, user_id, expo_push_token)
    with _LOCK:
        devices = _PUSH_TOKENS.get(user_id, [])
        before = len(devices)
        _PUSH_TOKENS[user_id] = [d for d in devices if d["expo_push_token"] != expo_push_token]
        return len(devices) != before


def delete_account(user_id: str) -> bool:
    """Full right-to-erasure: account, cloud backup, inbox and push tokens."""
    if _db_enabled():
        return _run_async(db_store.delete_account, user_id)
    with _LOCK:
        had = user_id in _ACCOUNTS
        _ACCOUNTS.pop(user_id, None)
        _SYNC.pop(user_id, None)
        _SYNC_AT.pop(user_id, None)
        _NOTIFICATIONS.pop(user_id, None)
        _PUSH_TOKENS.pop(user_id, None)
        return had


# ---- In-app notification centre / alert archive ------------------------------

def list_notifications(user_id: str) -> list[dict]:
    """Return the user's alert archive, newest first."""
    if _db_enabled():
        return _run_async(db_store.list_notifications, user_id)
    with _LOCK:
        items = list(_NOTIFICATIONS.get(user_id, []))
    items.sort(key=lambda n: n.get("created_at", ""), reverse=True)
    return items


def add_notification(user_id: str, alert_id: str, severity: str, event_type: str,
                     headline: str, body: str, region: str) -> None:
    """Server-side delivery intent: store an alert for a user's inbox."""
    from datetime import datetime, timezone
    if _db_enabled():
        _run_async(db_store.add_notification, user_id, alert_id, severity, event_type,
                   headline, body, region)
        return
    entry = {
        "id": f"n-{len(_NOTIFICATIONS.get(user_id, [])) + 1:x}",
        "user_id": user_id,
        "alert_id": alert_id,
        "severity": severity,
        "event_type": event_type,
        "headline": headline,
        "body": body,
        "region": region,
        "read_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    with _LOCK:
        existing = _NOTIFICATIONS.setdefault(user_id, [])
        # Dedupe: one delivery intent per alert per user.
        if not any(n["alert_id"] == alert_id for n in existing):
            existing.append(entry)


def ack_notification(user_id: str, notification_id: str) -> bool:
    """Mark a notification read. Returns False when it doesn't exist."""
    from datetime import datetime, timezone
    if _db_enabled():
        return _run_async(db_store.ack_notification, user_id, notification_id)
    with _LOCK:
        for n in _NOTIFICATIONS.get(user_id, []):
            if n["id"] == notification_id:
                n["read_at"] = datetime.now(timezone.utc).isoformat()
                return True
        return False