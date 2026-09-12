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
    display_name: Optional[str] = None
    personas: list[str] = []
    language: str = "en"
    city: Optional[str] = None
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


# ---- My Day activity engine ----------------------------------------------

class ActivityWindow(BaseModel):
    """A graded time slot for an activity within a day."""

    activity: ActivityType
    start: str  # HH:MM (local, Asia/Kolkata)
    end: str  # HH:MM
    score: float = Field(..., ge=0, le=100)
    level: str
    summary: str = ""
    factors: list[FactorScore] = []


class ActivityInput(BaseModel):
    type: ActivityType
    label: str = ""
    days: list[int] = []  # 0=Mon ... 6=Sun; empty = daily
    preferred_start: Optional[str] = None  # HH:MM
    preferred_end: Optional[str] = None  # HH:MM
    location: Optional[GeoPoint] = None


class Activity(BaseModel):
    id: str
    type: ActivityType
    label: str = ""
    days: list[int] = []
    preferred_start: Optional[str] = None
    preferred_end: Optional[str] = None
    loc: Optional[GeoPoint] = None


class MyDayResponse(BaseModel):
    user_id: str
    date: str  # YYYY-MM-DD
    city: Optional[str]
    summary: str
    best_window: str
    slots: list[ActivityWindow] = []


# ---- Cross-device profile sync ----------------------------------------------

class SyncLocation(BaseModel):
    """A saved place (home/work/school/farm) on the mobile profile."""
    type: str = "home"
    label: str = ""


class SyncActivity(BaseModel):
    """A scheduled activity on the mobile profile."""
    type: str
    label: str = ""
    label_hi: Optional[str] = None
    time: str = "09:00"


class ProfileSync(BaseModel):
    """The mobile UserProfile payload used to move a profile between devices.

    The client stores this locally (AsyncStorage) and can PUT it to the server,
    then GET it back on another device to restore the same experience.
    """
    id: str
    name: str = ""
    name_hi: Optional[str] = None
    personas: list[str] = []
    conditions: list[str] = []
    activities: list[SyncActivity] = []
    locations: list[SyncLocation] = []
    city: str = "pune"
    language: str = "en"
    behavior_bias: dict[str, float] = {}


class ProfileSyncOut(BaseModel):
    user_id: str
    profile: Optional[ProfileSync] = None
    updated_at: Optional[datetime] = None


# ---- Mobile account authentication ------------------------------------------

