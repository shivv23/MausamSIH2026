"""Ask Mausam — conversational weather answers.

Rule-based only (deterministic, always explainable, never hallucinated). An
intent classifier maps a free-text question to a known intent; the answer is
then produced by the relevant impact model on the city's current weather and
the answer string + "why" bullets are NLG'd from the explainability factors.
"""
from __future__ import annotations

from app.models.schemas import (
    AskIntent,
    AskResponse,
    UserProfile,
    WeatherData,
)
from app.services.impact_models import (
    aqi_score,
    beach_score,
    commute_score,
    frost_score,
    running_score,
    uv_score,
)

_KEYWORDS: list[tuple[AskIntent, tuple[str, ...]]] = [
    (AskIntent.RUN, ("run", "jog", "exercise", "workout", "walk", "cycle", "gym", "morning workout")),
    (AskIntent.BEACH, ("beach", "swim", "surf", "sea", "waves", "coast")),
    (AskIntent.IRRIGATE, ("irrigat", "water the crops", "fields", "spray", "pesticide", "garden", "farm")),
    (AskIntent.FROST, ("frost", "freeze", "cold damage", "protect crops")),
    (AskIntent.SCHOOL, ("school", "pick my kid", "drop the kids", "parent")),
    (AskIntent.TRAVEL, ("travel", "drive", "ride", "trip", "journey", "commute", "road", "fly")),
    (AskIntent.OUTDOOR, ("event", "barbecue", "picnic", "wedding", "outdoor", "party", "function")),
]


def classify(question: str) -> AskIntent:
    q = (question or "").lower()
    for intent, keys in _KEYWORDS:
        if any(k in q for k in keys):
            return intent
    return AskIntent.GENERAL


def answer_intent(intent: AskIntent, w: WeatherData, profile: UserProfile | None) -> tuple[str, list[str], float | None, str | None]:
    """Return (answer, why-list, score, level)."""
    p = w.parameters

    if intent == AskIntent.RUN:
        s = running_score(w, profile)
        window = s.best_window
        why = [f"{f.name}: {f.detail}" for f in s.factors]
        answer = (
            f"Yes — good running conditions ({s.level}, {s.score:.0f}/100). "
            + (f"Avoid the worst of it; best low-UV window is {window['start']}–{window['end']}." if window
               else "Conditions are fine through the morning.")
        )
        return answer, why, s.score, s.level

    if intent in (AskIntent.TRAVEL, AskIntent.SCHOOL):
        s = commute_score(w)
        why = [f"{f.name}: {f.detail}" for f in s.factors]
        rain = p.rain_probability_pct or 0
        lead = "Leave 15 min early — rain on the route." if rain > 60 else ""
        answer = f"{'Yes' if s.score >= 60 else 'Not ideal'} ({s.level}, {s.score:.0f}/100). {lead}"
        return answer, why, s.score, s.level

    if intent == AskIntent.BEACH:
        s = beach_score(w)
        why = [f"{f.name}: {f.detail}" for f in s.factors]
        wave = p.wave_height_m
        answer = (
            f"Swimming is {'safe' if s.score >= 60 else 'not safe'} ({s.level}, {s.score:.0f}/100). "
            f"Waves {wave if wave is not None else '—'} m (INCOIS threshold ≈1.5 m)."
        )
        return answer, why, s.score, s.level

    if intent == AskIntent.IRRIGATE:
        if p.precipitation_mm_h > 10:
            answer = "No — rain is expected; postpone irrigation for today."
        elif (p.soil_moisture_pct or 45) < 30:
            answer = "Yes — the soil is dry; irrigate."
        else:
            answer = "Conditions are balanced — stick to your normal schedule."
        why = [f"rain forecast ≈{p.precipitation_mm_h} mm/h", f"soil moisture ≈{p.soil_moisture_pct}%"]
        return answer, why, None, None

    if intent == AskIntent.FROST:
        s = frost_score(w)
        why = [f"{f.name}: {f.detail}" for f in s.factors]
        answer = f"{s.summary} ({s.level})"
        return answer, why, s.score, s.level

    if intent == AskIntent.OUTDOOR:
        s = uv_score(w) if p.uv_index >= 6 else commute_score(w)
        why = [f"{f.name}: {f.detail}" for f in s.factors]
        answer = (
            f"Outdoor event is {'fine' if s.score >= 60 else 'better indoors'} ({s.level}, {s.score:.0f}/100). "
            + ("High UV — plan for shade and sunscreen." if p.uv_index >= 6 else "Watch the rain chance.")
        )
        return answer, why, s.score, s.level

    # GENERAL brief
    a = aqi_score(w, profile)
    u = uv_score(w)
    why = [f"AQI: {p.aqi} ({a.level})", f"UV: {p.uv_index} ({u.level})", f"Temp: {p.temperature_c}°C",
           f"Rain chance: {p.rain_probability_pct or 0}%"]
    answer = (
        f"You're in {w.location.name} right now: {p.temperature_c}°C, feels like {p.feels_like_c}°C, "
        f"AQI {p.aqi} ({a.level}), UV {p.uv_index} ({u.level}), rain chance {p.rain_probability_pct or 0}%. "
        + ("Air is poor for sensitive groups — limit outdoor time." if (p.aqi or 0) > 100 else "All clear for a normal day.")
    )
    return answer, why, None, None


def route_ask(question: str, w: WeatherData, profile: UserProfile | None = None) -> AskResponse:
    intent = classify(question)
    answer, why, score, level = answer_intent(intent, w, profile)
    return AskResponse(
        intent=intent,
        answer=answer,
        why=why,
        score=score,
        level=level,
        source=w.provenance.source,
    )