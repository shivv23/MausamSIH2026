"""One-time-password helpers: generation, hashing, contact masking."""
from __future__ import annotations

import hashlib
import secrets

from app.core.config import settings


def generate_code(digits: int = 6) -> str:
    """CSPRNG 6-digit code (0 is allowed as leading digit)."""
    return f"{secrets.randbelow(10 ** digits):0{digits}d}"


def hash_code(code: str, user_id: str) -> str:
    """Server-secret-keyed digest so a leaked DB can't be offline-brute-forced."""
    secret = settings.admin_secret or ("mausam-dev-secret-change-me-" + settings.admin_username)
    return hashlib.sha256(f"{code}:{user_id}:{secret}".encode("utf-8")).hexdigest()


def verify_code(code: str, code_hash: str, user_id: str) -> bool:
    return secrets.compare_digest(hash_code(code, user_id), code_hash)


def mask_contact(contact: str, is_email: bool) -> str:
    if is_email:
        local, _, domain = contact.partition("@")
        visible = local[:2]
        return f"{visible}@{domain}"
    digits = [c for c in contact if c.isdigit()]
    prefix = "+" if contact.startswith("+") else ""
    if len(digits) <= 4:
        return prefix + "*" * len(digits)
    return prefix + "*" * (len(digits) - 4) + "".join(digits[-4:])


def ttl_seconds() -> int:
    return int(settings.otp_ttl_minutes) * 60


def max_attempts() -> int:
    return int(settings.otp_max_attempts)


def lockout_minutes() -> int:
    return int(settings.lockout_minutes)


def login_max_failures() -> int:
    return int(settings.login_max_failures)


def dev_code_allowed() -> bool:
    return settings.environment != "production"