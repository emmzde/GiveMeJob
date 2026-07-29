from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import cast

from pgvector.psycopg import register_vector
from psycopg import Connection, connect
from psycopg.types.json import Jsonb

from services.ingest.connectors._utils import slugify
from services.ingest.dedupe.simhash import DEDUPE_HAMMING_THRESHOLD, hamming_distance
from services.ingest.normalize.models import NormalizedJob
from services.ingest.normalize.skills import SkillDefinition, SkillMatch

_STAGING_TABLE_DDL = (
    """
    CREATE TEMP TABLE IF NOT EXISTS _ingest_companies_stage (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logo_url TEXT
    ) ON COMMIT PRESERVE ROWS
    """,
    """
    CREATE TEMP TABLE IF NOT EXISTS _ingest_groups_stage (
      blocking_key TEXT NOT NULL,
      simhash BIGINT NOT NULL,
      PRIMARY KEY (blocking_key, simhash)
    ) ON COMMIT PRESERVE ROWS
    """,
    """
    CREATE TEMP TABLE IF NOT EXISTS _ingest_skills_stage (
      esco_uri TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      aliases TEXT[] NOT NULL,
      category TEXT NOT NULL
    ) ON COMMIT PRESERVE ROWS
    """,
    """
    CREATE TEMP TABLE IF NOT EXISTS _ingest_jobs_stage (
      batch_index INTEGER PRIMARY KEY,
      group_id BIGINT NOT NULL,
      company_id BIGINT NOT NULL,
      title TEXT NOT NULL,
      title_normalized TEXT NOT NULL,
      description_md TEXT NOT NULL,
      seniority TEXT NOT NULL,
      employment_type TEXT NOT NULL,
      remote_type TEXT NOT NULL,
      country TEXT,
      city TEXT,
      salary_min NUMERIC,
      salary_max NUMERIC,
      salary_currency TEXT,
      salary_period TEXT NOT NULL,
      salary_usd_year NUMERIC,
      min_years_exp SMALLINT,
      posted_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      source TEXT NOT NULL,
      source_scope TEXT NOT NULL,
      source_job_id TEXT NOT NULL,
      source_url TEXT NOT NULL,
      apply_url TEXT,
      attribution TEXT NOT NULL,
      quality_score REAL NOT NULL,
      raw JSONB NOT NULL,
      embedding VECTOR(1024)
    ) ON COMMIT PRESERVE ROWS
    """,
    """
    CREATE TEMP TABLE IF NOT EXISTS _ingest_job_skills_stage (
      job_id BIGINT NOT NULL,
      skill_id BIGINT NOT NULL,
      requirement TEXT NOT NULL,
      PRIMARY KEY (job_id, skill_id)
    ) ON COMMIT PRESERVE ROWS
    """,
)


@dataclass(frozen=True)
class IngestionCheckpoint:
    cursor: str | None
    processed: int
    total_hint: int | None
    started_at: datetime


