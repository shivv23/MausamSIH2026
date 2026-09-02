"""SQLAlchemy ORM models (Postgres/PostGIS when enabled).

Mirrors the canonical schemas (docs/schema.md). Enabled via
``settings.database_enabled``; the in-memory store remains the default so no
database is required to run or test the app.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, Float, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return uuid.uuid4().hex


class UserRow(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    personas: Mapped[list] = mapped_column(JSONB, default=list)
    language: Mapped[str] = mapped_column(String(8), default="en")
    city: Mapped[str | None] = mapped_column(String(80), nullable=True)
    health: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class ActivityRow(Base):
    __tablename__ = "user_activities"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    activity_type: Mapped[str] = mapped_column(String(40))
    label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    days: Mapped[list] = mapped_column(JSONB, default=list)
    preferred_start: Mapped[str | None] = mapped_column(String(8), nullable=True)
    preferred_end: Mapped[str | None] = mapped_column(String(8), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)


class AlertRow(Base):
    __tablename__ = "weather_warnings"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    severity: Mapped[str] = mapped_column(String(12))
    event_type: Mapped[str] = mapped_column(String(40))
    headline: Mapped[str] = mapped_column(String(200))
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    region: Mapped[str] = mapped_column(String(120))
    polygon_geom: Mapped[object | None] = mapped_column(Geometry("POLYGON", srid=4326), nullable=True)
    circles_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    valid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True))