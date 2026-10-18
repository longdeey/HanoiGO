"""Persist transport cost for repeatable itinerary retrieval."""

import sqlalchemy as sa
from alembic import op

revision = "b2e1f76a9c0d"
down_revision = "881aad7c851b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("itinerary_items", sa.Column("travel_cost", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("itinerary_items", "travel_cost")
