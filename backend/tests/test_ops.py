"""Ops-surface tests: /health, /metrics counters, and the CORS posture.

Only the browser-delivered demo/admin console sends an Origin, so CORS is the
gatekeeper for cross-origin browser calls. Native mobile clients are never
affected by it.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app, create_app
from app.services import metrics

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["storage"] in ("postgres", "memory")


def test_metrics_endpoint_scrapeable():
    r = client.get("/metrics")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/plain")
    assert "mausam_uptime_seconds" in r.text
    assert "mausam_storage" in r.text
    assert "mausam_redis_available" in r.text


def test_metrics_counters_record_requests():
    metrics.reset()
    client.get("/this-path-does-not-exist")
    body = client.get("/metrics").text
    assert 'path="/this-path-does-not-exist"' in body
    assert 'status="404"' in body


def test_metrics_skips_its_own_paths():
    metrics.reset()
    client.get("/health")
    client.get("/metrics")
    assert 'path="/health"' not in client.get("/metrics").text
    assert 'path="/metrics"' not in client.get("/metrics").text


def test_cors_secure_default_blocks_browser():
    r = client.get("/health", headers={"origin": "http://evil.example"})
    assert "access-control-allow-origin" not in r.headers


def test_cors_middleware_mounted_when_origins_configured(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "cors_allow_origins", "http://localhost:5173")
    app2 = create_app()
    with TestClient(app2) as c2:
        r = c2.get("/health", headers={"origin": "http://localhost:5173"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"
    with TestClient(app2) as c2:
        r = c2.get("/health", headers={"origin": "http://evil.example"})
    assert "access-control-allow-origin" not in r.headers


@pytest.mark.parametrize("client_ip", ["10.0.2.2", "192.168.1.50", "::1"])
def test_mobile_clients_unaffected_by_cors(client_ip):
    r = client.get("/health", headers={"x-forwarded-for": client_ip})
    assert r.status_code == 200