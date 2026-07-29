"""Add deduplication blocks and source scopes.

Revision ID: 20260729_0003
Revises: 20260729_0002
Create Date: 2026-07-29
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260729_0003"
down_revision: str | None = "20260729_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE job_groups ADD COLUMN blocking_key TEXT")
    op.execute("UPDATE job_groups SET blocking_key = 'legacy' WHERE blocking_key IS NULL")
    op.execute("ALTER TABLE job_groups ALTER COLUMN blocking_key SET NOT NULL")
    op.execute(
        """
        CREATE INDEX ix_job_groups_blocking_key
        ON job_groups (blocking_key)
        """
    )
    op.execute("ALTER TABLE jobs ADD COLUMN source_scope TEXT")
    op.execute("UPDATE jobs SET source_scope = source WHERE source_scope IS NULL")
    op.execute("ALTER TABLE jobs ALTER COLUMN source_scope SET NOT NULL")
    op.execute(
        """
        CREATE INDEX ix_jobs_source_scope_active
        ON jobs (source, source_scope, is_active)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_jobs_source_scope_active")
    op.execute("ALTER TABLE jobs DROP COLUMN IF EXISTS source_scope")
    op.execute("DROP INDEX IF EXISTS ix_job_groups_blocking_key")
    op.execute("ALTER TABLE job_groups DROP COLUMN IF EXISTS blocking_key")
