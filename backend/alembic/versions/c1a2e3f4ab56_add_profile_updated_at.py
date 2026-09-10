"""add users.profile_updated_at (sync conflict detection)

Revision ID: c1a2e3f4ab56
Revises: b39a4d7c91e2
Create Date: 2026-09-08 13:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c1a2e3f4ab56'
down_revision: Union[str, None] = 'b39a4d7c91e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("profile_updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "profile_updated_at")