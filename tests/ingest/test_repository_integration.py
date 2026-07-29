from __future__ import annotations

from datetime import UTC, datetime, timedelta
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
def test_repository_deactivates_all_scopes_for_global_sweep() -> None:
    settings = get_settings()
    dsn = settings.database_url.replace("postgresql+psycopg://", "postgresql://", 1)
    try:
        with connect(dsn, autocommit=True) as connection:
            connection.execute("SELECT 1")
    except OperationalError:
        pytest.skip("PostgreSQL is not available")

    command.upgrade(Config("alembic.ini"), "head")
    token = uuid4().hex
    source_name = f"test-deactivate-{token}"
    company_slugs = [f"test-company-a-{token}", f"test-company-b-{token}"]
    blocking_keys = [f"test:deactivate:a:{token}", f"test:deactivate:b:{token}"]
    jobs = [
        NormalizedJob(
            source=ConnectorJob(
                source=source_name,
                source_job_id=str(index),
                source_url=f"https://example.com/jobs/{token}/{index}",
                attribution="Integration test",
                title=f"Engineer {index}",
                company_name=f"Deactivate Company {index}",
                company_slug=company_slugs[index],
            ),
            title_normalized=f"engineer {index}",
            description_md="Test description",
            seniority="unknown",
            salary_period="unknown",
            skills=[],
            simhash=index,
            blocking_key=blocking_keys[index],
            quality_score=0.5,
        )
        for index in range(2)
    ]

    try:
        with IngestionRepository(settings.database_url) as repository:
            repository.save_jobs(jobs)
            deactivated = repository.deactivate_missing(
                source=source_name,
                source_scope=None,
                seen_since=datetime.now(UTC) + timedelta(seconds=1),
            )

        assert deactivated == 2
        with connect(dsn, autocommit=True) as connection:
            active = connection.execute(
                "SELECT count(*) FROM jobs WHERE source = %s AND is_active",
                (source_name,),
            ).fetchone()
        assert active == (0,)
    finally:
        with connect(dsn, autocommit=True) as connection:
            connection.execute("DELETE FROM jobs WHERE source = %s", (source_name,))
            connection.execute(
                "DELETE FROM job_groups WHERE blocking_key = ANY(%s)",
                (blocking_keys,),
            )
            connection.execute(
                "DELETE FROM companies WHERE slug = ANY(%s)",
                (company_slugs,),
            )


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
                SELECT min(first_seen_at), max(first_seen_at)
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
                SELECT min(first_seen_at), max(first_seen_at)
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


@pytest.mark.integration
def test_repository_resumes_only_incomplete_sweeps() -> None:
    settings = get_settings()
    dsn = settings.database_url.replace("postgresql+psycopg://", "postgresql://", 1)
    try:
        with connect(dsn, autocommit=True) as connection:
            connection.execute("SELECT 1")
    except OperationalError:
        pytest.skip("PostgreSQL is not available")

    command.upgrade(Config("alembic.ini"), "head")
    source_scope = f"test-checkpoint-{uuid4().hex}"
    try:
        with IngestionRepository(settings.database_url) as repository:
            initial = repository.begin_sweep(
                connector="test",
                source_scope=source_scope,
            )
            repository.save_sweep_progress(
                connector="test",
                source_scope=source_scope,
                cursor="500",
                processed=500,
                total_hint=1000,
            )

        with IngestionRepository(settings.database_url) as repository:
            resumed = repository.begin_sweep(
                connector="test",
                source_scope=source_scope,
            )
            repository.complete_sweep(
                connector="test",
                source_scope=source_scope,
                processed=1000,
                total_hint=1000,
            )
            restarted = repository.begin_sweep(
                connector="test",
                source_scope=source_scope,
            )

        assert initial.processed == 0
        assert resumed.cursor == "500"
        assert resumed.processed == 500
        assert resumed.started_at == initial.started_at
        assert restarted.cursor is None
        assert restarted.processed == 0
        assert restarted.started_at >= initial.started_at
    finally:
        with connect(dsn, autocommit=True) as connection:
            connection.execute(
                """
                DELETE FROM ingestion_checkpoints
                WHERE connector = 'test'
                  AND source_scope = %s
                """,
                (source_scope,),
            )
