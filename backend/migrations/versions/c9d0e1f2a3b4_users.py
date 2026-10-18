"""Add user accounts for authenticated reviews."""

import sqlalchemy as sa
from alembic import op

revision = "c9d0e1f2a3b4"
down_revision = "b8c4d5e6f7a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("auth_token_hash", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)
    op.create_index("ix_users_auth_token_hash", "users", ["auth_token_hash"], unique=True)
    op.add_column("place_reviews", sa.Column("user_id", sa.String(length=36), nullable=True))
    op.create_index("ix_place_reviews_user_id", "place_reviews", ["user_id"])
    op.create_foreign_key(
        "fk_place_reviews_user_id", "place_reviews", "users", ["user_id"], ["id"], ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_place_reviews_user_id", "place_reviews", type_="foreignkey")
    op.drop_index("ix_place_reviews_user_id", table_name="place_reviews")
    op.drop_column("place_reviews", "user_id")
    op.drop_index("ix_users_auth_token_hash", table_name="users")
    op.drop_index("ix_users_phone", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
