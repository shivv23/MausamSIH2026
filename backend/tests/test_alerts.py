"""Tests for the disaster alert / simulation / geofencing service."""
from app.models.schemas import AlertSimulationRequest, GeoPoint, WarningSeverity
from app.services import warnings


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