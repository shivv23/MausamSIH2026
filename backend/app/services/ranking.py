"""Personalization & Ranking Engine.

Score(module) = w1·Interest + w2·Context + w3·Urgency + w4·Time
              + w5·Location + w6·Behavior

Weights start deterministic/explainable (cold start) and are tunable per
persona via A/B in the admin dashboard. Official Orange/Red IMD warnings are
pinned ahead of any personalization score.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.models.schemas import CardType, WeatherData

DEFAULT_WEIGHTS = {
    "interest": 0.25,
    "context": 0.20,
    "urgency": 0.20,
    "time": 0.15,
    "location": 0.15,
    "behavior": 0.05,
}

# Which card types each persona "cares about" (interest match).
PERSONA_INTERESTS: dict[str, set[CardType]] = {
    "health": {CardType.AQI, CardType.UV, CardType.POLLEN, CardType.HUMIDITY, CardType.OUTDOOR_COMFORT},
    "fitness": {CardType.RUNNING_WINDOW, CardType.CYCLING_WINDOW, CardType.OUTDOOR_COMFORT, CardType.UV},
    "beach": {CardType.BEACH_SAFETY, CardType.TIDE_INFO, CardType.SURF_CONDITIONS, CardType.UV},
    "travel": {CardType.TRAVEL_DESTINATION, CardType.PACKING_ADVISOR, CardType.SEVERE_WARNING},
    "parent": {CardType.SCHOOL_COMMUTE, CardType.RAIN_TIMELINE, CardType.SEVERE_WARNING, CardType.AQI},
    "agriculture": {CardType.FARM_IRRIGATION, CardType.FARM_FROST, CardType.FARM_PLANTING},
    "commuter": {CardType.WORK_COMMUTE, CardType.RAIN_TIMELINE, CardType.FOG_ALERT},
    "events": {CardType.EVENT_WEATHER, CardType.OUTDOOR_COMFORT, CardType.RAIN_TIMELINE},
}

# Card types that get pinned to the top regardless of persona (safety first).
ALWAYS_PIN: set[CardType] = {CardType.SEVERE_WARNING}


class Ranker:
    def __init__(self, weights: dict[str, float] | None = None):
        self.weights = {**DEFAULT_WEIGHTS, **(weights or {})}

    def interest(self, persona: str, card_type: CardType) -> float:
        return 1.0 if card_type in PERSONA_INTERESTS.get(persona, set()) else 0.35

    def context(self, w: WeatherData, card_type: CardType) -> float:
        """How attention-worthy the current weather makes this card type."""
        p = w.parameters
        base = 0.6
        if card_type in (CardType.AQI, CardType.POLLEN) and (p.aqi or 0) > 100:
            base += 0.35
        if card_type == CardType.UV and p.uv_index >= 6:
            base += 0.3
        if card_type in (CardType.RAIN_TIMELINE, CardType.WORK_COMMUTE, CardType.SCHOOL_COMMUTE) and (p.rain_probability_pct or 0) > 60:
            base += 0.35
        if card_type in (CardType.FARM_FROST,) and (w.parameters.temperature_c) < 10:
            base += 0.35
        if card_type == CardType.BEACH_SAFETY and (p.wave_height_m or 0) > 1.5:
            base += 0.3
        return min(1.0, base)

    def urgency(self, card_type: CardType) -> float:
        return 1.0 if card_type in ALWAYS_PIN else 0.6 + (0.3 if card_type in (CardType.AQI, CardType.SEVERE_WARNING) else 0)

    def time(self, hour: int, card_type: CardType) -> float:
        morning = hour < 12
        if card_type in (CardType.RUNNING_WINDOW, CardType.CYCLING_WINDOW, CardType.MAUSAM_BRIEF):
            return 0.9 if morning else 0.4
        if card_type in (CardType.WORK_COMMUTE, CardType.RAIN_TIMELINE):
            return 0.9 if 7 <= hour <= 19 else 0.4
        return 0.6

    def location(self, w: WeatherData, card_type: CardType) -> float:
        return 1.0 if card_type.value != "travel_destination" else 0.5

    def behavior(self, bias: float | None) -> float:
        return 0.5 if bias is None else min(1.0, max(0.0, bias))

    def rank(self, card_type: CardType, persona: str, w: WeatherData,
             hour: int, behavior_bias: float | None = None,
             is_official_warning: bool = False) -> float:
        """Return a 0..1 relevance score (higher = more relevant)."""
        if is_official_warning:
            return 100_000.0 + self.urgency(card_type)  # pinned above everything
        w_ = self.weights
        return (
            w_["interest"] * 100 * self.interest(persona, card_type)
            + w_["context"] * 100 * self.context(w, card_type)
            + w_["urgency"] * 100 * self.urgency(card_type)
            + w_["time"] * 100 * self.time(hour, card_type)
            + w_["location"] * 100 * self.location(w, card_type)
            + w_["behavior"] * 100 * self.behavior(behavior_bias)
        )


def hour_now() -> int:
    return datetime.now(timezone.utc).astimezone().hour  # simplified; pass explicit in prod