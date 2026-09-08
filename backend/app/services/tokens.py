"""Stateless, HMAC-signed bearer tokens for mobile API authentication.

Mirrors the admin session-cookie scheme: a base64url JSON payload with an
``exp`` claim, signed with HMAC-SHA256. Tokens verify fine across uvicorn
restarts because they are stateless (the signing secret comes from settings).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from app.core.config import settings


def _secret() -> bytes:
    secret = settings.admin_secret or ("mausam-dev-secret-change-me-" + settings.admin_username)
    return secret.encode("utf-8")


def _sign(body: str) -> str:
    digest = hmac.new(_secret(), body.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii")


def issue_user_token(user_id: str) -> str:
    """Return a signed bearer token valid for ``settings.api_token_hours``."""
    payload = {"sub": user_id, "exp": int(time.time()) + settings.api_token_hours * 3600}
    raw = json.dumps(payload, separators=(",", ":"))
    body = base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")
    return f"{body}.{_sign(body)}"


def parse_user_token(token: str | None) -> str | None:
    """Validate + decode a user token. Returns the user id, or None when invalid."""
    if not token or "." not in token:
        return None
    body, sig = token.rsplit(".", 1)
    if not hmac.compare_digest(_sign(body), sig):
        return None
    try:
        payload = json.loads(base64.urlsafe_b64decode(body.encode("ascii")).decode("utf-8"))
    except Exception:
        return None
    if int(payload.get("exp", 0)) < int(time.time()):
        return None
    sub = payload.get("sub")
    return sub if isinstance(sub, str) else None