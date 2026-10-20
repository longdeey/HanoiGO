"""Save trips to accounts and allow one session per signed-in device."""

import sqlalchemy as sa
from alembic import op

revision = "e4f5a6b7c8d9"
down_revision = "d1a2b3c4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_sessions",
        sa.Column("token_hash", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    op.add_column("trip_requests", sa.Column("user_id", sa.String(length=36), nullable=True))
    op.create_index("ix_trip_requests_user_id", "trip_requests", ["user_id"])
    op.create_foreign_key(
        "fk_trip_requests_user_id", "trip_requests", "users", ["user_id"], ["id"], ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_trip_requests_user_id", "trip_requests", type_="foreignkey")
    op.drop_index("ix_trip_requests_user_id", table_name="trip_requests")
    op.drop_column("trip_requests", "user_id")
    op.drop_index("ix_user_sessions_user_id", table_name="user_sessions")
    op.drop_table("user_sessions")
