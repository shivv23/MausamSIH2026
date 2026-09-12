"""Stateless, HMAC-signed bearer tokens for mobile API authentication.

Payload carries ``sub`` (user id), ``v`` (token version, matching the server's
current version for the account) and ``exp``. Bumping an account's token
version revokes every previously issued token, giving real server-side
"log out everywhere" and post-reset invalidation without a token server.
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


def issue_user_token(user_id: str, token_version: int = 0) -> str:
    """Return a signed bearer token for ``settings.api_token_hours``."""
    payload = {
        "sub": user_id,
        "v": int(token_version),
        "exp": int(time.time()) + settings.api_token_hours * 3600,
    }
    raw = json.dumps(payload, separators=(",", ":"))
    body = base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")
    return f"{body}.{_sign(body)}"


def parse_user_token(token: str | None) -> dict | None:
    """Validate + decode a user token. Returns the payload or None."""
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
    return payload


def validate_user_token(token: str | None, expected_version: int) -> str | None:
    """Like :func:`parse_user_token` but also requires the token version to
    match the server's current version for the account.

    Returns the user id when the token is cryptographically valid, unexpired
    AND not revoked by a version bump; otherwise None.
    """
    payload = parse_user_token(token)
    if payload is None:
        return None
    if int(payload.get("v", -1)) != int(expected_version):
        return None
    sub = payload.get("sub")
    return sub if isinstance(sub, str) else None