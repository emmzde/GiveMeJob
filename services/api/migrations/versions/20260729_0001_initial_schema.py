"""Create the initial GiveMeJob schema.

Revision ID: 20260729_0001
Revises:
Create Date: 2026-07-29
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260729_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.execute(
        """
        CREATE TABLE companies (
          id            BIGSERIAL PRIMARY KEY,
          name          TEXT NOT NULL,
          slug          TEXT UNIQUE,
          website       TEXT,
          logo_url      TEXT,
          size_bucket   TEXT,
          industry      TEXT
        )
        """
    )
    op.execute(
        """
        CREATE TABLE job_groups (
          id            BIGSERIAL PRIMARY KEY,
          canonical_job BIGINT,
          simhash       BIGINT,
          created_at    TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE jobs (
          id               BIGSERIAL PRIMARY KEY,
          group_id         BIGINT REFERENCES job_groups(id),
          company_id       BIGINT REFERENCES companies(id),
          title            TEXT NOT NULL,
          title_normalized TEXT,
          description_md   TEXT,
          seniority        TEXT,
          employment_type  TEXT,
          remote_type      TEXT,
          country          TEXT,
          city             TEXT,
          timezone_hint    TEXT,
          salary_min       NUMERIC,
          salary_max       NUMERIC,
          salary_currency  TEXT,
          salary_period    TEXT,
          salary_usd_year  NUMERIC,
          visa_sponsorship BOOLEAN,
          min_years_exp    SMALLINT,
          posted_at        TIMESTAMPTZ,
          expires_at       TIMESTAMPTZ,
          source           TEXT NOT NULL,
          source_url       TEXT NOT NULL,
          apply_url        TEXT,
          quality_score    REAL,
          raw              JSONB,
          embedding        VECTOR(1024),
          fts              TSVECTOR GENERATED ALWAYS AS (
                             to_tsvector(
                               'simple',
                               coalesce(title, '') || ' ' || coalesce(description_md, '')
                             )
                           ) STORED
        )
        """
    )
    op.execute(
        """
        CREATE INDEX ix_jobs_embedding_hnsw
        ON jobs USING hnsw (embedding vector_cosine_ops)
        """
    )
    op.execute("CREATE INDEX ix_jobs_fts ON jobs USING gin (fts)")
    op.execute("CREATE INDEX ix_jobs_posted_at ON jobs (posted_at DESC)")

    op.execute(
        """
        CREATE TABLE skills (
          id       BIGSERIAL PRIMARY KEY,
          name     TEXT UNIQUE,
          aliases  TEXT[],
          category TEXT
        )
        """
    )
    op.execute(
        """
        CREATE TABLE job_skills (
          job_id      BIGINT REFERENCES jobs(id) ON DELETE CASCADE,
          skill_id    BIGINT REFERENCES skills(id),
          requirement TEXT,
          PRIMARY KEY (job_id, skill_id)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE profiles (
          id             BIGSERIAL PRIMARY KEY,
          user_id        BIGINT,
          version        INT,
          years_total    REAL,
          seniority      TEXT,
          countries_ok   TEXT[],
          work_auth      JSONB,
          languages      JSONB,
          preferences    JSONB,
          resume_md      TEXT,
          embedding      VECTOR(1024)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE profile_skills (
          profile_id BIGINT,
          skill_id   BIGINT,
          years      REAL,
          level      SMALLINT,
          evidence   TEXT,
          PRIMARY KEY (profile_id, skill_id)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE match_scores (
          profile_id      BIGINT,
          job_id          BIGINT,
          profile_version INT,
          fit_score       REAL,
          probability     REAL,
          prob_low        REAL,
          prob_high       REAL,
          components      JSONB,
          llm_adjustment  REAL,
          explanation     JSONB,
          model_used      TEXT,
          computed_at     TIMESTAMPTZ DEFAULT now(),
          PRIMARY KEY (profile_id, job_id, profile_version)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE applications (
          id                    BIGSERIAL PRIMARY KEY,
          profile_id            BIGINT,
          job_id                BIGINT,
          status                TEXT,
          predicted_probability REAL,
          timeline              JSONB,
          updated_at            TIMESTAMPTZ
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS applications")
    op.execute("DROP TABLE IF EXISTS match_scores")
    op.execute("DROP TABLE IF EXISTS profile_skills")
    op.execute("DROP TABLE IF EXISTS profiles")
    op.execute("DROP TABLE IF EXISTS job_skills")
    op.execute("DROP TABLE IF EXISTS skills")
    op.execute("DROP TABLE IF EXISTS jobs")
    op.execute("DROP TABLE IF EXISTS job_groups")
    op.execute("DROP TABLE IF EXISTS companies")