class RegisterRequest(BaseModel):
    """Create a mobile account that owns a synced profile across devices.

    ``email`` / ``phone`` are optional at registration but strongly advised:
    they unlock OTP verification and self-serve password recovery (the only
    way to recover an account today).
    """
    user_id: str = Field(..., min_length=2, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(..., min_length=6, max_length=128)
    email: Optional[str] = Field(None, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    phone: Optional[str] = Field(None, max_length=20, pattern=r"^\+?[0-9]{10,15}$")


class LoginRequest(BaseModel):
    user_id: str = Field(..., min_length=2, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(..., min_length=1, max_length=128)


class AuthOut(BaseModel):
    user_id: str
    token: str
    verified: bool = True
    contact_verification_required: bool = False
    message: str = "ok"


class OtpPurpose(str, Enum):
    VERIFY_EMAIL = "verify_email"
    VERIFY_PHONE = "verify_phone"
    RESET_PASSWORD = "reset_password"


class OtpRequest(BaseModel):
    """Ask the server to generate + deliver a one-time-password.

    ``contact`` is only needed when binding a contact during registration that
    was not supplied there (it must match the account's own contact otherwise).
    """
    user_id: str = Field(..., min_length=2, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    purpose: OtpPurpose
    contact: Optional[str] = Field(None, max_length=254)


class OtpVerifyRequest(BaseModel):
    user_id: str = Field(..., min_length=2, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    purpose: OtpPurpose
    code: str = Field(..., min_length=4, max_length=8, pattern=r"^[0-9]{4,8}$")


class ResetPasswordRequest(BaseModel):
    """Recover an account using a reset OTP instead of the old password."""
    user_id: str = Field(..., min_length=2, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    code: str = Field(..., min_length=4, max_length=8, pattern=r"^[0-9]{4,8}$")
    new_password: str = Field(..., min_length=6, max_length=128)


class OtpOut(BaseModel):
    user_id: str
    purpose: OtpPurpose
    sent_to: Optional[str] = None  # masked contact ("a***@g.com" / "+91****1234")
    ttl_minutes: int
    dev_code: Optional[str] = None  # demo/test only; removed in production


# ---- Ask Mausam -----------------------------------------------------------

class AskIntent(str, Enum):
    RUN = "should_i_run"
    TRAVEL = "should_i_travel"
    IRRIGATE = "should_i_irrigate"
    BEACH = "beach_safety"
    SCHOOL = "school_commute"
    OUTDOOR = "outdoor_event"
    FROST = "frost_risk"
    GENERAL = "general_brief"


class AskRequest(BaseModel):
    user_id: str
    question: str
    city: Optional[str] = "pune"
    scenario: Optional[str] = None
    context: dict[str, Any] = {}


class AskResponse(BaseModel):
    intent: AskIntent
    answer: str
    verbatim: bool = False
    why: list[str] = []
    score: Optional[float] = None
    level: Optional[str] = None
    source: ProviderName


# ---- Alerts / disaster simulation ------------------------------------------

class WarningSeverity(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    ORANGE = "orange"
    RED = "red"


class GeoPolygon(BaseModel):
    """GeoJSON-style polygon (ring of [lon, lat] pairs, closed)."""

    type: str = "Polygon"
    coordinates: list[list[float]] = Field(..., description="ring: [[lon,lat],...]")


class DisasterAlert(BaseModel):
    id: str
    severity: WarningSeverity
    event_type: str  # e.g. 'heavy_rain', 'cyclone', 'heatwave', 'thunderstorm'
    headline: str
    detail: str = ""
    region: str  # district/zone label
    polygon: GeoPolygon
    issued_by: str = "IMD"
    issued_at: datetime
    valid_until: datetime
    actionable: list[str] = []  # concrete decisions for the user


class AlertSimulationRequest(BaseModel):
    severity: WarningSeverity = WarningSeverity.ORANGE
    event_type: str = "heavy_rain"
    headline: str = "Heavy rain expected"
    detail: str = ""
    region: str = "Pune"
    impact: list[str] = ["flooding on low-lying roads", "traffic disruption", "tree fall risk"]
    valid_hours: int = Field(24, ge=1, le=168)
    center: Optional[GeoPoint] = None  # defaults to a city anchor
    radius_km: Optional[float] = Field(None, ge=1, le=500)


class AlertSummary(BaseModel):
    id: str
    severity: WarningSeverity
    event_type: str
    headline: str
    region: str
    issued_at: datetime
    valid_until: datetime


class PushTarget(BaseModel):
    user_id: str
    registered_city: Optional[str]
    in_polygon: bool
    headline: str
    body: str
    fcm_payload: dict[str, Any] = {}


class SimulationResult(BaseModel):
    alert: DisasterAlert
    affected_users: list[PushTarget] = []


# ---- In-app notification centre / push-token registry ------------------------

class PushTokenIn(BaseModel):
    token: str = Field(..., min_length=8, max_length=512)
    platform: str = Field("android", pattern=r"^(android|ios)$")


class AppNotification(BaseModel):
    id: str
    alert_id: str
    severity: WarningSeverity
    event_type: str
    headline: str
    body: str
    region: str
    read: bool = False
    created_at: datetime


class NotificationListOut(BaseModel):
    user_id: str
    unread: int = 0
    items: list[AppNotification] = []


# ---- DPDP portability ---------------------------------------------------------

class AccountExportOut(BaseModel):
    """Portability dump (DPDP §8(5)): every record the service holds for a user.

    Credential material (password hash, OTP code hashes) is deliberately
    excluded; verified contact details are included so the user can see what is
    stored about them and can migrate it to another service.
    """

    schema_version: str = "2026-09-12"
    user_id: str
    generated_at: datetime
    account: dict[str, Any] = {}
    profile: Optional[dict[str, Any]] = None
    notifications: list[dict[str, Any]] = []
    push_tokens: list[dict[str, Any]] = []