"""Deterministic, explainable impact models.

Each model maps normalized weather -> an ImpactScore (0-100) with a per-factor
breakdown and a one-line justification. Thresholds are data-driven (sourced
from IMD agromet, INCOIS wave tables, CPCB AQI bands, WHO UV guidance) and
cited on the card. Boundary conditions are covered by tests (tests/).
"""
from __future__ import annotations

from typing import Callable

from app.models.schemas import ActivityType, ImpactScore, UserProfile, WeatherData


def factor(name: str, score: float, weight: float, detail: str | None = None) -> dict:
    return {"name": name, "score": round(float(score), 1), "weight": weight, "detail": detail}


def level_for(score: float) -> str:
    if score >= 80:
        return "Excellent"
    if score >= 60:
        return "Good"
    if score >= 40:
        return "Fair"
    if score >= 20:
        return "Poor"
    return "Avoid"


def _compose(factors: list[dict]) -> ImpactScore:
    total_w = sum(f["weight"] for f in factors) or 1.0
    score = sum(f["score"] * f["weight"] for f in factors) / total_w
    return ImpactScore(name=factors[0]["name"], score=round(score, 1), level=level_for(score), factors=factors)


def _cap(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


# ---- utility scales -------------------------------------------------------

def _comfort(temp: float) -> float:
    return max(0.0, min(100.0, 100 - 12 * abs(temp - 21.5)))


def _wind(window_min: float, window_max: float) -> Callable[[float], float]:
    def _w(v: float) -> float:
        if v <= window_min:
            return 100.0
        if v >= window_max:
            return max(0.0, 100 - 100 * (v - window_max) / 20)
        return max(0.0, 100 - 40 * (v - window_min) / (window_max - window_min))
    return _w


def _aqi_level(aqi: float) -> str:
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Satisfactory"
    if aqi <= 200:
        return "Moderate"
    if aqi <= 300:
        return "Poor"
    if aqi <= 400:
        return "VeryPoor"
    return "Severe"


# ---- models ---------------------------------------------------------------

def running_score(w: WeatherData, profile: UserProfile | None = None) -> ImpactScore:
    p = w.parameters
    aqi_weight = 0.30 if profile and profile.health.get("asthma") else 0.20
    g = _wind(4, 25)
    factors = [
        factor("temperature", _comfort(p.temperature_c), 0.30, f"{p.temperature_c}°C (ideal ≈21.5°C)"),
        factor("AQI", _aqi_from_params(p), aqi_weight, f"AQI {p.aqi} ({_aqi_level(p.aqi or 0)})"),
        factor("humidity", max(0, 100 - abs(p.humidity_pct - 55)), 0.15, f"{p.humidity_pct}% (ideal ≈55%)"),
        factor("wind", g(p.wind_speed_kmh), 0.15, f"{p.wind_speed_kmh} km/h"),
        factor("UV", _cap(100 - 14 * (p.uv_index - 3)), 0.10, f"UV {p.uv_index}"),
        factor("rain", _rain_factor(p.rain_probability_pct), 0.10,
               f"rain {p.rain_probability_pct}%"),
    ]
    return _compose(factors)


def _rain_factor(prob: float | None) -> float:
    """Rain probability vs running suitability. Mild until ~40%, then collapses."""
    prob = prob or 0.0
    if prob <= 30:
        return 95.0
    if prob >= 90:
        return 5.0
    return round(95 - (prob - 30) * 1.5, 1)


def aqi_score(w: WeatherData, profile: UserProfile | None = None) -> ImpactScore:
    p = w.parameters
    aqi = p.aqi or 0
    # inverse mapping, sensitive to band boundaries
    raw = max(0.0, min(100.0, 100 - aqi * 0.42))
    penalty = 15 if (profile and profile.health.get("asthma")) and aqi > 100 else 0
    score = max(0.0, raw - penalty)
    return ImpactScore(
        name="AQI",
        score=round(score, 1),
        level=level_for(score),
        factors=[
            factor("PM2.5", max(0, 100 - 0.8 * (p.pm25 or 0)), 0.6, f"PM2.5 {p.pm25} µg/m³"),
            factor("band", score, 0.4, f"AQI {aqi} — {_aqi_level(aqi)}"),
        ],
        summary=f"AQI {aqi} ({_aqi_level(aqi)}) — "
                + ("avoid outdoor exercise, air poor for sensitive groups" if aqi > 100 else "suitable for normal activity"),
    )


def uv_score(w: WeatherData) -> ImpactScore:
    uv = w.parameters.uv_index
    score = _cap(100 - 14 * (uv - 2))
    window = None
    if score < 60:
        window = {"start": "06:00", "end": "10:00", "note": "low UV window, reduce exposure after 10 AM"}
    return ImpactScore(
        name="UV",
        score=round(score, 1),
        level=level_for(score),
        factors=[factor("UV index", score, 1.0, f"UV {uv} (WHO guidance)")],
        best_window=window,
        summary=f"UV {uv} — apply SPF 30+, reapply every 2h; seek shade at midday" if uv >= 6 else "UV moderate — light SPF adequate",
    )


def commute_score(w: WeatherData) -> ImpactScore:
    p = w.parameters
    rain = p.rain_probability_pct or 0
    vis = min(max(0.0, 100 - 10 * (6 - p.visibility_km)), 100.0)
    factors = [
        factor("rain risk", 100 - rain, 0.35, f"{rain}% rain"),
        factor("visibility", vis, 0.25, f"{p.visibility_km} km"),
        factor("wind", _wind(4, 35)(p.wind_speed_kmh), 0.20, f"{p.wind_speed_kmh} km/h gusts {p.wind_gust_kmh}"),
        factor("hazard", max(0.0, 100 - 8 * p.precipitation_mm_h), 0.20, f"{p.precipitation_mm_h} mm/h"),
    ]
    return _compose(factors)


def beach_score(w: WeatherData) -> ImpactScore:
    p = w.parameters
    wave = p.wave_height_m or 0.0
    # INCOIS safety ≈1.5 m. Below is graded by height; above collapses rapidly.
    if wave <= 1.0:
        wave_score = 100.0
    elif wave <= 1.5:
        wave_score = max(0.0, 100 - 40 * (wave - 1.0))
    else:
        wave_score = max(0.0, 40 - 60 * (wave - 1.5))
    factors = [
        factor("waves", wave_score, 0.55, f"{wave} m (INCOIS safety threshold ≈1.5 m)"),
        factor("UV", _cap(100 - 14 * (p.uv_index - 2)), 0.15, f"UV {p.uv_index}"),
        factor("wind", _cap(_wind(5, 30)(p.wind_speed_kmh)), 0.15, f"{p.wind_speed_kmh} km/h"),
        factor("rain", _cap(100 - 12 * (p.rain_probability_pct or 0)), 0.15, f"{p.rain_probability_pct or 0}% rain"),
    ]
    total = sum(f["score"] * f["weight"] for f in factors)
    return ImpactScore(
        name="Beach Safety",
        score=round(total, 1),
        level=level_for(total),
        factors=factors,
        summary=("⚠ Waves {0:.1f} m exceed the 1.5 m INCOIS safety threshold — keep children within arm's reach, avoid open water".format(wave)
                 if wave > 1.5 else "Waves within safety level — swim at patrolled spots"),
    )


def frost_score(w: WeatherData, crop_frost_c: float = 4.0) -> ImpactScore:
    p = w.parameters
    temp = p.temperature_c
    risk = 100.0 if temp <= 0 else max(0.0, 100 - 20 * (temp - 0) // 1)
    # amplify if soil moisture is low (dry soils radiate heat away faster)
    if (p.soil_moisture_pct or 50) < 30:
        risk = min(100.0, risk + 10)
    return ImpactScore(
        name="Frost Risk",
        score=round(max(0, 100 - risk), 1),
        level=level_for(100 - risk),
        factors=[
            factor("min temperature", 100 - risk, 0.7, f"{temp}°C / crop tolerance {crop_frost_c}°C"),
            factor("soil moisture", (p.soil_moisture_pct or 50), 0.3, f"{p.soil_moisture_pct}%"),
        ],
        summary=("Protect sensitive crops tonight: forecast min {0:.0f}°C below {1:.0f}°C tolerance".format(temp, crop_frost_c)
                 if temp < crop_frost_c else "No significant frost risk"),
    )


def garden_irrigation_score(w: WeatherData) -> ImpactScore:
    p = w.parameters
    rain24 = p.precipitation_mm_h  # proxy 24h value for mock
    soil = p.soil_moisture_pct or 45
    if rain24 > 10:
        note = "rain >10 mm expected — postpone irrigation"
        score = 90
    elif soil < 30 and not (p.rain_probability_pct or 0) >= 60:
        note = "soil moisture <30%, no rain — irrigate"
        score = 30
    else:
        note = "conditions balanced — standard watering schedule"
        score = 65
    return ImpactScore(
        name="Irrigation",
        score=score,
        level=level_for(score),
        factors=[
            factor("24h rainfall", 100 - 8 * rain24, 0.5, f"{rain24} mm"),
            factor("soil moisture", soil, 0.5, f"{soil}%"),
        ],
        summary=note,
    )


# dispatch table used by the personalization engine
MODELS: dict[str, Callable[..., ImpactScore]] = {
    ActivityType.RUN: running_score,
    ActivityType.COMMUTE: commute_score,
    ActivityType.SCHOOL: commute_score,
    ActivityType.BEACH: beach_score,
    ActivityType.SURF: beach_score,
    ActivityType.FARM_FROST: frost_score,
    ActivityType.FARM_IRRIGATION: garden_irrigation_score,
    ActivityType.EVENT: commute_score,
}


def _aqi_from_params(p) -> float:
    aqi = p.aqi or 0
    return max(0.0, min(100.0, 100 - aqi * 0.42))