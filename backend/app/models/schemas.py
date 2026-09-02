"""Canonical weather & card data models (Python side).

Every provider, impact model and card output is normalized into these
shapes so downstream consumers (ranking, NLG, mobile UI) read one schema.
Mirrors docs/schema.md.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ProviderName(str, Enum):
    IMD = "imd"
    CPCB = "cpcb"
    INCOIS = "incois"
    ISRO = "isro"
    OPEN_METEO = "open_meteo"
    MOCK = "mock"
    CROWDSOURCE = "crowdsource"


class Provenance(BaseModel):
    """Attribution + validity carried on every piece of weather data/card."""

    source: ProviderName
    issued_at: datetime
    valid_from: datetime
    valid_until: datetime
    licence: str = "CC-BY-4.0 (open govt); verify terms per SIH"
    raw_payload_ref: Optional[str] = None  # audit link to stored raw JSONB


class GeoPoint(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    geohash: Optional[str] = None
    name: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None


class WeatherParameters(BaseModel):
    """Normalized core weather metrics (all providers feed this shape)."""

    temperature_c: float
    feels_like_c: float
    humidity_pct: float = Field(..., ge=0, le=100)
    wind_speed_kmh: float = Field(..., ge=0)
    wind_gust_kmh: float = 0.0
    wind_direction_deg: float = 0.0
    precipitation_mm_h: float = 0.0
    rain_probability_pct: Optional[float] = Field(None, ge=0, le=100)
    visibility_km: float = 0.0
    uv_index: float = 0.0
    # air quality
    aqi: Optional[int] = Field(None, ge=0)
    aqi_band: Optional[str] = None  # Good/Satisfactory/Moderate/Poor/VeryPoor/Severe
    pm25: Optional[float] = None
    pm10: Optional[float] = None
    # health
    pollen_index: Optional[float] = None
    # marine
    wave_height_m: Optional[float] = None
    water_temperature_c: Optional[float] = None
    tide_state: Optional[str] = None  # High/Low/Rising/Falling
    # agromet
    soil_moisture_pct: Optional[float] = Field(None, ge=0, le=100)
    # derived comfort
    heat_index_c: Optional[float] = None


class WeatherData(BaseModel):
    location: GeoPoint
    ts: datetime
    provider: ProviderName
    data_type: str  # current | hourly | daily | aqi | marine | agromet ...
    parameters: WeatherParameters
    provenance: Provenance
    predicted_at: Optional[datetime] = None


class ActivityType(str, Enum):
    RUN = "run"
    CYCLE = "cycle"
    OUTDOOR_GYM = "outdoor_gym"
    COMMUTE = "commute"
    SCHOOL = "school"
    FARM_IRRIGATION = "farm_irrigation"
    FARM_FROST = "farm_frost"
    FARM_PLANTING = "farm_planting"
    BEACH = "beach"
    SURF = "surf"
    EVENT = "event"
    TRAVEL = "travel"


class UserProfile(BaseModel):
    """Persisted user context used by ranking & impact models."""

    user_id: str
    personas: list[str] = []
    language: str = "en"
    timezone: str = "Asia/Kolkata"
    units: str = "metric"
    health: dict[str, Any] = {}  # {'asthma': True, 'uv_sensitive': True}
    saved_locations: list[GeoPoint] = []
    activities: list[dict[str, Any]] = []  # normalized activities
    behavior_weights: Optional[dict[str, float]] = None


class FactorScore(BaseModel):
    name: str
    score: float = Field(..., ge=0, le=100)
    weight: float = 0.0
    detail: Optional[str] = None


class ImpactScore(BaseModel):
    """Explainable 0-100 impact score + factor breakdown."""

    name: str
    score: float = Field(..., ge=0, le=100)
    level: str  # Excellent/Good/Fair/Poor/Avoid
    factors: list[FactorScore] = []
    best_window: Optional[dict[str, str]] = None  # {'start': '06:20', 'end': '07:40'}
    summary: str = ""


class CardExplanation(BaseModel):
    why_shown: str
    source: ProviderName
    confidence: float = Field(..., ge=0, le=1)
    valid_until: datetime


class CardType(str, Enum):
    SEVERE_WARNING = "severe_warning"
    MY_DAY = "my_day"
    MAUSAM_BRIEF = "mausam_brief"
    AQI = "aqi"
    UV = "uv"
    POLLEN = "pollen"
    HUMIDITY = "humidity"
    RUNNING_WINDOW = "running_window"
    CYCLING_WINDOW = "cycling_window"
    OUTDOOR_COMFORT = "outdoor_comfort"
    SCHOOL_COMMUTE = "school_commute"
    WORK_COMMUTE = "work_commute"
    RAIN_TIMELINE = "rain_timeline"
    FOG_ALERT = "fog_alert"
    FARM_IRRIGATION = "farm_irrigation"
    FARM_FROST = "farm_frost"
    FARM_PLANTING = "farm_planting"
    BEACH_SAFETY = "beach_safety"
    TIDE_INFO = "tide_info"
    SURF_CONDITIONS = "surf_conditions"
    EVENT_WEATHER = "event_weather"
    TRAVEL_DESTINATION = "travel_destination"
    PACKING_ADVISOR = "packing_advisor"
    SUNRISE_SUNSET = "sunrise_sunset"


class AlertPhase(str, Enum):
    OFFICIAL = "official"        # verbatim IMD text, never LLM
    DERIVED = "derived"          # recommendation for the user
    INFORMATIONAL = "informational"


class HomepageCard(BaseModel):
    id: str
    type: CardType
    title: str
    summary: str
    priority: int  # 0 = top (official warnings pinned at 0-99)
    phase: Optional[AlertPhase] = None
    data: dict[str, Any] = {}
    explanation: CardExplanation
    provenance: Provenance


class HomepageResponse(BaseModel):
    user_id: str
    city: Optional[str]
    personas: list[str] = []
    generated_at: datetime
    metadata: dict[str, Any] = {}
    cards: list[HomepageCard]