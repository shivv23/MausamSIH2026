"""Ask Mausam endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.schemas import AskRequest, AskResponse
from app.services.ask import route_ask
from app.api.v1.endpoints.common import resolve_weather

router = APIRouter(prefix="/api/v1", tags=["ask"])


@router.post("/ask", response_model=AskResponse)
async def ask(body: AskRequest) -> AskResponse:
    if not body.question.strip():
        raise HTTPException(400, "question is required")
    _, w = await resolve_weather(body.user_id, body.city, body.scenario)
    from app.services.store import profile_for
    profile = profile_for(body.user_id, body.city or "pune")
    return route_ask(body.question, w, profile)