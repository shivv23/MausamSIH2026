"""Endpoint tests for cross-device profile sync (auth + updated_at + erasure)."""
from fastapi.testclient import TestClient

from app.main import app
from app.services import store
from app.services.tokens import issue_user_token

client = TestClient(app)


def _auth_header(user_id: str) -> dict:
    return {"Authorization": f"Bearer {issue_user_token(user_id)}"}


# Run against the deterministic in-memory store (the offline demo's data layer);
# the optional Postgres branch is exercised by integration tests elsewhere.
store._db_enabled = lambda: False


def test_profile_push_pull_delete_roundtrip():
    user_id = "roundtrip_test"
    headers = _auth_header(user_id)
    body = {
        "id": user_id,
        "name": "Round Trip",
        "name_hi": "राउंड ट्रिप",
        "personas": ["commuter"],
        "conditions": [],
        "activities": [],
        "locations": [{"type": "home", "label": "Pune"}],
        "city": "pune",
        "language": "en",
    }

    # nothing yet -> 404
    r = client.get(f"/api/v1/users/{user_id}/profile", headers=headers)
    assert r.status_code == 404

    # push
    r = client.put(f"/api/v1/users/{user_id}/profile", headers=headers, json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["profile"]["name"] == "Round Trip"
    assert data["updated_at"], "updated_at must be set after a push"

    # pull reflects the push, with the timestamp
    r = client.get(f"/api/v1/users/{user_id}/profile", headers=headers)
    assert r.status_code == 200
    assert r.json()["updated_at"] == data["updated_at"]

    # wrong user id in payload is rejected
    bad = {**body, "id": "someone_else"}
    r = client.put(f"/api/v1/users/{user_id}/profile", headers=headers, json=bad)
    assert r.status_code == 400

    # delete erases the backup
    r = client.delete(f"/api/v1/users/{user_id}/profile", headers=headers)
    assert r.status_code == 200
    assert r.json()["deleted"] == user_id
    r = client.get(f"/api/v1/users/{user_id}/profile", headers=headers)
    assert r.status_code == 404


def test_profile_endpoints_require_auth():
    user_id = "noauth_test"
    r = client.get(f"/api/v1/users/{user_id}/profile")
    assert r.status_code == 401
    r = client.put(f"/api/v1/users/{user_id}/profile", json={"id": user_id, "name": "x"})
    assert r.status_code == 401
    r = client.delete(f"/api/v1/users/{user_id}/profile")
    assert r.status_code == 401


def test_cannot_touch_another_users_profile():
    victim = "victim_test"
    headers = _auth_header(victim)
    client.put(
        f"/api/v1/users/{victim}/profile", headers=headers,
        json={"id": victim, "name": "V", "personas": [], "conditions": [],
              "activities": [], "locations": [], "city": "pune", "language": "en"},
    )
    other = _auth_header("attacker_test")
    assert client.get(f"/api/v1/users/{victim}/profile", headers=other).status_code == 401
    assert client.delete(f"/api/v1/users/{victim}/profile", headers=other).status_code == 401
    r = client.delete(f"/api/v1/users/{victim}/profile", headers=headers)
    assert r.status_code == 200