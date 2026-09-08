"""add admin_users table

Revision ID: f48e3a6a5af8
Revises: 82e3f74eb4de
Create Date: 2026-09-03 11:00:54.125422

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f48e3a6a5af8'
down_revision: Union[str, None] = '82e3f74eb4de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'admin_users',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('username', sa.String(length=120), nullable=False),
        sa.Column('password_hash', sa.String(length=256), nullable=False),
        sa.Column('display_name', sa.String(length=160), nullable=True),
        sa.Column('role', sa.String(length=32), nullable=False, server_default='admin'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_admin_users_username', 'admin_users', ['username'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_admin_users_username', table_name='admin_users')
    op.drop_table('admin_users')
