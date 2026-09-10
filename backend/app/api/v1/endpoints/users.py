"""Cross-device profile sync endpoints (authenticated).

A mobile user registers/logs in through /api/v1/auth/* and receives a bearer
token. Pushing or pulling a profile requires that token, and the token's user
must match the user id in the URL — so nobody can read or overwrite another
user's profile.
"""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException

from app.models.schemas import ProfileSync, ProfileSyncOut
from app.services import store
from app.services.tokens import parse_user_token

router = APIRouter(prefix="/api/v1", tags=["users"])


def _require_user(user_id: str, authorization: str | None) -> str:
    token = (authorization or "").removeprefix("Bearer").strip()
    authed = parse_user_token(token)
    if not authed or authed != user_id:
        raise HTTPException(401, "missing or invalid credentials for this user")
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