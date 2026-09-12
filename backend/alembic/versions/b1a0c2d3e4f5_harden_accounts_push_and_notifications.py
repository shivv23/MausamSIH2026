"""harden mobile accounts (OTP/versioning/lockout) + push_tokens + user_notifications

Revision ID: b1a0c2d3e4f5
Revises: c1a2e3f4ab56
Create Date: 2026-09-12 09:00:00.000000

Extends user_credentials with verified contacts, one-time-password state,
token versioning and brute-force lockout; adds push_tokens for server->device
push and user_notifications as the durable per-user alert inbox.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b1a0c2d3e4f5'
down_revision: Union[str, None] = 'c1a2e3f4ab56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_credentials", sa.Column("email", sa.String(254), nullable=True))
    op.add_column("user_credentials", sa.Column("phone", sa.String(20), nullable=True))
    op.add_column("user_credentials", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("user_credentials", sa.Column("phone_verified", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("user_credentials", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("user_credentials", sa.Column("otp_code_hash", sa.String(96), nullable=True))
    op.add_column("user_credentials", sa.Column("otp_purpose", sa.String(24), nullable=True))
    op.add_column("user_credentials", sa.Column("otp_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("user_credentials", sa.Column("otp_attempts", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("user_credentials", sa.Column("otp_verified_flag", sa.String(24), nullable=True))
    op.add_column("user_credentials", sa.Column("otp_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("user_credentials", sa.Column("failed_logins", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("user_credentials", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("user_credentials", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "push_tokens",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(64), nullable=False, index=True),
        sa.Column("platform", sa.String(16), nullable=False, server_default="android"),
        sa.Column("expo_push_token", sa.String(512), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "user_notifications",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(64), nullable=False, index=True),
        sa.Column("alert_id", sa.String(32), nullable=False, index=True),
        sa.Column("severity", sa.String(12), nullable=False),
        sa.Column("event_type", sa.String(40), nullable=False),
        sa.Column("headline", sa.String(300), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("region", sa.String(120), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("user_notifications")
    op.drop_table("push_tokens")
    op.drop_column("user_credentials", "updated_at")
    op.drop_column("user_credentials", "locked_until")
    op.drop_column("user_credentials", "failed_logins")
    op.drop_column("user_credentials", "otp_verified_at")
    op.drop_column("user_credentials", "otp_verified_flag")
    op.drop_column("user_credentials", "otp_attempts")
    op.drop_column("user_credentials", "otp_expires_at")
    op.drop_column("user_credentials", "otp_purpose")
    op.drop_column("user_credentials", "otp_code_hash")
    op.drop_column("user_credentials", "token_version")
    op.drop_column("user_credentials", "phone_verified")
    op.drop_column("user_credentials", "email_verified")
    op.drop_column("user_credentials", "phone")
    op.drop_column("user_credentials", "email")