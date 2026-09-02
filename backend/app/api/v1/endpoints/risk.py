"""Weather Impact Risk API."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.v1.endpoints.common import resolve_weather
from app.services import risk as risk_service
from app.services.store import profile_for


class RiskRequest(BaseModel):
    user_id: str
    activity: str = Field(..., description="free-text, e.g. 'run', 'beach', 'commute'")
    city: str = "pune"
    scenario: str | None = None


router = APIRouter(prefix="/api/v1", tags=["risk"])


@router.post("/weather-risk")
async def weather_risk(body: RiskRequest) -> dict:
    if not body.activity.strip():
        raise HTTPException(400, "activity is required")
    _, w = await resolve_weather(body.user_id, body.city, body.scenario)
    profile = profile_for(body.user_id, body.city)
    return risk_service.risk_for(body.activity, w, profile)