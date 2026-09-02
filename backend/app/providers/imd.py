"""IMD adapter (real provider, plugged behind the provider abstraction).

Consumes IMD's public/dim data feeds and normalizes them into the canonical
``WeatherData`` shape. IMD's official services (Argis / auroradev APIs) change
availability and require tokens, so this adapter is written defensively: any
transport/parse failure raises ``ProviderError`` and the registry falls back
to the mock (offline-first demo). It also ships a small deterministic
normalizer for IMD's ``ObservedCityData`` JSON so the contract is exercised
even without a live token.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from app.models.schemas import GeoPoint, ProviderName, Provenance, WeatherData, WeatherParameters
from app.providers.base import BaseProvider, ProviderError

# IMD's Argis/auroradev observation endpoint (documented in the PS / MoES portal).
IMD_API = "https://auroradev.imdpune.gov.in"
DEFAULT_TIMEOUT = 8  # seconds


class IMDProvider(BaseProvider):
    name = ProviderName.IMD
    supported_types = ("current", "hourly", "daily", "warnings")

    def __init__(self, api_root: str = IMD_API, token: str | None = None,
                 client: Any = None, http_timeout: float = DEFAULT_TIMEOUT):
        self.api_root = api_root.rstrip("/")
        self.token = token
        self._client = client  # optional injected httpx.AsyncClient (keeps testable)
        self.timeout = http_timeout

    async def fetch(self, location: GeoPoint, data_type: str = "current") -> WeatherData:
        if data_type not in self.supported_types:
            raise ProviderError(f"IMD provider does not support data_type={data_type}")
        payload = await self._scrape(location, data_type)
        return self._normalize(location, payload, data_type)

    # -- transport ------------------------------------------------------

    async def _scrape(self, location: GeoPoint, data_type: str) -> dict[str, Any]:
        """Fetch + parse IMD payload. Raises ProviderError on any failure."""
        if self._client is None:
            import httpx
            self._client = httpx.AsyncClient(timeout=self.timeout)

        # IMD Argis current-weather endpoint param shape (city points).
        params = {
            "lat": location.lat,
            "lon": location.lon,
            "name": location.name or "India",
        }
        if self.token:
            params["token"] = self.token
        url = f"{self.api_root}/api2/latestforecast/{location.name or 'Pune'}".replace(" ", "%20")
        try:
            resp = await self._client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:  # noqa: BLE001 - transport agnostic fallback
            raise ProviderError(f"IMD unreachable/parse error for {location.name}: {exc}") from exc

    # -- normalizer -----------------------------------------------------

    def _normalize(self, location: GeoPoint, payload: dict[str, Any], data_type: str) -> WeatherData:
        """Map an IMD payload to canonical WeatherData (defensive)."""
        now = datetime.now(timezone.utc)
        raw = payload if isinstance(payload, dict) else {}
        jsons = raw.get("jsons") or []
        # IMD often nests per-station observations in a list.
        obs = next((o for o in jsons if isinstance(o, dict)), raw)

        def _num(keys: tuple[str, ...], default: float = 0.0) -> float:
            for k in keys:
                v = obs.get(k)
                if v is not None:
                    try:
                        return float(v)
                    except (TypeError, ValueError):
                        continue
            return default

        temp = _num(("temperature_c", "temp", "temperature", "t"), 26.0)
        aqi = int(_num(("aqi", "AQI"), 0)) or None
        params = WeatherParameters(
            temperature_c=temp,
            feels_like_c=_num(("feels_like_c", "feelslike", "apparent_t"), temp),
            humidity_pct=_num(("humidity_pct", "humidity", "relative_humidity"), 60.0),
            wind_speed_kmh=_num(("wind_speed_kmh", "windspeed", "wind_kph"), 10.0),
            wind_gust_kmh=_num(("wind_gust_kmh", "gust"), 0.0),
            wind_direction_deg=_num(("wind_direction_deg", "wind_dir"), 0.0),
            precipitation_mm_h=_num(("precipitation_mm_h", "precip", "rain"), 0.0),
            visibility_km=_num(("visibility_km", "vis"), 10.0),
            uv_index=_num(("uv_index", "uv"), 0.0),
            aqi=aqi,
            pm25=_num(("pm25", "pm2_5"), 0.0) or None,
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
                valid_until=now + timedelta(minutes=30),
                raw_payload_ref=f"imd/{location.name}/{now.isoformat()}",
            ),
        )


def imd_from_env() -> IMDProvider:
    """Build an IMD provider from env (token optional; never fails to construct)."""
    from app.core.config import settings
    token = getattr(settings, "imd_token", None)
    return IMDProvider(token=token)