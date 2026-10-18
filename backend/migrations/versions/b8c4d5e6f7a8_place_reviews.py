"""Add place reviews and booking information links."""

import sqlalchemy as sa
from alembic import op

revision = "b8c4d5e6f7a8"
down_revision = "a7c3e91d4b22"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("places", sa.Column("booking_source", sa.Text(), nullable=True))
    op.create_table(
        "place_reviews",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("place_id", sa.String(length=36), nullable=False),
        sa.Column("author_name", sa.String(length=80), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["place_id"], ["places.id"], ondelete="CASCADE"),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="ck_place_reviews_rating"),
    )
    op.create_index("ix_place_reviews_place_id", "place_reviews", ["place_id"])
    op.create_index("ix_place_reviews_created_at", "place_reviews", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_place_reviews_created_at", table_name="place_reviews")
    op.drop_index("ix_place_reviews_place_id", table_name="place_reviews")
    op.drop_table("place_reviews")
    op.drop_column("places", "booking_source")