class IngestionRepository:
    """Idempotent PostgreSQL persistence for normalized ingestion records."""

    def __init__(self, database_url: str) -> None:
        dsn = database_url.replace("postgresql+psycopg://", "postgresql://", 1)
        self._connection = cast(
            Connection[tuple[object, ...]],
            connect(dsn, autocommit=True),
        )
        register_vector(self._connection)
        self._ensure_staging_tables()
        self._company_ids = self._load_company_ids()
        self._skill_ids = self._load_skill_ids()
        self._groups = self._load_groups()

    def __enter__(self) -> IngestionRepository:
        return self

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
        del exc_type, exc, traceback
        self.close()

    def close(self) -> None:
        self._connection.close()

    def seed_skills(self, definitions: Iterable[SkillDefinition]) -> int:
        unique_definitions: dict[str, SkillDefinition] = {}
        for definition in definitions:
            existing = unique_definitions.get(definition.esco_uri)
            if existing is None:
                unique_definitions[definition.esco_uri] = definition
                continue
            aliases = list(dict.fromkeys([*existing.aliases, *definition.aliases]))
            unique_definitions[definition.esco_uri] = existing.model_copy(
                update={"aliases": aliases}
            )
        count = 0
        with self._connection.transaction():
            for definition in unique_definitions.values():
                row = self._connection.execute(
                    """
                    INSERT INTO skills (name, aliases, category, esco_uri)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (esco_uri) WHERE esco_uri IS NOT NULL
                    DO UPDATE SET
                      name = EXCLUDED.name,
                      aliases = EXCLUDED.aliases,
                      category = EXCLUDED.category
                    RETURNING id
                    """,
                    (
                        definition.name,
                        definition.aliases,
                        definition.category,
                        definition.esco_uri,
                    ),
                ).fetchone()
                if row is None:
                    raise RuntimeError("skill upsert did not return an id")
                self._skill_ids[definition.esco_uri] = cast(int, row[0])
                count += 1
        return count

    def prune_unreferenced_skills(self, keep_uris: list[str]) -> int:
        with self._connection.transaction():
            cursor = self._connection.execute(
                """
                DELETE FROM skills AS skill
                WHERE NOT (skill.esco_uri = ANY(%s))
                  AND NOT EXISTS (
                    SELECT 1
                    FROM job_skills
                    WHERE job_skills.skill_id = skill.id
                  )
                """,
                (keep_uris,),
            )
        return cursor.rowcount

    def load_skills(self) -> list[SkillDefinition]:
        rows = self._connection.execute(
            """
            SELECT esco_uri, name, aliases, category
            FROM skills
            WHERE esco_uri IS NOT NULL
            ORDER BY id
            """
        ).fetchall()
        return [
            SkillDefinition(
                esco_uri=cast(str, row[0]),
                name=cast(str, row[1]),
                aliases=cast(list[str], row[2]),
                category=cast(str, row[3]),
            )
            for row in rows
        ]

    def begin_sweep(
        self,
        *,
        connector: str,
        source_scope: str,
    ) -> IngestionCheckpoint:
        row = self._connection.execute(
            """
            SELECT cursor, processed, total_hint, started_at, completed_at
            FROM ingestion_checkpoints
            WHERE connector = %s
              AND source_scope = %s
            """,
            (connector, source_scope),
        ).fetchone()
        if row is not None and row[4] is None:
            return IngestionCheckpoint(
                cursor=cast(str | None, row[0]),
                processed=cast(int, row[1]),
                total_hint=cast(int | None, row[2]),
                started_at=cast(datetime, row[3]),
            )

        reset = self._connection.execute(
            """
            INSERT INTO ingestion_checkpoints (
              connector, source_scope, cursor, processed, total_hint,
              started_at, updated_at, completed_at
            )
            VALUES (%s, %s, NULL, 0, NULL, now(), now(), NULL)
            ON CONFLICT (connector, source_scope)
            DO UPDATE SET
              cursor = NULL,
              processed = 0,
              total_hint = NULL,
              started_at = now(),
              updated_at = now(),
              completed_at = NULL
            RETURNING cursor, processed, total_hint, started_at
            """,
            (connector, source_scope),
        ).fetchone()
        if reset is None:
            raise RuntimeError("sweep checkpoint reset returned no row")
        return IngestionCheckpoint(
            cursor=cast(str | None, reset[0]),
            processed=cast(int, reset[1]),
            total_hint=cast(int | None, reset[2]),
            started_at=cast(datetime, reset[3]),
        )

    def save_sweep_progress(
        self,
        *,
        connector: str,
        source_scope: str,
        cursor: str | None,
        processed: int,
        total_hint: int | None,
    ) -> None:
        self._connection.execute(
            """
            INSERT INTO ingestion_checkpoints (
              connector, source_scope, cursor, processed, total_hint,
              started_at, updated_at, completed_at
            )
            VALUES (%s, %s, %s, %s, %s, now(), now(), NULL)
            ON CONFLICT (connector, source_scope)
            DO UPDATE SET
              cursor = EXCLUDED.cursor,
              processed = EXCLUDED.processed,
              total_hint = EXCLUDED.total_hint,
              updated_at = now(),
              completed_at = NULL
            """,
            (connector, source_scope, cursor, processed, total_hint),
        )

    def complete_sweep(
        self,
        *,
        connector: str,
        source_scope: str,
        processed: int,
        total_hint: int | None,
    ) -> None:
        cursor = self._connection.execute(
            """
            UPDATE ingestion_checkpoints
            SET cursor = NULL,
                processed = %s,
                total_hint = %s,
                updated_at = now(),
                completed_at = now()
            WHERE connector = %s
              AND source_scope = %s
            """,
            (processed, total_hint, connector, source_scope),
        )
        if cursor.rowcount != 1:
            raise RuntimeError("sweep checkpoint completion updated no row")

    def save_jobs(self, jobs: Iterable[NormalizedJob]) -> int:
        unique_jobs: dict[tuple[str, str], NormalizedJob] = {}
        for job in jobs:
            identity = (job.source.source, job.source.source_job_id)
            unique_jobs[identity] = job
        batch = list(unique_jobs.values())
        if not batch:
            return 0

        try:
            with self._connection.transaction():
                self._connection.execute(
                    """
                    TRUNCATE
                      _ingest_companies_stage,
                      _ingest_groups_stage,
                      _ingest_skills_stage,
                      _ingest_jobs_stage,
                      _ingest_job_skills_stage
                    """
                )
                company_ids = self._upsert_companies(batch)
                self._upsert_skills(batch)
                group_ids = self._resolve_group_ids(batch)
                job_ids = self._upsert_jobs(batch, company_ids, group_ids)
                self._replace_job_skills(batch, job_ids)
        except Exception:
            self._company_ids = self._load_company_ids()
            self._skill_ids = self._load_skill_ids()
            self._groups = self._load_groups()
            raise
        return len(batch)

    def deactivate_missing(
        self,
        *,
        source: str,
        source_scope: str | None,
        seen_since: datetime,
    ) -> int:
        with self._connection.transaction():
            cursor = self._connection.execute(
                """
                UPDATE jobs
                SET is_active = false, updated_at = now()
                WHERE source = %s
                  AND (%s IS NULL OR source_scope = %s)
                  AND last_seen_at < %s
                  AND is_active
                """,
                (source, source_scope, source_scope, seen_since),
            )
        return cursor.rowcount

    def backfill_embeddings(
        self,
        rows: Iterable[tuple[int, list[float]]],
    ) -> int:
        updated = 0
        with self._connection.transaction():
            for job_id, embedding in rows:
                cursor = self._connection.execute(
                    "UPDATE jobs SET embedding = %s, updated_at = now() WHERE id = %s",
                    (embedding, job_id),
                )
                updated += cursor.rowcount
        return updated

    def jobs_without_embeddings(self, *, limit: int) -> list[tuple[int, str]]:
        rows = self._connection.execute(
            """
            SELECT id, concat_ws(E'\n', title, description_md)
            FROM jobs
            WHERE embedding IS NULL
            ORDER BY id
            LIMIT %s
            """,
            (limit,),
        ).fetchall()
        return [(cast(int, row[0]), cast(str, row[1])) for row in rows]

    def _upsert_companies(self, jobs: list[NormalizedJob]) -> list[int]:
        companies: dict[str, tuple[str, str | None]] = {}
        slugs: list[str] = []
        for job in jobs:
            source = job.source
            slug = source.company_slug or slugify(source.company_name)
            companies[slug] = (source.company_name, source.company_logo_url)
            slugs.append(slug)

        self._copy_rows(
            """
            COPY _ingest_companies_stage (slug, name, logo_url)
            FROM STDIN
            """,
            ((slug, name, logo_url) for slug, (name, logo_url) in companies.items()),
        )
        rows = self._connection.execute(
            """
            INSERT INTO companies (slug, name, logo_url)
            SELECT slug, name, logo_url
            FROM _ingest_companies_stage
            ON CONFLICT (slug)
            DO UPDATE SET
              name = EXCLUDED.name,
              logo_url = COALESCE(EXCLUDED.logo_url, companies.logo_url)
            RETURNING id, slug
            """
        ).fetchall()
        self._company_ids.update({cast(str, row[1]): cast(int, row[0]) for row in rows})
        try:
            return [self._company_ids[slug] for slug in slugs]
        except KeyError as exc:
            raise RuntimeError(f"company upsert did not return slug {exc.args[0]}") from exc

    def _upsert_skills(self, jobs: list[NormalizedJob]) -> None:
        skills: dict[str, SkillMatch] = {}
        for job in jobs:
            for skill in job.skills:
                skills[skill.esco_uri] = skill
        if not skills:
            return

        self._copy_rows(
            """
            COPY _ingest_skills_stage (esco_uri, name, aliases, category)
            FROM STDIN
            """,
            (
                (skill.esco_uri, skill.name, skill.aliases, skill.category)
                for skill in skills.values()
            ),
        )
        rows = self._connection.execute(
            """
            INSERT INTO skills (esco_uri, name, aliases, category)
            SELECT esco_uri, name, aliases, category
            FROM _ingest_skills_stage
            ON CONFLICT (esco_uri) WHERE esco_uri IS NOT NULL
            DO UPDATE SET
              name = EXCLUDED.name,
              aliases = EXCLUDED.aliases,
              category = EXCLUDED.category
            RETURNING id, esco_uri
            """
        ).fetchall()
        self._skill_ids.update({cast(str, row[1]): cast(int, row[0]) for row in rows})

    def _resolve_group_ids(self, jobs: list[NormalizedJob]) -> list[int]:
        references: list[int | tuple[str, int]] = []
        pending_by_block: dict[str, list[tuple[tuple[str, int], int]]] = {}

        for job in jobs:
            resolved: int | tuple[str, int] | None = None
            for group_id, candidate_hash in self._groups.setdefault(job.blocking_key, []):
                if hamming_distance(job.simhash, candidate_hash) <= DEDUPE_HAMMING_THRESHOLD:
                    resolved = group_id
                    break
            if resolved is None:
                pending = pending_by_block.setdefault(job.blocking_key, [])
                for pending_key, candidate_hash in pending:
                    if hamming_distance(job.simhash, candidate_hash) <= DEDUPE_HAMMING_THRESHOLD:
                        resolved = pending_key
                        break
                if resolved is None:
                    resolved = (job.blocking_key, job.simhash)
                    pending.append((resolved, job.simhash))
            references.append(resolved)

        pending_keys = [
            pending_key for pending in pending_by_block.values() for pending_key, _ in pending
        ]
        inserted: dict[tuple[str, int], int] = {}
        if pending_keys:
            self._copy_rows(
                """
                COPY _ingest_groups_stage (blocking_key, simhash)
                FROM STDIN
                """,
                pending_keys,
            )
            rows = self._connection.execute(
                """
                INSERT INTO job_groups (blocking_key, simhash)
                SELECT blocking_key, simhash
                FROM _ingest_groups_stage
                RETURNING id, blocking_key, simhash
                """
            ).fetchall()
            inserted = {(cast(str, row[1]), cast(int, row[2])): cast(int, row[0]) for row in rows}
            for (blocking_key, simhash), group_id in inserted.items():
                self._groups.setdefault(blocking_key, []).append((group_id, simhash))

        try:
            return [
                reference if isinstance(reference, int) else inserted[reference]
                for reference in references
            ]
        except KeyError as exc:
            raise RuntimeError("job group batch insert did not return an id") from exc

    def _upsert_jobs(
        self,
        jobs: list[NormalizedJob],
        company_ids: list[int],
        group_ids: list[int],
    ) -> list[int]:
        self._copy_rows(
            """
            COPY _ingest_jobs_stage (
              batch_index, group_id, company_id, title, title_normalized,
              description_md, seniority, employment_type, remote_type, country,
              city, salary_min, salary_max, salary_currency, salary_period,
              salary_usd_year, min_years_exp, posted_at, expires_at, source,
              source_scope, source_job_id, source_url, apply_url, attribution,
              quality_score, raw, embedding
            )
            FROM STDIN
            """,
            (
                (
                    batch_index,
                    group_id,
                    company_id,
                    job.source.title,
                    job.title_normalized,
                    job.description_md,
                    job.seniority.value,
                    job.source.employment_type.value,
                    job.source.remote_type.value,
                    job.country,
                    job.city,
                    job.salary_min,
                    job.salary_max,
                    job.salary_currency,
                    job.salary_period.value,
                    job.salary_usd_year,
                    job.min_years_exp,
                    job.source.posted_at,
                    job.source.expires_at,
                    job.source.source,
                    job.source.company_slug or job.source.source,
                    job.source.source_job_id,
                    job.source.source_url,
                    job.source.apply_url,
                    job.source.attribution,
                    job.quality_score,
                    Jsonb(job.source.raw),
                    job.embedding,
                )
                for batch_index, (job, company_id, group_id) in enumerate(
                    zip(jobs, company_ids, group_ids, strict=True)
                )
            ),
        )
        old_group_rows = self._connection.execute(
            """
            SELECT DISTINCT job.group_id
            FROM jobs AS job
            JOIN _ingest_jobs_stage AS staged
              ON staged.source = job.source
             AND staged.source_job_id = job.source_job_id
            """
        ).fetchall()
        old_group_ids = [cast(int, row[0]) for row in old_group_rows]
        rows = self._connection.execute(
            """
            INSERT INTO jobs (
              group_id, company_id, title, title_normalized, description_md,
              seniority, employment_type, remote_type, country, city,
              salary_min, salary_max, salary_currency, salary_period, salary_usd_year,
              min_years_exp, posted_at, expires_at, source, source_scope,
              source_job_id, source_url, apply_url, attribution, quality_score,
              raw, embedding, is_active, last_seen_at, updated_at
            )
            SELECT
              group_id, company_id, title, title_normalized, description_md,
              seniority, employment_type, remote_type, country, city,
              salary_min, salary_max, salary_currency, salary_period, salary_usd_year,
              min_years_exp, posted_at, expires_at, source, source_scope,
              source_job_id, source_url, apply_url, attribution, quality_score,
              raw, embedding, true, now(), now()
            FROM _ingest_jobs_stage
            ORDER BY batch_index
            ON CONFLICT (source, source_job_id)
            DO UPDATE SET
              group_id = EXCLUDED.group_id,
              company_id = EXCLUDED.company_id,
              title = EXCLUDED.title,
              title_normalized = EXCLUDED.title_normalized,
              description_md = EXCLUDED.description_md,
              seniority = EXCLUDED.seniority,
              employment_type = EXCLUDED.employment_type,
              remote_type = EXCLUDED.remote_type,
              country = EXCLUDED.country,
              city = EXCLUDED.city,
              salary_min = EXCLUDED.salary_min,
              salary_max = EXCLUDED.salary_max,
              salary_currency = EXCLUDED.salary_currency,
              salary_period = EXCLUDED.salary_period,
              salary_usd_year = EXCLUDED.salary_usd_year,
              min_years_exp = EXCLUDED.min_years_exp,
              posted_at = EXCLUDED.posted_at,
              expires_at = EXCLUDED.expires_at,
              source_scope = EXCLUDED.source_scope,
              source_url = EXCLUDED.source_url,
              apply_url = EXCLUDED.apply_url,
              attribution = EXCLUDED.attribution,
              quality_score = EXCLUDED.quality_score,
              raw = EXCLUDED.raw,
              embedding = COALESCE(EXCLUDED.embedding, jobs.embedding),
              is_active = true,
              last_seen_at = now(),
              updated_at = now()
            RETURNING id, group_id, source, source_job_id
            """
        ).fetchall()
        identity_to_id = {(cast(str, row[2]), cast(str, row[3])): cast(int, row[0]) for row in rows}
        job_ids = [identity_to_id[(job.source.source, job.source.source_job_id)] for job in jobs]
        affected_group_ids = list(set([*old_group_ids, *group_ids]))
        self._connection.execute(
            """
            UPDATE job_groups AS job_group
            SET canonical_job = candidates.job_id
            FROM (
              SELECT DISTINCT ON (group_id) group_id, id AS job_id
              FROM jobs
              WHERE group_id = ANY(%s)
              ORDER BY
                group_id,
                is_active DESC,
                quality_score DESC NULLS LAST,
                posted_at DESC NULLS LAST,
                id
            ) AS candidates
            WHERE job_group.id = candidates.group_id
            """,
            (affected_group_ids,),
        )
        self._connection.execute(
            """
            UPDATE job_groups AS job_group
            SET canonical_job = NULL
            WHERE job_group.id = ANY(%s)
              AND NOT EXISTS (
                SELECT 1
                FROM jobs
                WHERE jobs.group_id = job_group.id
              )
            """,
            (affected_group_ids,),
        )
        return job_ids

    def _replace_job_skills(
        self,
        jobs: list[NormalizedJob],
        job_ids: list[int],
    ) -> None:
        self._connection.execute(
            "DELETE FROM job_skills WHERE job_id = ANY(%s)",
            (job_ids,),
        )
        skill_rows: dict[tuple[int, int], str] = {}
        for job, job_id in zip(jobs, job_ids, strict=True):
            for skill in job.skills:
                try:
                    skill_id = self._skill_ids[skill.esco_uri]
                except KeyError as exc:
                    raise RuntimeError(f"skill upsert did not return URI {skill.esco_uri}") from exc
                skill_rows[(job_id, skill_id)] = skill.requirement
        if not skill_rows:
            return

        self._copy_rows(
            """
            COPY _ingest_job_skills_stage (job_id, skill_id, requirement)
            FROM STDIN
            """,
            (
                (job_id, skill_id, requirement)
                for (job_id, skill_id), requirement in skill_rows.items()
            ),
        )
        self._connection.execute(
            """
            INSERT INTO job_skills (job_id, skill_id, requirement)
            SELECT job_id, skill_id, requirement
            FROM _ingest_job_skills_stage
            ON CONFLICT (job_id, skill_id)
            DO UPDATE SET requirement = EXCLUDED.requirement
            """
        )

    def _ensure_staging_tables(self) -> None:
        for statement in _STAGING_TABLE_DDL:
            self._connection.execute(statement)

    def _copy_rows(
        self,
        statement: str,
        rows: Iterable[Sequence[object]],
    ) -> None:
        with self._connection.cursor() as cursor, cursor.copy(statement) as copy:
            for row in rows:
                copy.write_row(row)

    def _load_company_ids(self) -> dict[str, int]:
        rows = self._connection.execute(
            "SELECT slug, id FROM companies WHERE slug IS NOT NULL"
        ).fetchall()
        return {cast(str, row[0]): cast(int, row[1]) for row in rows}

    def _load_skill_ids(self) -> dict[str, int]:
        rows = self._connection.execute(
            "SELECT esco_uri, id FROM skills WHERE esco_uri IS NOT NULL"
        ).fetchall()
        return {cast(str, row[0]): cast(int, row[1]) for row in rows}

    def _load_groups(self) -> dict[str, list[tuple[int, int]]]:
        rows = self._connection.execute(
            "SELECT id, blocking_key, simhash FROM job_groups"
        ).fetchall()
        groups: dict[str, list[tuple[int, int]]] = {}
        for row in rows:
            groups.setdefault(cast(str, row[1]), []).append((cast(int, row[0]), cast(int, row[2])))
        return groups
