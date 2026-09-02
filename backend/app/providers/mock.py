"""Deterministic, realistic mock provider.

Guarantees the demo/CI never sees a nonsense payload and never blocks on a
live IMD/CPCB/INCOIS endpoint. Scenarios (cyclone, orange_alert, aqi_spike,
heatwave, clear) inject reproducible conditions for the demo script.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models.schemas import (
    GeoPoint,
    ProviderName,
    Provenance,
    WeatherData,
    WeatherParameters,
)
from app.providers.base import BaseProvider, ProviderError

# A few Indian anchor points so "near a beach vs agriculture belt" demos work.
ANCHORS = {
    "pune": GeoPoint(lat=18.5204, lon=73.8567, name="Pune", district="Pune", state="Maharashtra"),
    "delhi": GeoPoint(lat=28.6139, lon=77.2090, name="Delhi", district="Delhi", state="Delhi"),
    "mumbai": GeoPoint(lat=19.0760, lon=72.8777, name="Mumbai", district="Mumbai", state="Maharashtra"),
    "chennai": GeoPoint(lat=13.0827, lon=80.2707, name="Chennai", district="Chennai", state="Tamil Nadu"),
    "kerala_coast": GeoPoint(lat=9.9312, lon=76.2673, name="Kochi", district="Ernakulam", state="Kerala"),
    "punjab": GeoPoint(lat=30.7333, lon=76.7794, name="Chandigarh", district="Chandigarh", state="Punjab"),
    "kolkata": GeoPoint(lat=22.5726, lon=88.3639, name="Kolkata", district="Kolkata", state="West Bengal"),
    "bengaluru": GeoPoint(lat=12.9716, lon=77.5946, name="Bengaluru", district="Bengaluru Urban", state="Karnataka"),
}

SCENARIOS: dict[str, dict] = {
    "clear": {"aqi": 58, "uv": 6, "precip": 0, "rain_prob": 12, "wind": 8, "temp": 26},
    "clean_air_morning": {"aqi": 38, "uv": 3, "precip": 0, "rain_prob": 5, "wind": 6, "temp": 21},
    "aqi_spike": {"aqi": 158, "uv": 7, "precip": 0, "rain_prob": 20, "wind": 6, "temp": 31},
    "heatwave": {"aqi": 110, "uv": 10, "precip": 0, "rain_prob": 8, "wind": 5, "temp": 42},
    "rainy_commute": {"aqi": 60, "uv": 2, "precip": 12, "rain_prob": 85, "wind": 18, "temp": 24, "wave": 2.4},
    "cyclone": {"aqi": 72, "uv": 1, "precip": 40, "rain_prob": 95, "wind": 95, "wave": 6.5, "gust": 130},
    "beach_day": {"aqi": 45, "uv": 9, "precip": 0, "rain_prob": 10, "wind": 12, "wave": 0.8, "water_temp": 28},
    "frost_night": {"aqi": 90, "uv": 4, "precip": 0, "rain_prob": 10, "wind": 4, "temp": 4, "soil": 22},
}


class MockProvider(BaseProvider):
    name = ProviderName.MOCK
    supported_types = ("current", "hourly", "daily", "aqi", "marine", "agromet")

    def __init__(self, scenario: str = "clear"):
        if scenario not in SCENARIOS:
            raise ProviderError(f"unknown mock scenario: {scenario}")
        self.scenario = scenario

    async def fetch(self, location: GeoPoint, data_type: str) -> WeatherData:
        s = dict(SCENARIOS[self.scenario])
        now = datetime.now(timezone.utc)
        params = WeatherParameters(
            temperature_c=s.get("temp", 26.0),
            feels_like_c=s.get("temp", 26.0) + (2 if s.get("temp", 0) > 35 else 0),
            humidity_pct=s.get("hum", 60),
            wind_speed_kmh=s.get("wind", 10),
            wind_gust_kmh=s.get("gust", s.get("wind", 10) * 1.6),
            precipitation_mm_h=s.get("precip", 0),
            rain_probability_pct=s.get("rain_prob", s.get("precip", 0) * 4),
            visibility_km=s.get("vis", 10 if s.get("precip", 0) < 5 else 3),
            uv_index=s.get("uv", 5),
            aqi=s.get("aqi", 60),
            pm25=s.get("pm25", round(s.get("aqi", 60) * 0.6, 1)),
            wave_height_m=s.get("wave"),
            water_temperature_c=s.get("water_temp"),
            soil_moisture_pct=s.get("soil", 45),
            heat_index_c=s.get("temp", 26) + (3 if s.get("temp", 0) > 33 else 0),
        )
        return WeatherData(
            location=location,
            ts=now,
            provider=self.name,
            data_type=data_type,
            parameters=params,
            provenance=Provenance(
                source=self.name,
                issued_at=now,
                valid_from=now,
                valid_until=now + timedelta(minutes=15),
                raw_payload_ref=f"mock/{self.scenario}/{now.isoformat()}",
            ),
        )


class WeatherRegistry:
    """Route provider requests. Fallback chain: primary -> mock -> cache."""

    def __init__(self, scenario: str = "clear", enable_mock: bool = True):
        self.primary = None  # real IMD adapter plugged in during SIH
        self.mock = MockProvider(scenario) if enable_mock else None

    async def get(self, location: GeoPoint, data_type: str = "current") -> WeatherData:
        if self.primary is not None:
            try:
                return await self.primary.fetch(location, data_type)
            except ProviderError as exc:  # noqa: F841
                pass  # fall through to mock / cache
        if self.mock is not None:
            return await self.mock.fetch(location, data_type)
        raise ProviderError("no provider available")

    def get_sync(self, location: GeoPoint, data_type: str = "current") -> WeatherData:
        """Synchronous facade for CLI/repl sanity checks (not used by the API)."""
        import asyncio
        return asyncio.get_event_loop().run_until_complete(self.get(location, data_type))


def pick_anchor(city: str) -> GeoPoint:
    city = (city or "pune").strip().lower()
    if city in ANCHORS:
        return ANCHORS[city]
    # interpret as a 2-tuple "lat,lon"
    if "," in city:
        parts = city.split(",")
        try:
            return GeoPoint(lat=float(parts[0]), lon=float(parts[1]), name="custom")
        except ValueError:
            pass
    return ANCHORS["pune"]


def scenario_for(city: str, default: str = "clear") -> str:
    """Map a city to a good demo scenario automatically."""
    table = {
        "delhi": "aqi_spike",
        "mumbai": "rainy_commute",
        "chennai": "beach_day",
        "kochi": "cyclone",
        "punjab": "frost_night",
        "chandigarh": "frost_night",
    }
    return table.get((city or "").strip().lower(), default)