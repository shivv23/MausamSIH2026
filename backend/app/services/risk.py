"""Weather Impact Risk API.

Given a location + a list of activities (or a single activity type), return a
risk assessment per activity on current conditions. This is the backend for
mobile "before I go" checks and the aggregate "how does today affect me" view.
"""
from __future__ import annotations

from app.models.schemas import AskIntent, UserProfile, WeatherData
from app.services.ask import classify
from app.services.activity import _model_for, grade_activity
from app.models.schemas import ActivityType, ActivityWindow


ACTIVITY_TO_TYPE: dict[AskIntent, ActivityType] = {
    AskIntent.RUN: ActivityType.RUN,
    AskIntent.BEACH: ActivityType.BEACH,
    AskIntent.TRAVEL: ActivityType.COMMUTE,
    AskIntent.SCHOOL: ActivityType.SCHOOL,
    AskIntent.OUTDOOR: ActivityType.EVENT,
    AskIntent.IRRIGATE: ActivityType.FARM_IRRIGATION,
    AskIntent.FROST: ActivityType.FARM_FROST,
}


def risk_for(question: str, w: WeatherData, profile: UserProfile | None,
             include_slots: bool = True) -> dict:
    intent = classify(question or "")
    activity_type = ACTIVITY_TO_TYPE.get(intent)
    base = {
        "intent": intent.value,
        "activity": activity_type.value if activity_type else "brief",
    }
    model = _model_for(activity_type) if activity_type else None
    if model is not None:
        s = model(w, profile)
        base["score"] = s.score
        base["level"] = s.level
        base["factors"] = [f.model_dump() for f in s.factors]
        base["summary"] = s.summary
        if include_slots and activity_type:
            # a singular Activity lets us re-use window grading
            from app.models.schemas import Activity
            slots: list[ActivityWindow] = grade_activity(
                Activity(id="risk", type=activity_type, days=[]), w, profile)
            base["best_window"] = f"{slots[0].start}–{slots[0].end}" if slots else None
            base["slots"] = [s.model_dump() for s in slots[:3]]
    return base