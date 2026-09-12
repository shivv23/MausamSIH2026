"""Mobile account endpoints: register, login, OTP, recovery.

Real authentication for the cross-device profile sync with a production-grade
workflow:

* **register** — user id + password + optional email/phone; contacts can be
  verified later with a one-time password.
* **login** — password check with brute-force lockout (N failures ⇒ temporary
  lock).
* **request-otp / verify-otp** — verify an email/phone contact or request a
  recovery code (reset password).
* **reset-password** — recover an account with a reset OTP; bumps the token
  version so every previously issued token is revoked.
* **logout-all** — revoke every issued token by bumping the token version.

Passwords are stored as pbkdf2_sha256 hashes (never plaintext) and OTP codes
as server-secret-keyed digests with per-account attempt limits.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException, Request

from app.admin.security import hash_password, verify_password
from app.models.schemas import (
    AuthOut,
    LoginRequest,
    OtpOut,
    OtpPurpose,
    OtpRequest,
    OtpVerifyRequest,
    RegisterRequest,
    ResetPasswordRequest,
)
from app.services import otp, store
from app.services.tokens import issue_user_token, parse_user_token

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

_LOCKED = HTTPException(423, "too many attempts; account temporarily locked. try again later")


def _issue(user_id: str, message: str, contact_present: bool) -> AuthOut:
    """Mint a token bound to the account's current token version."""
    version = store.get_token_version(user_id)
    return AuthOut(
        user_id=user_id,
        token=issue_user_token(user_id, version),
        verified=_contact_verified(user_id),
        contact_verification_required=contact_present,
        message=message,
    )


def _contact_verified(user_id: str) -> bool:
    rec = store.get_account(user_id)
    return bool(rec and (rec.get("email_verified") or rec.get("phone_verified")))


@router.post("/register", response_model=AuthOut)
async def register(body: RegisterRequest) -> AuthOut:
    user_id = body.user_id.strip()
    if store.get_password_hash(user_id):
        raise HTTPException(409, "this user id is already registered; log in instead")
    store.set_password_hash(user_id, hash_password(body.password))
    fields: dict = {}
    if body.email:
        fields["email"] = body.email.lower()
    if body.phone:
        fields["phone"] = body.phone
    store.save_account(user_id, fields)
    return _issue(user_id, "registered", contact_present=bool(fields))


@router.post("/login", response_model=AuthOut)
async def login(body: LoginRequest, request: Request) -> AuthOut:
    user_id = body.user_id.strip()
    rec = store.get_account(user_id)
    if rec is None:
        raise HTTPException(404, "no account for this user id; register first")
    if store.account_locked(user_id):
        raise _LOCKED
    if not verify_password(body.password, rec["password_hash"]):
        failures = store.register_login_failure(user_id)
        if failures >= otp.login_max_failures():
            store.lock_account(user_id, otp.lockout_minutes())
            raise _LOCKED
        remain = otp.login_max_failures() - failures
        raise HTTPException(401, f"invalid credentials; {remain} attempt(s) left before lockout")
    store.unlock_account(user_id)
    return _issue(user_id, "logged in", contact_present=bool(rec.get("email") or rec.get("phone")))


@router.post("/logout-all", response_model=AuthOut)
async def logout_all(authorization: str | None = Header(default=None)) -> AuthOut:
    """Revoke every token ever issued for the authenticated account."""
    token = (authorization or "").removeprefix("Bearer").strip()
    payload = parse_user_token(token)
    if payload is None:
        raise HTTPException(401, "missing or invalid credentials")
    user_id = payload["sub"]
    store.bump_token_version(user_id)
    return AuthOut(user_id=user_id, token=issue_user_token(user_id, store.get_token_version(user_id)),
                   message="signed out of every device")


@router.delete("/account")
async def delete_account(authorization: str | None = Header(default=None)) -> dict:
    """Permanently erase the account and every associated record (DPDP erasure).

    Removes the credential, the cloud profile backup, the in-app alert inbox
    and all registered push tokens. The client is expected to also wipe local
    device state after a successful response.
    """
    token = (authorization or "").removeprefix("Bearer").strip()
    payload = parse_user_token(token)
    if payload is None:
        raise HTTPException(401, "missing or invalid credentials")
    user_id = payload["sub"]
    if not store.delete_account(user_id):
        raise HTTPException(404, "no account found for this user")
    return {"ok": True, "deleted": user_id}


# ---- OTP: contact verification + password recovery ---------------------------

