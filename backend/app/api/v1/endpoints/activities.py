"""My Day activity endpoints (CRUD + best-window)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import Activity, ActivityInput, MyDayResponse
from app.api.v1.endpoints.common import resolve_weather
from app.services.activity import build_my_day
from app.services import store

router = APIRouter(prefix="/api/v1", tags=["activities"])


@router.get("/activities", response_model=list[Activity])
async def list_activities(user_id: str = Query(...)) -> list[Activity]:
    return store.list_activities(user_id)


@router.post("/activities", response_model=Activity)
async def create_activity(body: ActivityInput, user_id: str = Query(...)) -> Activity:
    return store.add_activity(user_id, body)


@router.delete("/activities/{activity_id}")
async def delete_activity(activity_id: str, user_id: str = Query(...)) -> dict[str, int]:
    ok = store.remove_activity(user_id, activity_id)
    if not ok:
        raise HTTPException(404, "activity not found")
    return {"deleted": 1, "remaining": len(store.list_activities(user_id))}


@router.get("/my-day", response_model=MyDayResponse)
async def my_day(user_id: str = Query(...), city: str | None = Query("pune"),
                 scenario: str | None = Query(None)) -> MyDayResponse:
    profile, w = await resolve_weather(user_id, city, scenario)
    acts = store.list_activities(user_id)
    return build_my_day(profile, w, acts)