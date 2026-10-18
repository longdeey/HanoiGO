"""Date-specific POI closures

Revision ID: e72c4a9d85b0
Revises: d6b7e4a8190c
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "e72c4a9d85b0"
down_revision = "d6b7e4a8190c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "places", sa.Column("special_closed_dates", postgresql.JSONB(), nullable=False,
                            server_default=sa.text("'[]'::jsonb")),
    )


def downgrade() -> None:
    op.drop_column("places", "special_closed_dates")