@router.post("/request-otp", response_model=OtpOut)
async def request_otp(body: OtpRequest) -> OtpOut:
    user_id = body.user_id.strip()
    rec = store.get_account(user_id)
    if rec is None:
        raise HTTPException(404, "no account for this user id; register first")
    if store.account_locked(user_id):
        raise _LOCKED

    purpose = body.purpose.value
    contact = None
    if purpose == OtpPurpose.VERIFY_EMAIL.value:
        contact = (body.contact or rec.get("email") or "").strip().lower()
        if not contact or "@" not in contact:
            raise HTTPException(400, "no email on file; pass one in `contact` to bind it")
        store.save_account(user_id, {"email": contact})
    elif purpose == OtpPurpose.VERIFY_PHONE.value:
        contact = (body.contact or rec.get("phone") or "").strip()
        if not contact or not contact.replace("+", "").isdigit():
            raise HTTPException(400, "no phone on file; pass one in `contact` to bind it")
        store.save_account(user_id, {"phone": contact})

    code = otp.generate_code()
    store.request_otp(user_id, purpose, otp.hash_code(code, user_id), otp.ttl_seconds())
    # Delivery is wired here (SMTP/SMS providers plug in); the demo mirrors the
    # code into the request log so CI/E2E tests can complete the flow.
    print(f"[OTP] user={user_id} purpose={purpose} code={code}", flush=True)
    return OtpOut(
        user_id=user_id,
        purpose=body.purpose,
        sent_to=otp.mask_contact(contact, "@" in contact) if contact else None,
        ttl_minutes=otp.ttl_seconds() // 60,
        dev_code=code if otp.dev_code_allowed() else None,
    )


def _verify_pending(user_id: str, purpose: str) -> str:
    """Validate a pending OTP belongs to this user/purpose. Returns the hash."""
    rec = store.get_account(user_id)
    if rec is None:
        raise HTTPException(404, "no account for this user id")
    if rec.get("otp_purpose") != purpose or not rec.get("otp_code_hash"):
        raise HTTPException(400, "no pending otp for this purpose")
    try:
        expires = datetime.fromisoformat(rec["otp_expires_at"])
    except (TypeError, ValueError, KeyError):
        raise HTTPException(400, "otp session is invalid") from None
    now = datetime.now(expires.tzinfo or timezone.utc)
    if expires < now:
        store.clear_otp(user_id)
        raise HTTPException(410, "otp expired; request a new one")
    return rec["otp_code_hash"]


def _check_code(user_id: str, purpose: str, code: str) -> None:
    """Verify + optionally lock on repeated failures (brute-force ladder)."""
    code_hash = _verify_pending(user_id, purpose)
    if store.account_locked(user_id):
        raise _LOCKED
    if not otp.verify_code(code, code_hash, user_id):
        attempts = store.record_otp_attempt(user_id)
        if attempts >= otp.max_attempts():
            store.lock_account(user_id, otp.lockout_minutes())
            store.clear_otp(user_id)
            raise _LOCKED
        raise HTTPException(401, f"invalid code; {otp.max_attempts() - attempts} attempt(s) left")
    store.consume_otp(user_id, purpose)


@router.post("/verify-otp", response_model=AuthOut)
async def verify_otp(body: OtpVerifyRequest) -> AuthOut:
    user_id = body.user_id.strip()
    purpose = body.purpose.value
    if purpose == OtpPurpose.RESET_PASSWORD.value:
        raise HTTPException(400, "use /auth/reset-password to recover an account")
    _check_code(user_id, purpose, body.code)
    flag = "email_verified" if purpose == OtpPurpose.VERIFY_EMAIL.value else "phone_verified"
    store.save_account(user_id, {flag: True})
    rec = store.get_account(user_id)
    return AuthOut(
        user_id=user_id,
        token=issue_user_token(user_id, store.get_token_version(user_id)),
        verified=_contact_verified(user_id),
        contact_verification_required=bool(rec and (rec.get("email") or rec.get("phone"))),
        message="code verified",
    )


@router.post("/reset-password", response_model=AuthOut)
async def reset_password(body: ResetPasswordRequest, request: Request) -> AuthOut:
    """Recover an account with a reset OTP; invalidates all prior tokens."""
    user_id = body.user_id.strip()
    rec = store.get_account(user_id)
    if rec is None:
        raise HTTPException(404, "no account for this user id")
    _check_code(user_id, OtpPurpose.RESET_PASSWORD.value, body.code)
    store.set_password_hash(user_id, hash_password(body.new_password))
    version = store.bump_token_version(user_id)
    store.unlock_account(user_id)
    return AuthOut(user_id=user_id, token=issue_user_token(user_id, version),
                   verified=_contact_verified(user_id),
                   contact_verification_required=bool(rec.get("email") or rec.get("phone")),
                   message="password reset; other sessions revoked")