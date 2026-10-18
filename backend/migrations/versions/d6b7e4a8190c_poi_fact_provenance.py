"""POI price and opening-hour provenance

Revision ID: d6b7e4a8190c
Revises: c5e2a8f94b11
"""

import sqlalchemy as sa
from alembic import op

revision = "d6b7e4a8190c"
down_revision = "c5e2a8f94b11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("places", sa.Column("price_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("places", sa.Column("hours_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("places", sa.Column("price_source", sa.Text(), nullable=True))
    op.add_column("places", sa.Column("hours_source", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("places", "hours_source")
    op.drop_column("places", "price_source")
    op.drop_column("places", "hours_verified")
    op.drop_column("places", "price_verified")
