"""Homepage card builder.

Assembles ranked cards for a user using the personalization engine + impact
models + canonical weather. Official warnings (if any) are anchored at the
top. This is the endpoint behind GET /api/v1/homepage/cards.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from app.models.schemas import (
    AlertPhase,
    CardExplanation,
    CardType,
    HomepageCard,
    HomepageResponse,
    UserProfile,
    WeatherData,
)
from app.providers.mock import pick_anchor, scenario_for
from app.services.impact_models import aqi_score, beach_score, commute_score, frost_score, running_score, uv_score
from app.services.ranking import ALWAYS_PIN, PERSONA_INTERESTS, Ranker


def _explanation(why: str, w: WeatherData, confidence: float = 0.92) -> CardExplanation:
    return CardExplanation(
        why_shown=why,
        source=w.provenance.source,
        confidence=confidence,
        valid_until=w.provenance.valid_until,
    )


def build_homepage(user: UserProfile, w: WeatherData,
                   is_official_warning: bool = False, warning_text: str | None = None,
                   hour: int | None = None, behavior_bias: Optional[float] = None) -> HomepageResponse:
    ranker = Ranker()
    now = datetime.now(timezone.utc)
    hour = hour if hour is not None else now.astimezone().hour
    personas = user.personas or ["commuter"]  # default persona for cold start

    # Gather candidate cards per persona interest.
    candidates: list[tuple[float, HomepageCard]] = []
    primary_persona = personas[0]

    # ---- impact-model driven cards ---------------------------------------
    def add(type_: CardType, title: str, summary: str, data: dict, why: str, score=None, pinned=False, phase=None):
        if score is not None:
            data["score"] = score
        raw = ranker.rank(type_, primary_persona, w, hour,
                          behavior_bias=behavior_bias, is_official_warning=pinned)
        candidates.append((raw, HomepageCard(
            id=f"{type_.value}-{int(now.timestamp())}",
            type=type_,
            title=title,
            summary=summary,
            priority=0,  # set below after sorting
            phase=phase,
            data=data,
            explanation=_explanation(why, w),
            provenance=w.provenance,
        )))

    if _wants(personas, CardType.SEVERE_WARNING) or is_official_warning or True:
        # Official severe warning always present when supplied (pinned).
        if is_official_warning:
            add(CardType.SEVERE_WARNING, "IMD Advisory",
                warning_text or "Severe weather", {"official": True},
                "Official IMD warning — always pinned, never LLM", pinned=True, phase=AlertPhase.OFFICIAL)

    if _wants(personas, CardType.AQI):
        s = aqi_score(w, user)
        add(CardType.AQI, "Air Quality", s.summary,
            {"aqi": w.parameters.aqi, "band": s.level},
            f"Health persona cares about AQI (current {w.parameters.aqi})", s.score, phase=AlertPhase.DERIVED)

    if _wants(personas, CardType.RUNNING_WINDOW) or _wants(personas, CardType.CYCLING_WINDOW):
        s = running_score(w, user)
        card_type = CardType.RUNNING_WINDOW if _wants(personas, CardType.RUNNING_WINDOW) else CardType.CYCLING_WINDOW
        add(card_type, "Best Time to Run" if card_type == CardType.RUNNING_WINDOW else "Best Time to Cycle",
            f"SCORE {s.score}/100 — {s.level}: {s.summary or 'ideal conditions'}",
            {"score": s.score, "level": s.level, "best_window": s.best_window,
             "factors": [f.dict() for f in s.factors]},
            f"Fitness persona + activity engine: {s.factors[0].detail}", s.score, phase=AlertPhase.DERIVED)

    if _wants(personas, CardType.WORK_COMMUTE) or _wants(personas, CardType.SCHOOL_COMMUTE) or _wants(personas, CardType.RAIN_TIMELINE):
        s = commute_score(w)
        card_type = CardType.WORK_COMMUTE if _wants(personas, CardType.WORK_COMMUTE) else (
            CardType.SCHOOL_COMMUTE if _wants(personas, CardType.SCHOOL_COMMUTE) else CardType.RAIN_TIMELINE)
        add(card_type, "Commute Risk", f"SCORE {s.score}/100 — {s.level}: rain {w.parameters.rain_probability_pct or 0}%, vis {w.parameters.visibility_km} km",
            {"score": s.score, "level": s.level, "rain_probability": w.parameters.rain_probability_pct},
            "Commute persona: route weather, heavy rain on route", s.score, phase=AlertPhase.DERIVED)

    if _wants(personas, CardType.UV):
        s = uv_score(w)
        add(CardType.UV, "UV Index", s.summary, {"uv": w.parameters.uv_index, "level": s.level},
            f"UV {w.parameters.uv_index} — WHO guidance", s.score, phase=AlertPhase.DERIVED)

    if _wants(personas, CardType.BEACH_SAFETY):
        s = beach_score(w)
        add(CardType.BEACH_SAFETY, "Beach Safety", s.summary, {"wave_height_m": w.parameters.wave_height_m},
            f"Beach persona: waves {w.parameters.wave_height_m}m (INCOIS)", s.score, phase=AlertPhase.DERIVED)

    if _wants(personas, CardType.FARM_FROST) or _wants(personas, CardType.FARM_IRRIGATION):
        s = frost_score(w) if _wants(personas, CardType.FARM_FROST) else None
        if s is not None:
            add(CardType.FARM_FROST, "Frost Risk", s.summary, {"min_temp": w.parameters.temperature_c},
                "Farming persona: frost protection", s.score, phase=AlertPhase.DERIVED)

    # --- My Day timeline (hero) -------------------------------------------
    my_day = []
    for a in user.activities[:4]:
        my_day.append({"activity": a.get("type", "event"), "time": a.get("time", "09:00")})
    add(CardType.MY_DAY, "My Day", "Your schedule, weather-checked",
        {"items": my_day or [{"activity": "No planned activities", "time": "-"}]},
        "Autonomous context: your saved activities evaluated against today's weather")

    # ---- rank & assign priority ------------------------------------------
    candidates.sort(key=lambda c: c[0], reverse=True)
    cards: list[HomepageCard] = []
    for pri, (_, card) in enumerate(candidates):
        card.priority = pri
        card.data["priority"] = pri
        cards.append(card)

    # enforce "max one run-time card" and cap to top N
    cards = _dedupe(cards)

    return HomepageResponse(
        user_id=user.user_id,
        city=w.location.name,
        personas=personas,
        generated_at=now,
        metadata={
            "dataFreshness": "6 min ago",
            "providerStatus": [{"provider": w.provenance.source.value, "status": "ok"}],
            "explainability": "every card carries why_shown + source + confidence",
        },
        cards=cards,
    )


def _wants(personas: list[str], card_type: CardType) -> bool:
    return any(card_type in PERSONA_INTERESTS.get(p, set()) for p in personas)


def _dedupe(cards: list[HomepageCard]) -> list[HomepageCard]:
    seen: set[CardType] = set()
    out: list[HomepageCard] = []
    for c in cards:
        if c.type in seen and c.type not in ALWAYS_PIN:
            continue  # only one instance of a personal card type
        seen.add(c.type)
        out.append(c)
    return out[:8]  # top 8 keeps first page snappy


async def build_for_user(user_id: str, city: str | None = None, scenario: str | None = None) -> HomepageResponse:
    """Compose weather + profile and produce the homepage (async)."""
    from app.providers.mock import WeatherRegistry
    city = city or "pune"
    scenario = scenario or scenario_for(city)
    loc = pick_anchor(city)
    reg = WeatherRegistry(scenario=scenario)
    w = await reg.get(loc, "current")
    user = UserProfile(
        user_id=user_id,
        personas=_personas_for(user_id),
        saved_locations=[loc],
    )
    return build_homepage(user, w)


def _personas_for(user_id: str) -> list[str]:
    # TODO: replace with DB-backed profile lookup in SIH build.
    # Default demo mapping keeps the endpoint usable without a DB.
    mapping = {
        "ananya": ["fitness", "health", "commuter"],
        "ramesh": ["agriculture", "commuter"],
        "asha": ["parent", "commuter"],
    }
    return mapping.get(user_id, ["commuter"])