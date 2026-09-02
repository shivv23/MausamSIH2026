"""Shared endpoint helpers (resolve user + canonical weather)."""
from __future__ import annotations

from app.providers.mock import make_registry, pick_anchor, scenario_for
from app.services.store import hydrate_city


async def resolve_weather(user_id: str, city: str | None, scenario: str | None):
    city = city or "pune"
    scenario = scenario or scenario_for(city)
    loc = pick_anchor(city)
    reg = make_registry(scenario, city)
    w = await reg.get(loc, "current")
    profile = hydrate_city(user_id, city)
    return profile, w