"""Persist resumable ingestion sweep checkpoints.

Revision ID: 20260729_0005
Revises: 20260729_0004
Create Date: 2026-07-29
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260729_0005"
down_revision: str | None = "20260729_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE ingestion_checkpoints (
          connector      TEXT NOT NULL,
          source_scope   TEXT NOT NULL,
          cursor         TEXT,
          processed      BIGINT NOT NULL DEFAULT 0,
          total_hint     BIGINT,
          started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
          completed_at   TIMESTAMPTZ,
          PRIMARY KEY (connector, source_scope)
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ingestion_checkpoints")
