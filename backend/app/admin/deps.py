"""FastAPI dependencies for admin routes (cookie-based session auth)."""
from __future__ import annotations

from typing import Annotated

from fastapi import Cookie, Depends, HTTPException

from app.admin.security import parse_session


async def current_admin(session: Annotated[str | None, Cookie(alias="mausam_admin_session")] = None):
    """Return the validated admin payload from the signed cookie, or 401."""
    payload = parse_session(session or "")
    if payload is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    from app.admin import store
    admin = await store.get_admin_by_id(payload["admin_id"])
    if admin is None or not admin.is_active:
        raise HTTPException(status_code=401, detail="Account inactive or deleted")
    return admin


AdminDep = Annotated[object, Depends(current_admin)]