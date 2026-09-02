"""My Day activity engine.

Grades candidate time slots (HH:MM windows) against the activity's impact
model by sampling hourly weather over the day, then returns the best window
plus a ranked slot list. This powers the "My Day" hero card and the
"when's the best time" ask intent.
"""
from __future__ import annotations

import copy
import uuid
from datetime import datetime, timedelta, timezone

from app.models.schemas import (
    Activity,
    ActivityInput,
    ActivityType,
    ActivityWindow,
    ImpactScore,
    MyDayResponse,
    UserProfile,
    WeatherData,
)
from app.services import impact_models

# Window to grade around each candidate hour.
WINDOW_HOURS = 1.0
CANDIDATE_HOURS = (5, 6, 7, 8, 9, 10, 16, 17, 18, 19, 20, 21)

# Map an activity type to its impact model + the card label.
ACTIVITY_MODEL: dict[ActivityType, str] = {
    ActivityType.RUN: "running_score",
    ActivityType.CYCLE: "running_score",
    ActivityType.OUTDOOR_GYM: "running_score",
    ActivityType.COMMUTE: "commute_score",
    ActivityType.SCHOOL: "commute_score",
    ActivityType.EVENT: "commute_score",
    ActivityType.TRAVEL: "commute_score",
    ActivityType.BEACH: "beach_score",
    ActivityType.SURF: "beach_score",
    ActivityType.FARM_IRRIGATION: "garden_irrigation_score",
    ActivityType.FARM_FROST: "frost_score",  # graded purely as an advisory slot
}


def _model_for(activity_type: ActivityType):
    name = ACTIVITY_MODEL.get(activity_type, "running_score")
    fn = getattr(impact_models, name)
    accepts_profile = name in ("running_score", "aqi_score")

    def graded(w: WeatherData, profile: UserProfile | None = None) -> ImpactScore:
        return fn(w, profile) if accepts_profile and profile else fn(w)

    return graded


def _sample_for_hour(hour: int, base: WeatherData) -> WeatherData:
    w = copy.deepcopy(base)
    p = w.parameters
    # Diurnal curve: cooler early morning, peak ~14:00.
    diurnal = 6.0 if hour < 9 else (8.0 if hour < 12 else 12.0)
    solar = max(0.0, 10 - 1.5 * abs(hour - 12))
    p.temperature_c = round((base.parameters.temperature_c - 6.0) + diurnal, 1)
    p.uv_index = round(max(0.0, solar), 1)
    # Humidity drops through the day.
    p.humidity_pct = round(max(20, base.parameters.humidity_pct - abs(hour - 11) * 2), 1)
    p.feels_like_c = p.temperature_c
    # Deep-copy provenance so each sample is a distinct object.
    if w.provenance:
        w.provenance = copy.deepcopy(base.provenance)
    w.provenance.issued_at = base.provenance.issued_at + timedelta(hours=(hour - base.provenance.issued_at.hour))
    w.ts = base.ts + timedelta(hours=(hour - base.ts.hour))
    return w


def _hw(hour: int) -> str:
    return f"{hour:02d}:00"


def grade_activity(activity: Activity, base: WeatherData,
                   profile: UserProfile | None = None, on_date: str | None = None) -> list[ActivityWindow]:
    model = _model_for(activity.type)
    slots: list[ActivityWindow] = []
    lo, hi = activity.preferred_start, activity.preferred_end
    hours = CANDIDATE_HOURS
    if lo and hi:
        try:
            hours = [h for h in range(int(lo[:2]), int(hi[:2]) + 1) if h in CANDIDATE_HOURS]
            hours = hours or list(range(int(lo[:2]), min(int(hi[:2]) + 1, 23)))
        except (ValueError, IndexError):
            hours = CANDIDATE_HOURS

    for h in hours:
        sample = _sample_for_hour(h, base)
        s: ImpactScore = model(sample, profile)
        slots.append(
            ActivityWindow(
                activity=activity.type,
                start=_hw(h),
                end=_hw(h + 1),
                score=s.score,
                level=s.level,
                summary=s.summary,
                factors=list(s.factors),
            )
        )
    slots.sort(key=lambda x: x.score, reverse=True)
    return slots


def build_my_day(user: UserProfile, base: WeatherData,
                 activities: list[Activity], on_date: str | None = None) -> MyDayResponse:
    if not activities:
        return MyDayResponse(
            user_id=user.user_id,
            date=(on_date or datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d")),
            city=base.location.name,
            summary="Plan your day — add an activity and Mausam will find the best window.",
            best_window="—",
            slots=[],
        )
    all_slots: list[ActivityWindow] = []
    for a in activities:
        all_slots.extend(grade_activity(a, base, user, on_date))
    all_slots.sort(key=lambda x: x.score, reverse=True)
    best = all_slots[0]
    return MyDayResponse(
        user_id=user.user_id,
        date=on_date or datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d"),
        city=base.location.name,
        summary=(
            f"Best {best.activity.value.replace('_', ' ')} window: {best.start}–{best.end} "
            f"({best.score:.0f}/100, {best.level}). {best.summary}"
        ),
        best_window=f"{best.start}–{best.end}",
        slots=all_slots[:6],
    )


def input_to_activity(inp: ActivityInput, user_id: str) -> Activity:
    return Activity(
        id=f"{user_id}-{uuid.uuid4().hex[:8]}",
        type=inp.type,
        label=inp.label or inp.type.value.replace("_", " ").title(),
        days=inp.days,
        preferred_start=inp.preferred_start,
        preferred_end=inp.preferred_end,
        loc=inp.location,
    )