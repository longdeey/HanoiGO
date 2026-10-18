"""Seasonal availability and editorial activity highlights.

Revision ID: f2a84b7e011d
Revises: e72c4a9d85b0
"""

import sqlalchemy as sa
from alembic import op

revision = "f2a84b7e011d"
down_revision = "e72c4a9d85b0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("places", sa.Column("available_from", sa.Date(), nullable=True))
    op.add_column("places", sa.Column("available_until", sa.Date(), nullable=True))
    op.add_column("places", sa.Column("highlight_level", sa.String(length=20), nullable=False,
                                      server_default="standard"))
    op.create_check_constraint(
        "ck_places_availability_window", "places",
        "(available_from IS NULL AND available_until IS NULL) OR "
        "(available_from IS NOT NULL AND available_until IS NOT NULL "
        "AND available_from <= available_until)",
    )
    op.create_check_constraint(
        "ck_places_highlight_level", "places",
        "highlight_level IN ('standard', 'notable', 'must_see')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_places_highlight_level", "places", type_="check")
    op.drop_constraint("ck_places_availability_window", "places", type_="check")
    op.drop_column("places", "highlight_level")
    op.drop_column("places", "available_until")
    op.drop_column("places", "available_from")
