"""SQLAlchemy ORM models (Postgres/PostGIS when enabled).

Mirrors the canonical schemas (docs/schema.md). Enabled via
``settings.database_enabled``; the in-memory store remains the default so no
database is required to run or test the app.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return uuid.uuid4().hex


class AdminUserRow(Base):
    """Authenticated dashboard operator (IMD admin)."""

    __tablename__ = "admin_users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    display_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    role: Mapped[str] = mapped_column(String(32), default="admin")  # admin | operator
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class UserCredRow(Base):
    """Mobile app account (user id + password hash) for sync.

    Extends the credential pair with account-security fields: verified
    contact (email/phone), OTP state for one-time-password flows, a token
    ``version`` that enables server-side revocation (bumping the version
    invalidates every token minted before it), and brute-force lockout
    bookkeeping.
    """

    __tablename__ = "user_credentials"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Token version: issued tokens carry the version active at mint time; a
    # bump (logout-everywhere, password reset) revokes all older tokens.
    token_version: Mapped[int] = mapped_column(Integer, default=0)

    # OTP state (single active code per account).
    otp_code_hash: Mapped[str | None] = mapped_column(String(96), nullable=True)
    otp_purpose: Mapped[str | None] = mapped_column(String(24), nullable=True)
    otp_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    otp_attempts: Mapped[int] = mapped_column(Integer, default=0)
    otp_verified_flag: Mapped[str | None] = mapped_column(String(24), nullable=True)
    otp_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Brute-force protection.
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class PushTokenRow(Base):
    """A device's registered push token, used for server->device sends."""

    __tablename__ = "push_tokens"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    platform: Mapped[str] = mapped_column(String(16), default="android")  # android | ios
    expo_push_token: Mapped[str] = mapped_column(String(512), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class UserNotificationRow(Base):
    """Per-user alert archive backing the in-app notification centre.

    Written when a simulation targets a registered user (server-side delivery
    intent), read back by GET /users/{id}/notifications and acknowledged via
    POST /users/{id}/notifications/{id}/ack. Acts as the durable inbox the
    local notification centre mirrors.
    """

    __tablename__ = "user_notifications"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    alert_id: Mapped[str] = mapped_column(String(32), index=True)
    severity: Mapped[str] = mapped_column(String(12))
    event_type: Mapped[str] = mapped_column(String(40))
    headline: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)
    region: Mapped[str] = mapped_column(String(120))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class UserRow(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    personas: Mapped[list] = mapped_column(JSONB, default=list)
    language: Mapped[str] = mapped_column(String(8), default="en")
    city: Mapped[str | None] = mapped_column(String(80), nullable=True)
    health: Mapped[dict] = mapped_column(JSONB, default=dict)
    profile_jsonb: Mapped[dict] = mapped_column(JSONB, default=dict)
    profile_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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