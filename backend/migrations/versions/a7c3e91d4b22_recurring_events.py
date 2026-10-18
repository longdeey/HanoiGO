"""Store recurring annual Vietnamese holiday windows."""

import sqlalchemy as sa
from alembic import op

revision = "a7c3e91d4b22"
down_revision = "f2a84b7e011d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("places", sa.Column("annual_month", sa.Integer(), nullable=True))
    op.add_column("places", sa.Column("annual_day", sa.Integer(), nullable=True))
    op.add_column("places", sa.Column("annual_duration_days", sa.Integer(), nullable=False, server_default="1"))
    op.create_check_constraint(
        "ck_places_annual_window", "places",
        "(annual_month IS NULL AND annual_day IS NULL) OR "
        "(annual_month BETWEEN 1 AND 12 AND annual_day BETWEEN 1 AND 31 "
        "AND annual_duration_days BETWEEN 1 AND 31)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_places_annual_window", "places", type_="check")
    op.drop_column("places", "annual_duration_days")
    op.drop_column("places", "annual_day")
    op.drop_column("places", "annual_month")
