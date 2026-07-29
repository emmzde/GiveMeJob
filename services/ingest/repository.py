from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime
from typing import cast

from pgvector.psycopg import register_vector
from psycopg import Connection, connect
from psycopg.types.json import Jsonb

from services.ingest.connectors._utils import slugify
from services.ingest.dedupe.simhash import hamming_distance
from services.ingest.normalize.models import NormalizedJob
from services.ingest.normalize.skills import SkillDefinition, SkillMatch

_DEDUPE_DISTANCE = 3


class IngestionRepository:
    """Idempotent PostgreSQL persistence for normalized ingestion records."""

    def __init__(self, database_url: str) -> None:
        dsn = database_url.replace("postgresql+psycopg://", "postgresql://", 1)
        self._connection = cast(
            Connection[tuple[object, ...]],
            connect(dsn, autocommit=True),
        )
        register_vector(self._connection)
        self._company_ids: dict[str, int] = {}
        self._skill_ids: dict[str, int] = {}
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

    def save_jobs(self, jobs: Iterable[NormalizedJob]) -> int:
        saved = 0
        with self._connection.transaction():
            for job in jobs:
                self._save_job(job)
                saved += 1
        return saved

    def deactivate_missing(
        self,
        *,
        source: str,
        source_scope: str,
        seen_since: datetime,
    ) -> int:
        with self._connection.transaction():
            cursor = self._connection.execute(
                """
                UPDATE jobs
                SET is_active = false, updated_at = now()
                WHERE source = %s
                  AND source_scope = %s
                  AND last_seen_at < %s
                  AND is_active
                """,
                (source, source_scope, seen_since),
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

    def _save_job(self, job: NormalizedJob) -> None:
        source = job.source
        company_slug = source.company_slug or slugify(source.company_name)
        company_id = self._company_id(
            name=source.company_name,
            slug=company_slug,
            logo_url=source.company_logo_url,
        )
        group_id = self._group_id(job.blocking_key, job.simhash)
        source_scope = source.company_slug or source.source
        row = self._connection.execute(
            """
            INSERT INTO jobs (
              group_id, company_id, title, title_normalized, description_md,
              seniority, employment_type, remote_type, country, city,
              salary_min, salary_max, salary_currency, salary_period, salary_usd_year,
              min_years_exp, posted_at, expires_at, source, source_scope,
              source_job_id, source_url, apply_url, attribution, quality_score,
              raw, embedding, is_active, last_seen_at, updated_at
            )
            VALUES (
              %s, %s, %s, %s, %s,
              %s, %s, %s, %s, %s,
              %s, %s, %s, %s, %s,
              %s, %s, %s, %s, %s,
              %s, %s, %s, %s, %s,
              %s, %s, true, now(), now()
            )
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
            RETURNING id
            """,
            (
                group_id,
                company_id,
                source.title,
                job.title_normalized,
                job.description_md,
                job.seniority.value,
                source.employment_type.value,
                source.remote_type.value,
                job.country,
                job.city,
                job.salary_min,
                job.salary_max,
                job.salary_currency,
                job.salary_period.value,
                job.salary_usd_year,
                job.min_years_exp,
                source.posted_at,
                source.expires_at,
                source.source,
                source_scope,
                source.source_job_id,
                source.source_url,
                source.apply_url,
                source.attribution,
                job.quality_score,
                Jsonb(source.raw),
                job.embedding,
            ),
        ).fetchone()
        if row is None:
            raise RuntimeError("job upsert did not return an id")
        job_id = cast(int, row[0])
        self._connection.execute(
            "UPDATE job_groups SET canonical_job = COALESCE(canonical_job, %s) WHERE id = %s",
            (job_id, group_id),
        )
        self._replace_job_skills(job_id, job.skills)

    def _company_id(self, *, name: str, slug: str, logo_url: str | None) -> int:
        cached = self._company_ids.get(slug)
        if cached is not None:
            return cached
        row = self._connection.execute(
            """
            INSERT INTO companies (name, slug, logo_url)
            VALUES (%s, %s, %s)
            ON CONFLICT (slug)
            DO UPDATE SET
              name = EXCLUDED.name,
              logo_url = COALESCE(EXCLUDED.logo_url, companies.logo_url)
            RETURNING id
            """,
            (name, slug, logo_url),
        ).fetchone()
        if row is None:
            raise RuntimeError("company upsert did not return an id")
        company_id = cast(int, row[0])
        self._company_ids[slug] = company_id
        return company_id

    def _group_id(self, blocking_key: str, simhash: int) -> int:
        candidates = self._groups.setdefault(blocking_key, [])
        for group_id, candidate_hash in candidates:
            if hamming_distance(simhash, candidate_hash) <= _DEDUPE_DISTANCE:
                return group_id
        row = self._connection.execute(
            """
            INSERT INTO job_groups (blocking_key, simhash)
            VALUES (%s, %s)
            RETURNING id
            """,
            (blocking_key, simhash),
        ).fetchone()
        if row is None:
            raise RuntimeError("job group insert did not return an id")
        group_id = cast(int, row[0])
        candidates.append((group_id, simhash))
        return group_id

    def _replace_job_skills(self, job_id: int, skills: list[SkillMatch]) -> None:
        self._connection.execute("DELETE FROM job_skills WHERE job_id = %s", (job_id,))
        for skill in skills:
            skill_id = self._skill_id(skill)
            self._connection.execute(
                """
                INSERT INTO job_skills (job_id, skill_id, requirement)
                VALUES (%s, %s, %s)
                ON CONFLICT (job_id, skill_id)
                DO UPDATE SET requirement = EXCLUDED.requirement
                """,
                (job_id, skill_id, skill.requirement),
            )

    def _skill_id(self, skill: SkillMatch) -> int:
        cached = self._skill_ids.get(skill.esco_uri)
        if cached is not None:
            return cached
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
            (skill.name, skill.aliases, skill.category, skill.esco_uri),
        ).fetchone()
        if row is None:
            raise RuntimeError("skill upsert did not return an id")
        skill_id = cast(int, row[0])
        self._skill_ids[skill.esco_uri] = skill_id
        return skill_id

    def _load_groups(self) -> dict[str, list[tuple[int, int]]]:
        rows = self._connection.execute(
            "SELECT id, blocking_key, simhash FROM job_groups"
        ).fetchall()
        groups: dict[str, list[tuple[int, int]]] = {}
        for row in rows:
            groups.setdefault(cast(str, row[1]), []).append((cast(int, row[0]), cast(int, row[2])))
        return groups
