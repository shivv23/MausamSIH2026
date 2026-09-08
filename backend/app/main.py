from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.api import api_router
from app.admin import store
from app.admin.router import router as admin_router
from app.admin.security import hash_password
from app.admin.templates import dashboard_html
from app.core.config import settings

logger = logging.getLogger("mausam")


async def bootstrap_admin() -> None:
    """Seed the env-configured admin account on first startup (DB-only)."""
    if not settings.admin_username or not settings.admin_password:
        return
    existing = await store.get_admin_by_username(settings.admin_username)
    if existing is not None:
        return
    await store.create_admin(
        username=settings.admin_username,
        password_hash=hash_password(settings.admin_password),
        display_name="IMD Administrator",
        role="admin",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # When persistence is configured, verify Postgres is actually reachable
    # before routing any traffic. If it is not, keep the app up on the
    # in-memory store and log the degradation instead of crashing at start.
    if getattr(settings, "database_enabled", False):
        from app.db import probe, set_db_available
        ok = await probe()
        set_db_available(ok)
        if not ok:
            logger.warning("Postgres unreachable (%s); falling back to in-memory store", settings.database_url)
        else:
            logger.info("Postgres reachable; using persistent store")
            try:
                await bootstrap_admin()
            except Exception:  # noqa: BLE001 - never crash startup over admin seeding
                logger.exception("admin bootstrap failed; continuing without it")
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        description=(
            "Mausam 2.0 - a Personalized Weather Intelligence Engine on official "
            "IMD/MoES data. Personalized homepage cards for the 'Mausam' app "
            "(SIH 2026 PS 26076)."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # tighten in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)
    app.include_router(admin_router)

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        from app.db import database_available
        return {
            "status": "ok",
            "service": settings.app_name,
            "version": settings.version,
            "storage": "postgres" if database_available() else "memory",
        }

    @app.get("/admin", include_in_schema=False)
    async def admin_page() -> HTMLResponse:
        return HTMLResponse(dashboard_html())

    return app


app = create_app()