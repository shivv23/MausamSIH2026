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

    # Infrastructure (post-SIH wiring; not required for mock demo)
    database_url: str = "postgresql+asyncpg://mausam:mausam@localhost:5432/mausam"
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "amqp://guest:guest@localhost:5672//"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings: Settings = get_settings()