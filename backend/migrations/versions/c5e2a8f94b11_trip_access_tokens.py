"""trip access token hashes

Revision ID: c5e2a8f94b11
Revises: b2e1f76a9c0d
"""

import sqlalchemy as sa
from alembic import op

revision = "c5e2a8f94b11"
down_revision = "b2e1f76a9c0d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("trip_requests", sa.Column("owner_token_hash", sa.String(length=64), nullable=True))
    op.add_column("trip_requests", sa.Column("share_token_hash", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("trip_requests", "share_token_hash")
    op.drop_column("trip_requests", "owner_token_hash")
