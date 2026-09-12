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

    # Expo push (server -> device alerts). Disable with PUSH_ENABLED=0 in
    # tests/CI so background fan-out never hits the network.
    push_enabled: bool = True
    # Optional Expo access token (recommended for production accounts).
    expo_push_access_token: str | None = None

    # Persistence: set DATABASE_ENABLED=1 + a reachable DATABASE_URL to use the
    # Postgres/PostGIS ORM store; otherwise the in-memory store powers the demo.
    database_enabled: bool = False

    # Infrastructure (post-SIH wiring; not required for mock demo)
    database_url: str = "postgresql+asyncpg://mausam:mausam@localhost:5432/mausam"
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "amqp://guest:guest@localhost:5672//"

    # Alert fan-out: when CELERY_ENABLED=1 the /alerts/simulate endpoint hands
    # delivery (durable inbox + Expo push) to a Celery worker via the broker;
    # otherwise it falls back to in-process FastAPI BackgroundTasks. CI/dev
    # keep the sync fallback with zero infrastructure.
    celery_enabled: bool = False

    # Structured JSON logs (one object per line) for production ingestion.
    log_json: bool = False

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
    api_refresh_hours: int = 24 * 30  # how long a token can be refreshed

    # Account security (brute-force + OTP)
    # ------------------------------------------------------------------
    # Maximum failed logins before the account is temporarily locked.
    login_max_failures: int = 5
    # Minutes an account stays locked after repeated failures.
    lockout_minutes: int = 15
    # Time-to-live for a one-time-password, in minutes.
    otp_ttl_minutes: int = 10
    # Incorrect OTP entries permitted before the account is locked.
    otp_max_attempts: int = 5

    # Rate limiting on /api/v1/auth/* (per client IP + endpoint).
    rate_limit_max: int = 20
    rate_limit_window_seconds: int = 60

    # CORS: comma-separated allow-list. Empty ("") keeps the permissive dev
    # default ("*"); production deploys MUST set MAUSAM_CORS_ORIGINS.
    cors_allow_origins: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings: Settings = get_settings()