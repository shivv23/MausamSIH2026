"""add user_credentials + users.profile_jsonb (cross-device sync)

Revision ID: b39a4d7c91e2
Revises: f48e3a6a5af8
Create Date: 2026-09-08 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b39a4d7c91e2'
down_revision: Union[str, None] = 'f48e3a6a5af8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("profile_jsonb", sa.JSON(), nullable=False, server_default="{}"),
    )
    op.create_table(
        "user_credentials",
        sa.Column("user_id", sa.String(64), primary_key=True),
        sa.Column("password_hash", sa.String(256), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("user_credentials")
    op.drop_column("users", "profile_jsonb")