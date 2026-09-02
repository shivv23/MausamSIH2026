"""Tests for My Day activity engine + Ask Mausam + Weather Risk."""
from datetime import datetime, timezone

from app.models.schemas import (
    Activity,
    ActivityInput,
    ActivityType,
    GeoPoint,
    Provenance,
    ProviderName,
    UserProfile,
    WeatherData,
    WeatherParameters,
)
from app.services.activity import build_my_day, grade_activity, input_to_activity
from app.services.ask import answer_intent, classify
from app.services.risk import risk_for


def _w(**overrides) -> WeatherData:
    pars = {
        "temperature_c": 26.0, "feels_like_c": 26.0, "humidity_pct": 60.0,
        "wind_speed_kmh": 10.0, "wind_gust_kmh": 12.0, "wind_direction_deg": 0.0,
        "precipitation_mm_h": 0.0, "rain_probability_pct": 10.0, "visibility_km": 10.0,
        "uv_index": 5.0, "aqi": 60, "pm25": 35.0, "soil_moisture_pct": 45.0,
    }
    pars.update(overrides)
    now = datetime.now(timezone.utc)
    return WeatherData(
        location=GeoPoint(lat=18.5, lon=73.8, name="Pune"),
        ts=now, provider=ProviderName.MOCK, data_type="current",
        parameters=WeatherParameters(**pars),
        provenance=Provenance(source=ProviderName.MOCK, issued_at=now,
                              valid_from=now, valid_until=now),
    )


def test_grade_activity_returns_sorted_windows():
    act = Activity(id="a1", type=ActivityType.RUN, days=[])
    slots = grade_activity(act, _w())
    assert len(slots) >= 3
    # sorted descending by score and within 0-100
    scores = [s.score for s in slots]
    assert scores == sorted(scores, reverse=True)
    assert all(0 <= s.score <= 100 for s in slots)


def test_best_window_respects_preferred_range():
    act = Activity(id="a1", type=ActivityType.RUN, days=[], preferred_start="06:00", preferred_end="09:00")
    slots = grade_activity(act, _w())
    hours = {int(s.start[:2]) for s in slots}
    assert all(6 <= h <= 9 for h in hours)


def test_build_my_day_empty_gives_placeholder():
    md = build_my_day(UserProfile(user_id="u"), _w(), [])
    assert md.slots == []
    assert md.best_window == "—"


def test_input_to_activity_creates_ids():
    act = input_to_activity(ActivityInput(type=ActivityType.RUN, label="Run"), "u")
    assert act.id.startswith("u-")
    assert act.label == "Run"


def test_classify_run_intent():
    assert classify("should I go for a run?") == "should_i_run"


def test_answer_intent_run_is_explainable():
    answer, why, score, level = answer_intent("should_i_run", _w(), None)
    assert answer
    assert len(why) >= 1
    assert score is not None
    assert level


def test_risk_for_beach_returns_factors():
    r = risk_for("beach swim", _w(wave_height_m=1.0, uv_index=8), None, include_slots=True)
    assert r["activity"] == "beach"
    assert "factors" in r and "best_window" in r


# --- IMD provider normalizer -------------------------------------------------

def test_imd_normalizer_maps_payload():
    from app.providers.imd import IMDProvider
    from app.models.schemas import GeoPoint

    class FakeResp:
        def raise_for_status(self):
            return None

        def json(self):
            return {"temperature_c": 31.5, "humidity": 70.0, "aqi": 122, "uv": 9}

    class FakeClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def get(self, *a, **k):
            return FakeResp()

    prov = IMDProvider(client=FakeClient(5))
    w = prov._normalize(GeoPoint(lat=18.5, lon=73.8, name="Pune"),
                        {"temperature_c": 31.5, "humidity": 70.0, "aqi": 122, "uv": 9}, "current")
    assert w.parameters.temperature_c == 31.5
    assert w.parameters.aqi == 122
    assert w.provider.value == "imd"

    # offline demo still resolves through the mock (IMD not enabled by default).
    import asyncio
    from app.providers.mock import make_registry
    reg = make_registry("clear", "pune")

    async def _g():
        return await reg.get(GeoPoint(lat=18.5, lon=73.8, name="Pune"), "current")

    got = asyncio.run(_g())
    assert got.provider.value == "mock"