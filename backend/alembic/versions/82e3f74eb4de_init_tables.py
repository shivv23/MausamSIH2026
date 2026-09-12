"""init tables

Revision ID: 82e3f74eb4de
Revises: 
Create Date: 2026-09-02 11:07:36.657759

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry


# revision identifiers, used by Alembic.
revision: str = '82e3f74eb4de'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # weather_warnings stores alert polygons in PostGIS geometry; enable the
    # extension first so the Geometry column type resolves on a fresh DB
    # (the extension itself only ships in postgis-enabled images).
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.create_table(
        "users",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("display_name", sa.String(120), nullable=True),
        sa.Column("personas", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("language", sa.String(8), server_default="en"),
        sa.Column("city", sa.String(80), nullable=True),
        sa.Column("health", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "user_activities",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("user_id", sa.String(64), nullable=False),
        sa.Column("activity_type", sa.String(40), nullable=False),
        sa.Column("label", sa.String(120), nullable=True),
        sa.Column("days", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("preferred_start", sa.String(8), nullable=True),
        sa.Column("preferred_end", sa.String(8), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
    )
    op.create_index("ix_user_activities_user_id", "user_activities", ["user_id"])
    op.create_table(
        "weather_warnings",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("severity", sa.String(12), nullable=False),
        sa.Column("event_type", sa.String(40), nullable=False),
        sa.Column("headline", sa.String(200), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("region", sa.String(120), nullable=False),
        sa.Column("polygon_geom", Geometry("POLYGON", srid=4326), nullable=True),
        sa.Column("circles_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("weather_warnings")
    op.drop_index("ix_user_activities_user_id", table_name="user_activities")
    op.drop_table("user_activities")
    op.drop_table("users")
