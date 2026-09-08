"""Admin dashboard package.

A self-contained admin surface for IMD operators: auth, users, activities and
alert management, all backed by the Postgres/PostGIS store (no hardcoded demo
data). Served at ``/admin`` and exposed as JSON under ``/api/admin``.
"""

from app.admin.router import router as admin_router

__all__ = ["admin_router"]