"""Mobile account endpoints: register + login.

Real authentication for the cross-device profile sync: a user registers a
user id + password once, then identifies with a bearer token on every push
or pull. Passwords are stored as pbkdf2_sha256 hashes (never plaintext).
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.admin.security import hash_password, verify_password
from app.models.schemas import AuthOut, LoginRequest, RegisterRequest
from app.services import store
from app.services.tokens import issue_user_token

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=AuthOut)
async def register(body: RegisterRequest) -> AuthOut:
    user_id = body.user_id.strip()
    if store.get_password_hash(user_id):
        raise HTTPException(409, "this user id is already registered; log in instead")
    store.set_password_hash(user_id, hash_password(body.password))
    return AuthOut(user_id=user_id, token=issue_user_token(user_id), message="registered")


@router.post("/login", response_model=AuthOut)
async def login(body: LoginRequest) -> AuthOut:
    user_id = body.user_id.strip()
    stored = store.get_password_hash(user_id)
    if stored is None:
        raise HTTPException(404, "no account for this user id; register first")
    if not verify_password(body.password, stored):
        raise HTTPException(401, "invalid credentials")
    return AuthOut(user_id=user_id, token=issue_user_token(user_id), message="logged in")