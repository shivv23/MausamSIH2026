"""Security helpers: password hashing + signed session cookies.

Uses passlib's ``pbkdf2_sha256`` (verified working with this interpreter) for
password hashing, and stdlib HMAC-SHA256 for signing session cookies. No
credentials are embedded in source; the signing secret comes from settings.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from passlib.hash import pbkdf2_sha256

from app.core.config import settings


def hash_password(password: str) -> str:
    return pbkdf2_sha256.hash(password)


def verify_password(password: str, hash_: str) -> bool:
    try:
        return pbkdf2_sha256.verify(password, hash_)
    except ValueError:
        return False


# ---- signed session cookie -------------------------------------------------

def _secret() -> bytes:
    secret = settings.admin_secret
    if not secret:
        # Fall back to a derived secret so the dev build works out of the box,
        # but DO NOT do this in production (set ADMIN_SECRET in .env).
        secret = "mausam-dev-secret-change-me-" + settings.admin_username
    return secret.encode("utf-8")


def issue_session(admin_id: str, display_name: str | None = None) -> str:
    """Return a base64, HMAC-signed session token (the cookie value)."""
    payload = {
        "admin_id": admin_id,
        "display_name": display_name,
        "exp": int(time.time()) + settings.admin_session_hours * 3600,
    }
    raw = json.dumps(payload, separators=(",", ":"))
    body = base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")
    sig = _sign(body)
    return f"{body}.{sig}"


def parse_session(token: str) -> dict | None:
    """Validate + decode a session token. Returns payload or None if invalid."""
    if not token or "." not in token:
        return None
    body, sig = token.rsplit(".", 1)
    if not hmac.compare_digest(_sign(body), sig):
        return None
    try:
        raw = base64.urlsafe_b64decode(body.encode("ascii")).decode("utf-8")
        payload = json.loads(raw)
    except Exception:
        return None
    if int(payload.get("exp", 0)) < int(time.time()):
        return None
    return payload


def _sign(body: str) -> str:
    digest = hmac.new(_secret(), body.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii")


def cookie_max_age() -> int:
    return settings.admin_session_hours * 3600