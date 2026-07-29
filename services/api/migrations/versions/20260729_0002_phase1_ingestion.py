"""Add Phase 1 ingestion identity and lifecycle fields.

Revision ID: 20260729_0002
Revises: 20260729_0001
Create Date: 2026-07-29
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260729_0002"
down_revision: str | None = "20260729_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE jobs
          ADD COLUMN source_job_id TEXT,
          ADD COLUMN attribution TEXT,
          ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true,
          ADD COLUMN last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          ADD COLUMN ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        """
    )
    op.execute("UPDATE jobs SET source_job_id = id::text WHERE source_job_id IS NULL")
    op.execute("UPDATE jobs SET attribution = source WHERE attribution IS NULL")
    op.execute("ALTER TABLE jobs ALTER COLUMN source_job_id SET NOT NULL")
    op.execute("ALTER TABLE jobs ALTER COLUMN attribution SET NOT NULL")
    op.execute(
        """
        CREATE UNIQUE INDEX uq_jobs_source_identity
        ON jobs (source, source_job_id)
        """
    )
    op.execute(
        """
        CREATE INDEX ix_jobs_active_posted_at
        ON jobs (is_active, posted_at DESC)
        """
    )
    op.execute("CREATE INDEX ix_job_groups_simhash ON job_groups (simhash)")
    op.execute("ALTER TABLE skills ADD COLUMN esco_uri TEXT")
    op.execute(
        """
        CREATE UNIQUE INDEX uq_skills_esco_uri
        ON skills (esco_uri)
        WHERE esco_uri IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_skills_esco_uri")
    op.execute("ALTER TABLE skills DROP COLUMN IF EXISTS esco_uri")
    op.execute("DROP INDEX IF EXISTS ix_job_groups_simhash")
    op.execute("DROP INDEX IF EXISTS ix_jobs_active_posted_at")
    op.execute("DROP INDEX IF EXISTS uq_jobs_source_identity")
    op.execute(
        """
        ALTER TABLE jobs
          DROP COLUMN IF EXISTS updated_at,
          DROP COLUMN IF EXISTS ingested_at,
          DROP COLUMN IF EXISTS last_seen_at,
          DROP COLUMN IF EXISTS is_active,
          DROP COLUMN IF EXISTS attribution,
          DROP COLUMN IF EXISTS source_job_id
        """
    )
