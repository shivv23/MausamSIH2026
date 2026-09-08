"""Admin dashboard router (JSON API + HTML pages).

JSON routes live at ``/api/admin/...`` and are auth-protected with the
``mausam_admin_session`` cookie. The HTML dashboard lives at ``/admin`` and
is the server-rendered management console for IMD operators.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel

from app.admin.deps import AdminDep
from app.admin.security import cookie_max_age, hash_password, issue_session, verify_password
from app.admin import store
from app.core.config import settings

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---- auth models ----------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class AlertCreate(BaseModel):
    severity: str = "orange"
    event_type: str = "heavy_rain"
    headline: str = "Heavy rain expected"
    detail: str = ""
    region: str = "Pune"
    impact: list[str] = []
    valid_hours: int = 24
    radius_km: float = 40.0


class AlertUpdate(BaseModel):
    severity: str | None = None
    event_type: str | None = None
    headline: str | None = None
    detail: str | None = None
    region: str | None = None
    valid_hours: int | None = None


class UserUpdate(BaseModel):
    display_name: str | None = None
    personas: list[str] | None = None
    language: str | None = None
    city: str | None = None
    health: dict | None = None


# ---- login / logout -------------------------------------------------------

@router.post("/login")
async def login(body: LoginRequest, response: Response):
    admin = await store.get_admin_by_username(body.username)
    if admin is None or not verify_password(body.password, admin.password_hash):
        raise HTTPException(401, "Invalid credentials")
    if not admin.is_active:
        raise HTTPException(403, "Account disabled")
    token = issue_session(admin.id, admin.display_name)
    response.set_cookie("mausam_admin_session", token, max_age=cookie_max_age(),
                        httponly=True, samesite="lax", path="/")
    return {"ok": True, "admin_id": admin.id, "username": admin.username,
            "display_name": admin.display_name, "role": admin.role}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("mausam_admin_session", path="/")
    return {"ok": True}


@router.get("/me")
async def me(admin: AdminDep):
    return {"admin_id": admin.id, "username": admin.username,
            "display_name": admin.display_name, "role": admin.role}


# ---- dashboard overview ---------------------------------------------------

@router.get("/overview")
async def overview(admin: AdminDep):
    users_total = await store.count_users()
    alerts_active = await store.list_alerts(active_only=True)
    all_users = await store.list_users(limit=10000)
    cities: dict[str, int] = {}
    for u in all_users:
        c = u.city or "unknown"
        cities[c] = cities.get(c, 0) + 1
    return {
        "users_total": users_total,
        "alerts_active": len(alerts_active),
        "alerts": [a.__dict__ for a in alerts_active],
        "cities": [{"city": k, "count": v} for k, v in sorted(cities.items(), key=lambda x: -x[1])],
    }


# ---- user management ------------------------------------------------------

@router.get("/users")
async def list_users(q: str | None = None, limit: int = 200, offset: int = 0, _admin: AdminDep = None):
    rows = await store.list_users(limit=limit, offset=offset, q=q)
    total = await store.count_users()
    return {"total": total, "users": [u.__dict__ for u in rows]}


@router.get("/users/{user_id}")
async def get_user(user_id: str, _admin: AdminDep = None):
    u = await store.get_user(user_id)
    if u is None:
        raise HTTPException(404, "User not found")
    return u.__dict__


@router.put("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, _admin: AdminDep = None):
    values = body.model_dump(exclude_unset=True)
    if not values:
        raise HTTPException(400, "No fields to update")
    ok = await store.update_user(user_id, **values)
    if not ok:
        raise HTTPException(404, "User not found")
    return {"ok": True}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, _admin: AdminDep = None):
    n = await store.delete_user(user_id)
    if n == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True, "deleted": n}


# ---- user activities ------------------------------------------------------

@router.get("/users/{user_id}/activities")
async def list_activities(user_id: str, _admin: AdminDep = None):
    rows = await store.list_activity_rows(user_id)
    return {"activities": [r.__dict__ for r in rows]}


@router.delete("/users/{user_id}/activities/{activity_id}")
async def delete_activity(user_id: str, activity_id: str, _admin: AdminDep = None):
    n = await store.delete_activity(user_id, activity_id)
    if n == 0:
        raise HTTPException(404, "Activity not found")
    return {"ok": True}


# ---- alert management -----------------------------------------------------

@router.get("/alerts")
async def list_alerts(_admin: AdminDep = None):
    rows = await store.list_alerts()
    return {"alerts": [a.__dict__ for a in rows]}


@router.post("/alerts")
async def create_alert(body: AlertCreate, _admin: AdminDep = None):
    row = await store.create_alert(
        severity=body.severity, event_type=body.event_type,
        headline=body.headline, detail=body.detail, region=body.region,
        radius_km=body.radius_km, center=None, valid_hours=body.valid_hours,
    )
    return row.__dict__


@router.put("/alerts/{alert_id}")
async def update_alert(alert_id: str, body: AlertUpdate, _admin: AdminDep = None):
    values = body.model_dump(exclude_unset=True)
    if not values:
        raise HTTPException(400, "No fields to update")
    ok = await store.update_alert(alert_id, **values)
    if not ok:
        raise HTTPException(404, "Alert not found")
    return {"ok": True}


@router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: str, _admin: AdminDep = None):
    n = await store.delete_alert(alert_id)
    if n == 0:
        raise HTTPException(404, "Alert not found")
    return {"ok": True, "deleted": n}


@router.get("/alerts/{alert_id}/impact")
async def alert_impact(alert_id: str, _admin: AdminDep = None):
    alert = await store.get_alert(alert_id)
    if alert is None:
        raise HTTPException(404, "Alert not found")
    users = await store.users_in_range(alert, None)
    affected = [u for u in users if u["in_range"]]
    unaffected = [u for u in users if not u["in_range"]]
    return {"alert_id": alert.id, "headline": alert.headline,
            "affected": affected, "not_affected": unaffected,
            "total_affected": len(affected), "total_not_affected": len(unaffected)}
