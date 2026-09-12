"""Tests for the disaster alert / simulation / geofencing service."""
from fastapi.testclient import TestClient

from app.models.schemas import AlertSimulationRequest, GeoPoint, WarningSeverity
from app.services import store, warnings


def test_point_in_polygon_center_true_outsider_false():
    ring = [[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0], [0.0, 0.0]]
    inner = GeoPoint(lat=5.0, lon=5.0)
    outer = GeoPoint(lat=15.0, lon=15.0)
    assert warnings.point_in_polygon(inner, type("P", (), {"coordinates": ring})())
    assert not warnings.point_in_polygon(outer, type("P", (), {"coordinates": ring})())


def test_simulate_pins_pune_users_and_ignores_mumbai():
    warnings.clear_alerts()
    req = AlertSimulationRequest(
        severity=WarningSeverity.ORANGE, event_type="heavy_rain",
        headline="Heavy rain in Pune", region="Pune",
    )
    result = warnings.simulate(req)
    affected = {t.user_id for t in result.affected_users if t.in_polygon}
    assert "ananya" in affected
    assert "meena" not in affected  # Chennai registered user outside Pune ring


def test_list_alerts_after_publish():
    warnings.clear_alerts()
    req = AlertSimulationRequest(severity=WarningSeverity.ORANGE, event_type="heatwave",
                                 headline="Heatwave", region="Delhi")
    warnings.publish(req)
    assert len(warnings.list_alerts()) >= 1
    first = warnings.list_alerts()[0]
    assert first.event_type == "heatwave"


def test_simulate_endpoint_fans_out_to_registered_devices(monkeypatch):
    """A geofenced alert must hit Expo for every in-zone user that registered
    a push token, archive an inbox entry, and never attempt network in tests
    when push is disabled."""
    from app.main import create_app
    from app.api.v1.endpoints import alerts as alerts_endpoint
    from app.services import cache

    cache.clear()
    store.upsert_push_token("ananya", "android", "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]")
    called: dict = {}

    async def fake_send_push(**kwargs):
        called.update(kwargs)
        return {"sent": len(kwargs.get("tokens", [])), "failed": 0}

    monkeypatch.setattr(alerts_endpoint.push_service, "send_push", fake_send_push)
    monkeypatch.setattr("app.core.config.settings.push_enabled", True)

    app = create_app()
    with TestClient(app) as client:
        resp = client.post("/api/v1/alerts/simulate", json={
            "severity": "orange",
            "event_type": "heavy_rain",
            "headline": "Heavy rain in Pune",
            "region": "Pune",
        })
    assert resp.status_code == 200
    # Background push fan-out ran with the affected user's token.
    assert called.get("tokens") == ["ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"]
    assert called.get("data", {}).get("alertId")
    # Durable inbox entry exists for the affected user.
    inbox = store.list_notifications("ananya")
    assert any(n["alert_id"] == resp.json()["alert"]["id"] for n in inbox)


def test_repeat_same_alert_does_not_double_fanout(monkeypatch):
    """Publishing the identical alert twice must not create a second inbox
    entry or a second push within the dedupe window."""
    from app.main import create_app
    from app.services import cache

    from app.api.v1.endpoints import alerts as alerts_endpoint

    async def fake_send_push(**kwargs):
        return {"sent": 0, "failed": 0}

    cache.clear()
    monkeypatch.setattr(alerts_endpoint.push_service, "send_push", fake_send_push)
    monkeypatch.setattr("app.core.config.settings.push_enabled", True)
    store.upsert_push_token("ananya", "android", "ExponentPushToken[yyyyyyyyyyyyyy]")
    payload = {
        "severity": "orange",
        "event_type": "heavy_rain",
        "headline": "Dup alert in Pune",
        "region": "Pune",
    }
    app = create_app()
    with TestClient(app) as client:
        client.post("/api/v1/alerts/simulate", json=payload)
        first_count = len(store.list_notifications("ananya"))
        client.post("/api/v1/alerts/simulate", json=payload)
    assert len(store.list_notifications("ananya")) == first_count


def test_celery_fan_out_task_archives_and_respects_push_disabled(monkeypatch):
    """The worker task (Celery path) archives durable inbox entries without a
    broker and skips Expo delivery when push is disabled."""
    from app.tasks import fan_out_alert

    store.upsert_push_token("ananya", "android", "ExponentPushToken[zzzzzzzz]")
    monkeypatch.setattr("app.core.config.settings.push_enabled", False)
    result = fan_out_alert(
        alert_id="celery-alert-1",
        event_type="cyclone",
        severity="red",
        headline="Cyclone heads for Pune",
        region="Pune",
        detail="winds above 120 km/h",
        user_ids=["ananya"],
    )
    assert result["acknowledged"] == 1
    assert result["sent"] == 0  # push disabled -> no network attempted
    assert any(n["alert_id"] == "celery-alert-1" for n in store.list_notifications("ananya"))