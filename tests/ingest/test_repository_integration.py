from __future__ import annotations

from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from psycopg import OperationalError, connect

from services.api.config import get_settings
from services.ingest.models import ConnectorJob
from services.ingest.normalize.models import NormalizedJob
from services.ingest.normalize.skills import SkillMatch
from services.ingest.repository import IngestionRepository


@pytest.mark.integration
def test_repository_bulk_upserts_jobs_and_skills_atomically() -> None:
    settings = get_settings()
    dsn = settings.database_url.replace("postgresql+psycopg://", "postgresql://", 1)
    try:
        with connect(dsn, autocommit=True) as connection:
            connection.execute("SELECT 1")
    except OperationalError:
        pytest.skip("PostgreSQL is not available")

    command.upgrade(Config("alembic.ini"), "head")
    token = uuid4().hex
    source_name = f"test-bulk-{token}"
    company_slug = f"test-company-{token}"
    blocking_key = f"test:{token}"
    esco_uri = f"https://data.europa.eu/esco/skill/{token}"
    skill = SkillMatch(
        esco_uri=esco_uri,
        name=f"Test skill {token}",
        aliases=[f"test-skill-{token}"],
        category="digital",
    )
    jobs = [
        NormalizedJob(
            source=ConnectorJob(
                source=source_name,
                source_job_id=str(index),
                source_url=f"https://example.com/jobs/{token}/{index}",
                attribution="Integration test",
                title=f"Engineer {index}",
                company_name="Bulk Test Company",
                company_slug=company_slug,
                description_html="Python and PostgreSQL",
            ),
            title_normalized=f"engineer {index}",
            description_md="Python and PostgreSQL",
            seniority="unknown",
            salary_period="unknown",
            skills=[skill],
            simhash=12345,
            blocking_key=blocking_key,
            quality_score=0.8,
        )
        for index in range(500)
    ]

    try:
        with IngestionRepository(settings.database_url) as repository:
            assert repository.save_jobs(jobs) == 500

        with connect(dsn, autocommit=True) as connection:
            first_seen = connection.execute(
                """
                SELECT min(ingested_at), max(ingested_at)
                FROM jobs
                WHERE source = %s
                """,
                (source_name,),
            ).fetchone()
            counts = connection.execute(
                """
                SELECT
                  count(DISTINCT job.id),
                  count(job_skill.job_id),
                  count(DISTINCT job.group_id),
                  count(DISTINCT job_group.canonical_job)
                FROM jobs AS job
                JOIN job_groups AS job_group ON job_group.id = job.group_id
                LEFT JOIN job_skills AS job_skill ON job_skill.job_id = job.id
                WHERE job.source = %s
                """,
                (source_name,),
            ).fetchone()
        assert first_seen is not None
        assert counts == (500, 500, 1, 1)

        updated_jobs = [
            job.model_copy(update={"description_md": "Updated description"}) for job in jobs
        ]
        with IngestionRepository(settings.database_url) as repository:
            assert repository.save_jobs(updated_jobs) == 500

        with connect(dsn, autocommit=True) as connection:
            second_seen = connection.execute(
                """
                SELECT min(ingested_at), max(ingested_at)
                FROM jobs
                WHERE source = %s
                """,
                (source_name,),
            ).fetchone()
            descriptions = connection.execute(
                """
                SELECT count(*)
                FROM jobs
                WHERE source = %s
                  AND description_md = 'Updated description'
                """,
                (source_name,),
            ).fetchone()
        assert second_seen == first_seen
        assert descriptions == (500,)
    finally:
        with connect(dsn, autocommit=True) as connection:
            connection.execute("DELETE FROM jobs WHERE source = %s", (source_name,))
            connection.execute(
                "DELETE FROM job_groups WHERE blocking_key = %s",
                (blocking_key,),
            )
            connection.execute(
                "DELETE FROM companies WHERE slug = %s",
                (company_slug,),
            )
            connection.execute(
                "DELETE FROM skills WHERE esco_uri = %s",
                (esco_uri,),
            )
