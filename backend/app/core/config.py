"""Application settings (env-driven)."""
from __future__ import annotations

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Mausam 2.0 - Personalized Weather Intelligence"
    version: str = "0.1.0"
    environment: str = "development"
    debug: bool = True

    # Demo defaults
    default_city: str = "pune"
    default_scenario: str = "clear"

    # Real-data wiring: set ENABLE_IMD=1 (and optionally IMD_TOKEN) to use the
    # live IMD adapter; otherwise the mock keeps the offline demo deterministic.
    enable_imd: bool = False
    imd_token: str | None = None

    # Persistence: set DATABASE_ENABLED=1 + a reachable DATABASE_URL to use the
    # Postgres/PostGIS ORM store; otherwise the in-memory store powers the demo.
    database_enabled: bool = False

    # Infrastructure (post-SIH wiring; not required for mock demo)
    database_url: str = "postgresql+asyncpg://mausam:mausam@localhost:5432/mausam"
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "amqp://guest:guest@localhost:5672//"

    # Admin dashboard security ----
    # Secret used to sign admin session cookies. MUST be set in production.
    admin_secret: str | None = None
    # Env-driven bootstrap admin (seeded on first startup when empty).
    # No credentials are hardcoded in source.
    admin_username: str = "admin"
    admin_password: str | None = None
    # Default admin lifetime (hours)
    admin_session_hours: int = 12

    # Mobile API bearer tokens (cross-device profile sync)
    api_token_hours: int = 24 * 7  # 1 week

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings: Settings = get_settings()