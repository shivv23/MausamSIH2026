"""Tests for mobile-account security: OTP, brute-force lockout, token
versioning (logout-everywhere), reset-password recovery, rate limiting, the
in-app notification archive and push-token registration.

Run against the deterministic in-memory store (same as test_profile_sync.py).
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import store
from app.services.tokens import issue_user_token

client = TestClient(app)
# Deterministic in-memory data layer for these tests.
store._db_enabled = lambda: False


@pytest.fixture(autouse=True)
def _clean_state():
    store._ACCOUNTS.clear()
    store._NOTIFICATIONS.clear()
    store._PUSH_TOKENS.clear()
    limiter = getattr(app.state, "rate_limiter", None)
    if limiter is not None:
        limiter.reset()
    yield
    if limiter is not None:
        limiter.reset()


def _register(user_id: str, password: str = "secret123", **extra) -> dict:
    body = {"user_id": user_id, "password": password, **extra}
    r = client.post("/api/v1/auth/register", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---- OTP: email / phone verification ----------------------------------------

def test_register_with_email_requests_verification():
    out = _register("bob_otp", email="bob@example.com")
    assert out["contact_verification_required"] is True
    assert out["verified"] is False


def test_verify_email_otp_roundtrip():
    _register("alice_otp", email="alice@example.com")
    r = client.post("/api/v1/auth/request-otp",
                    json={"user_id": "alice_otp", "purpose": "verify_email"})
    assert r.status_code == 200, r.text
    dev_code = r.json()["dev_code"]
    assert len(dev_code) == 6 and dev_code.isdigit()
    assert r.json()["sent_to"] == "al@example.com"  # masked keeps domain
    assert r.json()["ttl_minutes"] == 10

    r = client.post("/api/v1/auth/verify-otp",
                    json={"user_id": "alice_otp", "purpose": "verify_email", "code": dev_code})
    assert r.status_code == 200, r.text
    assert r.json()["verified"] is True
    # a verified contact's token can drive protected endpoints
    token = r.json()["token"]
    r = client.put("/api/v1/users/alice_otp/profile", headers=_header(token),
                   json={"id": "alice_otp", "name": "Alice", "personas": [], "conditions": [],
                         "activities": [], "locations": [], "city": "pune", "language": "en"})
    assert r.status_code == 200


def test_verify_phone_otp_and_bind_contact():
    _register("carol_otp")
    r = client.post("/api/v1/auth/request-otp",
                    json={"user_id": "carol_otp", "purpose": "verify_phone",
                          "contact": "+919876543210"})
    assert r.status_code == 200, r.text
    assert r.json()["sent_to"].endswith("3210")
    r = client.post("/api/v1/auth/verify-otp",
                    json={"user_id": "carol_otp", "purpose": "verify_phone",
                          "code": r.json()["dev_code"]})
    assert r.status_code == 200, r.text
    assert r.json()["verified"] is True


def test_wrong_otp_then_lockout():
    _register("dave_otp", email="dave@example.com")
    r = client.post("/api/v1/auth/request-otp",
                    json={"user_id": "dave_otp", "purpose": "verify_email"})
    assert r.status_code == 200
    # 5 wrong codes -> lock (the 5th attempt itself trips the lockout ladder)
    for i in range(4):
        r = client.post("/api/v1/auth/verify-otp",
                        json={"user_id": "dave_otp", "purpose": "verify_email",
                              "code": "000000"})
        assert r.status_code == 401, (i, r.text)
    r = client.post("/api/v1/auth/verify-otp",
                    json={"user_id": "dave_otp", "purpose": "verify_email", "code": "111111"})
    assert r.status_code == 423


def test_otp_marked_used_after_verify():
    _register("erin_otp", email="erin@example.com")
    code = client.post("/api/v1/auth/request-otp",
                       json={"user_id": "erin_otp", "purpose": "verify_email"}).json()["dev_code"]
    r = client.post("/api/v1/auth/verify-otp",
                    json={"user_id": "erin_otp", "purpose": "verify_email", "code": code})
    assert r.status_code == 200
    r = client.post("/api/v1/auth/verify-otp",
                    json={"user_id": "erin_otp", "purpose": "verify_email", "code": code})
    assert r.status_code == 400  # single-use


# ---- Brute-force login protection -------------------------------------------

def test_login_brute_force_locks_account():
    _register("bob_login", password="secret123")
    for i in range(4):
        r = client.post("/api/v1/auth/login",
                        json={"user_id": "bob_login", "password": "wrong"})
        assert r.status_code == 401, (i, r.text)
    # 5th failure trips the lockout
    r = client.post("/api/v1/auth/login",
                    json={"user_id": "bob_login", "password": "wrong"})
    assert r.status_code == 423 or r.status_code == 401, r.text
    # even the correct password is rejected while locked
    r = client.post("/api/v1/auth/login",
                    json={"user_id": "bob_login", "password": "secret123"})
    assert r.status_code == 423


def test_login_unknown_user_404():
    assert client.post("/api/v1/auth/login",
                       json={"user_id": "nobody_here", "password": "x"}).status_code == 404


# ---- Token versioning: logout-everywhere + reset invalidation ---------------

def test_logout_all_revokes_previous_tokens():
    token = _register("grace_sec", password="secret123")["token"]
    r = client.put("/api/v1/users/grace_sec/profile", headers=_header(token),
                   json={"id": "grace_sec", "name": "G", "personas": [], "conditions": [],
                         "activities": [], "locations": [], "city": "pune", "language": "en"})
    assert r.status_code == 200

    logout = client.post("/api/v1/auth/logout-all", headers=_header(token))
    assert logout.status_code == 200, logout.text
    new_token = logout.json()["token"]

    # old token is revoked server-side
    r = client.get("/api/v1/users/grace_sec/profile", headers=_header(token))
    assert r.status_code == 401
    # freshly minted token still works
    r = client.get("/api/v1/users/grace_sec/profile", headers=_header(new_token))
    assert r.status_code == 200


def test_reset_password_revokes_tokens_and_allows_new_login():
    token = _register("harry_reset", password="oldpass1", email="harry@example.com")["token"]
    assert client.get("/api/v1/users/harry_reset/profile", headers=_header(token)).status_code == 404

    code = client.post("/api/v1/auth/request-otp",
                       json={"user_id": "harry_reset", "purpose": "reset_password"}).json()["dev_code"]
    r = client.post("/api/v1/auth/reset-password",
                    json={"user_id": "harry_reset", "code": code, "new_password": "newpass99"})
    assert r.status_code == 200, r.text
    # previous token revoked
    assert client.get("/api/v1/users/harry_reset/profile", headers=_header(token)).status_code == 401
    # old password fails, new one logs in
    assert client.post("/api/v1/auth/login",
                       json={"user_id": "harry_reset", "password": "oldpass1"}).status_code == 401
    r = client.post("/api/v1/auth/login",
                    json={"user_id": "harry_reset", "password": "newpass99"})
    assert r.status_code == 200
    assert client.get("/api/v1/users/harry_reset/profile", headers=_header(r.json()["token"])).status_code == 404


# ---- Rate limiting -----------------------------------------------------------

def test_auth_rate_limited_after_burst():
    limiter = app.state.rate_limiter
    limiter.max_requests = 3
    try:
        for i in range(3):
            r = client.post("/api/v1/auth/register",
                            json={"user_id": f"burst_user_{i}", "password": "secret123"})
            assert r.status_code == 200
        r = client.post("/api/v1/auth/register",
                        json={"user_id": "burst_user_4", "password": "secret123"})
        assert r.status_code == 429
        assert "Retry-After" in r.headers
    finally:
        limiter.max_requests = 1000
        limiter.reset()


# ---- In-app notification archive + push tokens -------------------------------

def test_alert_simulation_fills_inbox_and_ack():
    r = client.post("/api/v1/alerts/simulate",
                    json={"severity": "orange", "event_type": "heavy_rain",
                          "headline": "Heavy rain in Pune", "region": "Pune",
                          "valid_hours": 24})
    assert r.status_code == 200, r.text

    inbox = client.get("/api/v1/users/ananya/notifications", headers=_header(issue_user_token("ananya")))
    assert inbox.status_code == 200
    items = inbox.json()["items"]
    assert len(items) >= 1
    assert inbox.json()["unread"] >= 1
    first = items[0]
    assert first["read"] is False

    ack = client.post(f"/api/v1/users/ananya/notifications/{first['id']}/ack",
                      headers=_header(issue_user_token("ananya")))
    assert ack.status_code == 200
    inbox = client.get("/api/v1/users/ananya/notifications", headers=_header(issue_user_token("ananya")))
    assert inbox.json()["unread"] == 0


def test_push_token_register_unregister():
    r = client.post("/api/v1/users/ivy_push/push-token",
                    headers=_header(issue_user_token("ivy_push")),
                    json={"token": "ExponentPushToken[deadbeef123456]x", "platform": "android"})
    assert r.status_code == 200, r.text
    assert store.list_push_tokens("ivy_push")[0]["expo_push_token"] == "ExponentPushToken[deadbeef123456]x"
    r = client.request(
        "DELETE", "/api/v1/users/ivy_push/push-token",
        headers=_header(issue_user_token("ivy_push")),
        json={"token": "ExponentPushToken[deadbeef123456]x", "platform": "android"})
    assert r.status_code == 200
    assert store.list_push_tokens("ivy_push") == []


# ---- DPDP portability export --------------------------------------------------

def test_export_account_returns_portable_dump_without_credentials():
    store.set_password_hash("export_user", "not-a-real-hash")
    store.put_synced_profile("export_user", {
        "id": "export_user", "name": "Export User", "city": "pune",
        "personas": ["fitness"], "conditions": [],
        "activities": [], "locations": [], "language": "en", "behavior_bias": {},
    })
    r = client.get("/api/v1/users/export_user/export",
                   headers=_header(issue_user_token("export_user")))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user_id"] == "export_user"
    assert body["profile"]["name"] == "Export User"
    assert "password_hash" not in body["account"]
    assert "otp_code_hash" not in body["account"]
    assert "generated_at" in body and "schema_version" in body


def test_export_account_rejects_foreign_or_missing_token():
    store.set_password_hash("export_foreign", "x")
    # Wrong user's token -> 401
    r = client.get("/api/v1/users/export_foreign/export",
                   headers=_header(issue_user_token("somebody_else")))
    assert r.status_code == 401
    # No token at all -> 401
    r = client.get("/api/v1/users/export_foreign/export")
    assert r.status_code == 401