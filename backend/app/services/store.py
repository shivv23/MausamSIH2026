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
_AUTH: dict[str, str] = {}  # user_id -> password hash (mobile accounts)

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
    from app.db import database_available
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
        return dict(_SYNC.get(user_id) or {})


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

def get_password_hash(user_id: str) -> str | None:
    """Return the stored password hash for a mobile account, if registered."""
    if _db_enabled():
        return _run_async(db_store.get_password_hash, user_id)
    with _LOCK:
        return _AUTH.get(user_id)


def set_password_hash(user_id: str, password_hash: str) -> None:
    """Register (or overwrite) the password hash for a mobile account."""
    if _db_enabled():
        _run_async(db_store.set_password_hash, user_id, password_hash)
        return
    with _LOCK:
        _AUTH[user_id] = password_hash