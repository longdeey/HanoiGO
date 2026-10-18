"""Allow recurring events on the lunar calendar and festival seasons up to 120 days."""

import sqlalchemy as sa
from alembic import op

revision = "d1a2b3c4e5f6"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("places", sa.Column(
        "annual_calendar", sa.String(10), nullable=False, server_default="solar",
    ))
    op.drop_constraint("ck_places_annual_window", "places", type_="check")
    op.create_check_constraint(
        "ck_places_annual_window", "places",
        "(annual_month IS NULL AND annual_day IS NULL) OR "
        "(annual_month BETWEEN 1 AND 12 AND annual_day BETWEEN 1 AND 31 "
        "AND annual_duration_days BETWEEN 1 AND 120 "
        "AND annual_calendar IN ('solar', 'lunar'))",
    )


def downgrade() -> None:
    op.drop_constraint("ck_places_annual_window", "places", type_="check")
    op.create_check_constraint(
        "ck_places_annual_window", "places",
        "(annual_month IS NULL AND annual_day IS NULL) OR "
        "(annual_month BETWEEN 1 AND 12 AND annual_day BETWEEN 1 AND 31 "
        "AND annual_duration_days BETWEEN 1 AND 31)",
    )
    op.drop_column("places", "annual_calendar")
