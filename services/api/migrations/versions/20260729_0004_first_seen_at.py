"""Name the immutable first-seen timestamp explicitly.

Revision ID: 20260729_0004
Revises: 20260729_0003
Create Date: 2026-07-29
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260729_0004"
down_revision: str | None = "20260729_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE jobs RENAME COLUMN ingested_at TO first_seen_at")


def downgrade() -> None:
    op.execute("ALTER TABLE jobs RENAME COLUMN first_seen_at TO ingested_at")
