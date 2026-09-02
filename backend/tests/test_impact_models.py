"""Boundary tests for the explainable impact models (data-driven thresholds)."""
from datetime import datetime, timezone


from app.models.schemas import GeoPoint, WeatherData, WeatherParameters, Provenance, ProviderName
from app.services.impact_models import running_score, beach_score, garden_irrigation_score


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


def test_running_excellent_at_ideal_conditions():
    s = running_score(_w(temperature_c=21.5, aqi=45, humidity_pct=55,
                         wind_speed_kmh=8, uv_index=3, rain_probability_pct=5))
    assert s.score >= 88
    assert s.level == "Excellent"


def test_running_degrades_with_poor_aqi_and_asthma():
    good = running_score(_w(temperature_c=21.5, aqi=45, humidity_pct=55,
                            wind_speed_kmh=8, uv_index=3, rain_probability_pct=5))
    bad = running_score(_w(temperature_c=21.5, aqi=150, humidity_pct=55,
                           wind_speed_kmh=8, uv_index=3, rain_probability_pct=5))
    # A poor AQI (150) must meaningfully drag the score down from excellent.
    assert bad.score < good.score - 5


def test_running_asthma_raises_aqi_weight():
    from app.models.schemas import UserProfile
    asthma = UserProfile(user_id="x", personas=["health"], health={"asthma": True})
    normal = running_score(_w(temperature_c=21.5, aqi=150, humidity_pct=55,
                              wind_speed_kmh=8, uv_index=3, rain_probability_pct=5))
    asthmatic = running_score(_w(temperature_c=21.5, aqi=150, humidity_pct=55,
                                 wind_speed_kmh=8, uv_index=3, rain_probability_pct=5), asthma)
    # Same bad AQI must weigh more heavily for an asthmatic.
    assert asthmatic.score < normal.score - 2


def test_beach_flips_above_wave_threshold():
    safe = beach_score(_w(wave_height_m=1.0, wind_speed_kmh=12, uv_index=6, rain_probability_pct=5))
    risky = beach_score(_w(wave_height_m=2.1, wind_speed_kmh=12, uv_index=6, rain_probability_pct=5))
    assert safe.level in ("Excellent", "Good")
    assert risky.score < safe.score
    assert risky.level in ("Poor", "Avoid")


def test_irrigation_postpone_above_rain_threshold():
    postpone = garden_irrigation_score(_w(precipitation_mm_h=12.0, soil_moisture_pct=45))
    assert "postpone" in postpone.summary.lower()


def test_irrigation_irrigate_when_dry():
    irrigate = garden_irrigation_score(_w(precipitation_mm_h=0.0, soil_moisture_pct=25))
    assert "irrigate" in irrigate.summary.lower()