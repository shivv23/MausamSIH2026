"""Authenticated user endpoints: profile sync, push tokens, notification inbox.

A mobile user registers/logs in through /api/v1/auth/* and receives a bearer
token. Every endpoint here requires that token, whose user must match the id in
the URL, and the token's version must equal the account's current token version
(so "log out everywhere" and password resets instantly revoke stale tokens).
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException

from app.models.schemas import (
    AccountExportOut,
    AppNotification,
    NotificationListOut,
    ProfileSync,
    ProfileSyncOut,
    PushTokenIn,
    WarningSeverity,
)
from app.services import store
from app.services.tokens import validate_user_token

router = APIRouter(prefix="/api/v1", tags=["users"])


def _require_user(user_id: str, authorization: str | None) -> str:
    token = (authorization or "").removeprefix("Bearer").strip()
    authed = validate_user_token(token, store.get_token_version(user_id))
    if not authed or authed != user_id:
        raise HTTPException(401, "missing, invalid, or revoked credentials for this user")
    return authed


@router.get("/users/{user_id}/profile", response_model=ProfileSyncOut)
async def get_profile(user_id: str,
                      authorization: str | None = Header(default=None)) -> ProfileSyncOut:
    _require_user(user_id, authorization)
    data = store.get_synced_profile(user_id)
    if data is None:
        raise HTTPException(404, "no synced profile for this user yet")
    updated_at = store.get_synced_updated_at(user_id)
    return ProfileSyncOut(user_id=user_id, profile=ProfileSync(**data), updated_at=updated_at)


@router.put("/users/{user_id}/profile", response_model=ProfileSyncOut)
async def put_profile(user_id: str, body: ProfileSync,
                      authorization: str | None = Header(default=None)) -> ProfileSyncOut:
    _require_user(user_id, authorization)
    # Enforce that the id on the payload matches the URL (defensive).
    if body.id != user_id:
        raise HTTPException(400, "profile.id must equal the user id")
    store.put_synced_profile(user_id, body.model_dump())
    return ProfileSyncOut(user_id=user_id, profile=body,
                          updated_at=store.get_synced_updated_at(user_id))


@router.delete("/users/{user_id}/profile")
async def delete_profile(user_id: str,
                         authorization: str | None = Header(default=None)) -> dict:
    """Permanently remove this user's cloud backup (right-to-erasure)."""
    _require_user(user_id, authorization)
    if not store.delete_synced_profile(user_id):
        raise HTTPException(404, "no synced profile for this user")
    return {"ok": True, "deleted": user_id}


# ---- Push-token registry -----------------------------------------------------

@router.post("/users/{user_id}/push-token")
async def register_push_token(user_id: str, body: PushTokenIn,
                              authorization: str | None = Header(default=None)) -> dict:
    """Register the device's Expo/FCM push token for server->device alerts."""
    _require_user(user_id, authorization)
    store.upsert_push_token(user_id, body.platform, body.token)
    return {"ok": True, "registered": True}


@router.delete("/users/{user_id}/push-token")
async def unregister_push_token(user_id: str, body: PushTokenIn,
                                authorization: str | None = Header(default=None)) -> dict:
    _require_user(user_id, authorization)
    store.delete_push_token(user_id, body.token)
    return {"ok": True, "registered": False}


# ---- In-app notification centre / alert archive ------------------------------

@router.get("/users/{user_id}/notifications", response_model=NotificationListOut)
async def list_notifications(user_id: str,
                             authorization: str | None = Header(default=None)) -> NotificationListOut:
    """The durable alert inbox for this user (server-side archive)."""
    _require_user(user_id, authorization)
    items = store.list_notifications(user_id)
    out = [
        AppNotification(
            id=n["id"], alert_id=n["alert_id"],
            severity=WarningSeverity(n["severity"]),
            event_type=n["event_type"], headline=n["headline"],
            body=n["body"], region=n["region"],
            read=bool(n.get("read_at")), created_at=n["created_at"],
        )
        for n in items
    ]
    return NotificationListOut(user_id=user_id, unread=sum(1 for i in out if not i.read), items=out)


@router.post("/users/{user_id}/notifications/{notification_id}/ack")
async def ack_notification(user_id: str, notification_id: str,
                           authorization: str | None = Header(default=None)) -> dict:
    """Mark a single archive entry as read (clears its unread badge)."""
    _require_user(user_id, authorization)
    if not store.ack_notification(user_id, notification_id):
        raise HTTPException(404, "no such notification for this user")
    return {"ok": True, "read": True}


# ---- DPDP portability ---------------------------------------------------------

_ACCOUNT_EXPORT_SENSITIVE = {"password_hash", "otp_code_hash"}


@router.get("/users/{user_id}/export", response_model=AccountExportOut)
async def export_account(user_id: str,
                         authorization: str | None = Header(default=None)) -> AccountExportOut:
    """Portability export: every record the service holds for this account.

    Returns profile, settings, inbox and push registrations in machine-readable
    JSON so the user can exercise DPDP §8(5) portability. Credential material
    (password/OTP hashes) is never included.
    """
    _require_user(user_id, authorization)
    account = store.get_account(user_id) or {}
    safe_account = {k: v for k, v in account.items()
                    if k not in _ACCOUNT_EXPORT_SENSITIVE}
    return AccountExportOut(
        user_id=user_id,
        generated_at=datetime.now(timezone.utc).isoformat(),
        account=safe_account,
        profile=store.get_synced_profile(user_id),
        notifications=store.list_notifications(user_id),
        push_tokens=[
            {"platform": t["platform"], "expo_push_token": t["expo_push_token"]}
            for t in store.list_push_tokens(user_id)
        ],
    )