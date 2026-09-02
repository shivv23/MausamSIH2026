"""API v1 endpoints.

Mirrors docs/api-contract.md. Every card response carries provenance + an
explanation block (why_shown, source, confidence, valid_until).
"""
from __future__ import annotations

from fastapi import APIRouter, Query, HTTPException

from app.models.schemas import HomepageResponse
from app.services import build_for_user
from app.providers.mock import SCENARIOS

router = APIRouter(prefix="/api/v1", tags=["homepage"])


@router.get("/homepage/cards", response_model=HomepageResponse)
async def homepage_cards(
    user_id: str = Query(..., description="User identifier"),
    city: str | None = Query("pune", description="City anchor for personalization"),
    scenario: str | None = Query(None, description="Demo scenario override (see scenarios)"),
) -> HomepageResponse:
    if scenario and scenario not in SCENARIOS:
        raise HTTPException(400, f"unknown scenario; valid: {', '.join(SCENARIOS)}")
    return await build_for_user(user_id, city=city, scenario=scenario)


@router.get("/homepage/scenarios")
async def scenarios() -> dict[str, list[str]]:
    return {"scenarios": sorted(SCENARIOS)}