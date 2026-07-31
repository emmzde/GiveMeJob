from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import subprocess
import tempfile
import unicodedata
from collections import defaultdict
from collections.abc import Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Protocol, cast

import psycopg
import zstandard
from psycopg.rows import dict_row

EXPECTED_CANONICAL_JOBS = 78_719
_ALLOWED_REMOTE_MODES = frozenset({"remote", "hybrid", "onsite"})
_ALLOWED_SENIORITIES = frozenset(
    {
        "intern",
        "junior",
        "middle",
        "senior",
        "lead",
        "staff",
        "principal",
        "manager",
        "director",
        "executive",
    }
)

_JOBS_QUERY = """
SELECT
  job.id,
  job.source_job_id,
  job.title,
  job.title_normalized,
  company.name AS company,
  job.description_md,
  job.seniority,
  job.employment_type,
  job.remote_type,
  job.country,
  job.city,
  job.salary_min,
  job.salary_max,
  job.salary_currency,
  job.salary_period,
  job.salary_usd_year,
  job.posted_at,
  job.source,
  job.source_url,
  job.apply_url,
  job.attribution
FROM jobs AS job
JOIN job_groups AS job_group
  ON job_group.canonical_job = job.id
JOIN companies AS company
  ON company.id = job.company_id
WHERE job.is_active
ORDER BY job.id
"""

_SKILLS_QUERY = """
SELECT DISTINCT
  skill.id,
  skill.name,
  skill.esco_uri,
  skill.aliases
FROM skills AS skill
JOIN job_skills AS job_skill
  ON job_skill.skill_id = skill.id
JOIN jobs AS job
  ON job.id = job_skill.job_id
JOIN job_groups AS job_group
  ON job_group.canonical_job = job.id
WHERE job.is_active
ORDER BY skill.id
"""

_JOB_SKILLS_QUERY = """
SELECT
  job_skill.job_id,
  job_skill.skill_id
FROM job_skills AS job_skill
JOIN jobs AS job
  ON job.id = job_skill.job_id
JOIN job_groups AS job_group
  ON job_group.canonical_job = job.id
JOIN skills AS skill
  ON skill.id = job_skill.skill_id
WHERE job.is_active
ORDER BY job_skill.job_id, lower(skill.name), skill.id
"""

_SOURCE_METADATA_QUERY = """
SELECT
  count(*)::bigint AS canonical_jobs,
  count(*) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM job_skills AS job_skill WHERE job_skill.job_id = job.id
    )
  )::bigint AS jobs_with_skills,
  count(*) FILTER (WHERE job.salary_usd_year IS NOT NULL)::bigint AS jobs_with_salary,
  count(*) FILTER (
    WHERE job.attribution IS NULL OR btrim(job.attribution) = ''
  )::bigint AS missing_attribution,
  count(*) FILTER (
    WHERE job.source_url IS NULL OR btrim(job.source_url) = ''
  )::bigint AS missing_source_url,
  max(job.updated_at) AS source_frozen_at
FROM jobs AS job
JOIN job_groups AS job_group
  ON job_group.canonical_job = job.id
WHERE job.is_active
"""


@dataclass(frozen=True)
class ExportOptions:
    catalog_version: str = "1"
    schema_version: int = 1
    expected_jobs: int = EXPECTED_CANONICAL_JOBS
    fts_probe: str = "developer"
    source_commit_sha: str | None = None


@dataclass(frozen=True)
class SourceMetadata:
    canonical_jobs: int
    jobs_with_skills: int
    jobs_with_salary: int
    source_frozen_at: str


@dataclass(frozen=True)
class CatalogManifest:
    catalog_version: str
    schema_version: int
    source_frozen_at: str
    created_at: str
    canonical_jobs: int
    jobs_with_skills: int
    jobs_with_salary: int
    source_commit_sha: str
    logical_checksum: str
    sqlite_file: str
    sqlite_sha256: str
    archive_file: str
    archive_sha256: str

    def to_dict(self) -> dict[str, str | int]:
        return {
            "catalog_version": self.catalog_version,
            "schema_version": self.schema_version,
            "source_frozen_at": self.source_frozen_at,
            "created_at": self.created_at,
            "canonical_jobs": self.canonical_jobs,
            "jobs_with_skills": self.jobs_with_skills,
            "jobs_with_salary": self.jobs_with_salary,
            "source_commit_sha": self.source_commit_sha,
            "logical_checksum": self.logical_checksum,
            "sqlite_file": self.sqlite_file,
            "sqlite_sha256": self.sqlite_sha256,
            "archive_file": self.archive_file,
            "archive_sha256": self.archive_sha256,
        }


class SnapshotSource(Protocol):
    def metadata(self) -> SourceMetadata: ...

    def skills(self) -> Sequence[Mapping[str, object]]: ...

    def job_skills(self) -> Sequence[tuple[int, int]]: ...

    def jobs(self) -> Iterable[Mapping[str, object]]: ...


class PostgresSnapshotSource:
    """A repeatable-read, server-enforced read-only view of the frozen database."""

    def __init__(self, connection: psycopg.Connection[dict[str, Any]]) -> None:
        self._connection = connection

    def metadata(self) -> SourceMetadata:
        row = self._connection.execute(_SOURCE_METADATA_QUERY).fetchone()
        if row is None:
            raise RuntimeError("PostgreSQL metadata query returned no row")
        if int(row["missing_attribution"]) or int(row["missing_source_url"]):
            raise RuntimeError("frozen source contains jobs without attribution or source URL")
        frozen_at = _iso_datetime(row["source_frozen_at"])
        if frozen_at is None:
            raise RuntimeError("frozen source has no updated_at boundary")
        return SourceMetadata(
            canonical_jobs=int(row["canonical_jobs"]),
            jobs_with_skills=int(row["jobs_with_skills"]),
            jobs_with_salary=int(row["jobs_with_salary"]),
            source_frozen_at=frozen_at,
        )

    def skills(self) -> Sequence[Mapping[str, object]]:
        return cast(
            Sequence[Mapping[str, object]],
            self._connection.execute(_SKILLS_QUERY).fetchall(),
        )

    def job_skills(self) -> Sequence[tuple[int, int]]:
        rows = self._connection.execute(_JOB_SKILLS_QUERY).fetchall()
        return [(int(row["job_id"]), int(row["skill_id"])) for row in rows]

    def jobs(self) -> Iterator[Mapping[str, object]]:
        with self._connection.cursor(name="catalog_jobs") as cursor:
            cursor.execute(_JOBS_QUERY)
            while rows := cursor.fetchmany(1_000):
                yield from cast(Sequence[Mapping[str, object]], rows)


def _iso_datetime(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        normalized = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
        return normalized.isoformat().replace("+00:00", "Z")
    return str(value)


def _optional_text(value: object, *, unknown_is_none: bool = False) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or (unknown_is_none and text.casefold() == "unknown"):
        return None
    return text


def _real(value: object) -> float | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return float(cast(float | int | str, value))


def normalize_search_text(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def _unique_text(values: Iterable[object]) -> tuple[str, ...]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = _optional_text(value)
        if text is None:
            continue
        identity = normalize_search_text(text)
        if identity in seen:
            continue
        seen.add(identity)
        result.append(text)
    return tuple(result)


def _logical_hash_row(
    digest: Any,
    table: str,
    values: Sequence[object],
) -> None:
    payload = json.dumps(
        [table, *values],
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    digest.update(payload)
    digest.update(b"\n")


def _schema_sql() -> str:
    return Path(__file__).with_name("schema.sql").read_text(encoding="utf-8")


def _job_record(
    row: Mapping[str, object],
    *,
    snapshot_version: str,
    skill_names: Sequence[str],
    skill_aliases: Sequence[str],
) -> tuple[object, ...]:
    title = str(row["title"]).strip()
    company = str(row["company"]).strip()
    country = _optional_text(row["country"])
    city = _optional_text(row["city"])
    remote_mode = _optional_text(row["remote_type"], unknown_is_none=True)
    seniority = _optional_text(row["seniority"], unknown_is_none=True)
    if remote_mode not in _ALLOWED_REMOTE_MODES:
        remote_mode = None
    if seniority not in _ALLOWED_SENIORITIES:
        seniority = None
    location_text = ", ".join(value for value in (city, country) if value)
    return (
        int(cast(int | str, row["id"])),
        str(row["source_job_id"]),
        title,
        _optional_text(row["title_normalized"]) or normalize_search_text(title),
        company,
        normalize_search_text(company),
        _optional_text(row["description_md"]) or "",
        seniority,
        _optional_text(row["employment_type"], unknown_is_none=True),
        remote_mode,
        country,
        city,
        location_text,
        _real(row["salary_min"]),
        _real(row["salary_max"]),
        _optional_text(row["salary_currency"]),
        _optional_text(row["salary_period"], unknown_is_none=True),
        _real(row["salary_usd_year"]),
        _iso_datetime(row["posted_at"]),
        str(row["source"]).strip(),
        str(row["source_url"]).strip(),
        _optional_text(row["apply_url"]),
        str(row["attribution"]).strip(),
        " ".join(skill_names),
        " ".join(skill_aliases),
        snapshot_version,
    )


def build_catalog(
    source: SnapshotSource,
    output_path: Path,
    options: ExportOptions,
) -> tuple[SourceMetadata, str]:
    metadata = source.metadata()
    if metadata.canonical_jobs != options.expected_jobs:
        raise RuntimeError(
            "frozen source count mismatch: "
            f"expected {options.expected_jobs}, got {metadata.canonical_jobs}"
        )

    skill_rows = source.skills()
    skills_by_id: dict[int, tuple[str, tuple[str, ...]]] = {}
    normalized_skills: list[tuple[int, str, str | None, str]] = []
    for row in skill_rows:
        skill_id = int(cast(int | str, row["id"]))
        canonical_name = str(row["name"]).strip()
        aliases_raw = cast(Sequence[object], row["aliases"] or ())
        aliases = _unique_text(aliases_raw)
        skills_by_id[skill_id] = (canonical_name, aliases)
        normalized_skills.append(
            (
                skill_id,
                canonical_name,
                _optional_text(row["esco_uri"]),
                json.dumps(aliases, ensure_ascii=False, separators=(",", ":")),
            )
        )

    job_skill_rows = source.job_skills()
    job_skill_ids: defaultdict[int, list[int]] = defaultdict(list)
    for job_id, skill_id in job_skill_rows:
        if skill_id not in skills_by_id:
            raise RuntimeError(f"job {job_id} references missing exported skill {skill_id}")
        job_skill_ids[job_id].append(skill_id)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()
    logical_digest = hashlib.sha256()
    connection = sqlite3.connect(output_path)
    try:
        connection.executescript(
            """
            PRAGMA journal_mode = OFF;
            PRAGMA synchronous = OFF;
            PRAGMA temp_store = MEMORY;
            PRAGMA locking_mode = EXCLUSIVE;
            PRAGMA foreign_keys = ON;
            """
        )
        connection.executescript(_schema_sql())
        connection.executemany(
            """
            INSERT INTO skills (id, canonical_name, esco_uri, aliases_json)
            VALUES (?, ?, ?, ?)
            """,
            normalized_skills,
        )
        for skill in normalized_skills:
            _logical_hash_row(logical_digest, "skills", skill)

        inserted_jobs = 0
        for row in source.jobs():
            job_id = int(cast(int | str, row["id"]))
            skill_ids = job_skill_ids.get(job_id, ())
            skill_names = [skills_by_id[skill_id][0] for skill_id in skill_ids]
            aliases = _unique_text(
                alias for skill_id in skill_ids for alias in skills_by_id[skill_id][1]
            )
            record = _job_record(
                row,
                snapshot_version=options.catalog_version,
                skill_names=skill_names,
                skill_aliases=aliases,
            )
            connection.execute(
                """
                INSERT INTO jobs (
                  id, source_job_id, title, title_normalized, company,
                  company_normalized, description_text, seniority, employment_type,
                  remote_mode, country, city, location_text, salary_min, salary_max,
                  salary_currency, salary_period, salary_usd_year, posted_at, source,
                  source_url, apply_url, attribution, skills_text, search_aliases,
                  snapshot_version
                )
                VALUES (
                  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?
                )
                """,
                record,
            )
            _logical_hash_row(logical_digest, "jobs", record)
            inserted_jobs += 1
        if inserted_jobs != metadata.canonical_jobs:
            raise RuntimeError(
                f"PostgreSQL stream returned {inserted_jobs} jobs, expected "
                f"{metadata.canonical_jobs}"
            )

        connection.executemany(
            "INSERT INTO job_skills (job_id, skill_id) VALUES (?, ?)",
            job_skill_rows,
        )
        for job_skill in job_skill_rows:
            _logical_hash_row(logical_digest, "job_skills", job_skill)

        logical_checksum = logical_digest.hexdigest()
        catalog_meta = {
            "catalog_version": options.catalog_version,
            "schema_version": str(options.schema_version),
            "source_frozen_at": metadata.source_frozen_at,
            "created_at": metadata.source_frozen_at,
            "canonical_jobs": str(metadata.canonical_jobs),
            "jobs_with_skills": str(metadata.jobs_with_skills),
            "jobs_with_salary": str(metadata.jobs_with_salary),
            "source_commit_sha": options.source_commit_sha or _git_commit_sha(),
            "logical_checksum": logical_checksum,
        }
        connection.executemany(
            "INSERT INTO catalog_meta (key, value) VALUES (?, ?)",
            sorted(catalog_meta.items()),
        )
        connection.execute(
            """
            INSERT INTO jobs_fts (
              rowid, title, skills_text, company, location_text,
              description_text, search_aliases
            )
            SELECT
              id, title, skills_text, company, location_text,
              description_text, search_aliases
            FROM jobs
            ORDER BY id
            """
        )
        connection.execute("INSERT INTO jobs_fts(jobs_fts) VALUES ('optimize')")
        connection.commit()
        connection.execute("ANALYZE")
        connection.execute("VACUUM")
    finally:
        connection.close()
    return metadata, logical_checksum


def validate_catalog(
    catalog_path: Path,
    *,
    expected_jobs: int = EXPECTED_CANONICAL_JOBS,
    fts_probe: str = "developer",
) -> dict[str, str | int]:
    uri = f"{catalog_path.resolve().as_uri()}?mode=ro&immutable=1"
    connection = sqlite3.connect(uri, uri=True)
    try:
        integrity = str(connection.execute("PRAGMA integrity_check").fetchone()[0])
        foreign_key_errors = connection.execute("PRAGMA foreign_key_check").fetchall()
        canonical_jobs = int(connection.execute("SELECT count(*) FROM jobs").fetchone()[0])
        missing_attribution = int(
            connection.execute(
                """
                SELECT count(*) FROM jobs
                WHERE trim(attribution) = '' OR trim(source_url) = ''
                """
            ).fetchone()[0]
        )
        fts_match = connection.execute(
            "SELECT rowid FROM jobs_fts WHERE jobs_fts MATCH ? LIMIT 1",
            (fts_probe,),
        ).fetchone()
        metadata = dict(connection.execute("SELECT key, value FROM catalog_meta"))
    finally:
        connection.close()

    if integrity != "ok":
        raise RuntimeError(f"SQLite integrity_check failed: {integrity}")
    if foreign_key_errors:
        raise RuntimeError(f"SQLite foreign_key_check returned {len(foreign_key_errors)} rows")
    if canonical_jobs != expected_jobs:
        raise RuntimeError(f"SQLite count mismatch: expected {expected_jobs}, got {canonical_jobs}")
    if missing_attribution:
        raise RuntimeError(f"SQLite contains {missing_attribution} jobs without attribution")
    if fts_match is None:
        raise RuntimeError(f"FTS5 probe returned no jobs for {fts_probe!r}")
    if int(metadata.get("canonical_jobs", "-1")) != canonical_jobs:
        raise RuntimeError("catalog_meta canonical_jobs does not match the jobs table")

    return {
        "integrity_check": integrity,
        "foreign_key_errors": len(foreign_key_errors),
        "canonical_jobs": canonical_jobs,
        "fts_probe": fts_probe,
        "fts_job_id": int(fts_match[0]),
        "logical_checksum": metadata["logical_checksum"],
    }


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _compress_catalog(source: Path, destination: Path) -> None:
    compressor = zstandard.ZstdCompressor(
        level=19,
        threads=0,
        write_checksum=True,
        write_content_size=True,
    )
    with source.open("rb") as input_file, destination.open("wb") as output_file:
        compressor.copy_stream(input_file, output_file)


def verify_archive(archive_path: Path, catalog_path: Path) -> str:
    expected = _sha256_file(catalog_path)
    actual_digest = hashlib.sha256()
    decompressor = zstandard.ZstdDecompressor()
    with (
        archive_path.open("rb") as compressed,
        decompressor.stream_reader(compressed) as reader,
    ):
        while chunk := reader.read(1024 * 1024):
            actual_digest.update(chunk)
    actual = actual_digest.hexdigest()
    if actual != expected:
        raise RuntimeError("Zstandard archive does not expand to the verified SQLite catalog")
    return _sha256_file(archive_path)


def _git_commit_sha() -> str:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def _write_json_atomic(path: Path, payload: Mapping[str, str | int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(serialized, encoding="utf-8")
    os.replace(temporary, path)


def export_catalog(
    *,
    database_url: str,
    output_dir: Path,
    release_manifest_path: Path,
    options: ExportOptions | None = None,
) -> CatalogManifest:
    if options is None:
        options = ExportOptions()
    dsn = database_url.replace("postgresql+psycopg://", "postgresql://", 1)
    output_dir.mkdir(parents=True, exist_ok=True)
    sqlite_name = f"catalog-v{options.catalog_version}.sqlite"
    archive_name = f"{sqlite_name}.zst"

    with tempfile.TemporaryDirectory(prefix="catalog-export-", dir=output_dir) as temporary:
        temporary_dir = Path(temporary)
        temporary_sqlite = temporary_dir / sqlite_name
        temporary_archive = temporary_dir / archive_name
        with psycopg.connect(
            dsn,
            row_factory=dict_row,
            options="-c default_transaction_read_only=on",
        ) as postgres:
            postgres.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
            source = PostgresSnapshotSource(postgres)
            metadata, logical_checksum = build_catalog(source, temporary_sqlite, options)

        validate_catalog(
            temporary_sqlite,
            expected_jobs=options.expected_jobs,
            fts_probe=options.fts_probe,
        )
        _compress_catalog(temporary_sqlite, temporary_archive)
        archive_sha256 = verify_archive(temporary_archive, temporary_sqlite)
        sqlite_sha256 = _sha256_file(temporary_sqlite)
        source_commit_sha = options.source_commit_sha or _git_commit_sha()
        manifest = CatalogManifest(
            catalog_version=options.catalog_version,
            schema_version=options.schema_version,
            source_frozen_at=metadata.source_frozen_at,
            created_at=metadata.source_frozen_at,
            canonical_jobs=metadata.canonical_jobs,
            jobs_with_skills=metadata.jobs_with_skills,
            jobs_with_salary=metadata.jobs_with_salary,
            source_commit_sha=source_commit_sha,
            logical_checksum=logical_checksum,
            sqlite_file=sqlite_name,
            sqlite_sha256=sqlite_sha256,
            archive_file=archive_name,
            archive_sha256=archive_sha256,
        )
        final_sqlite = output_dir / sqlite_name
        final_archive = output_dir / archive_name
        os.replace(temporary_sqlite, final_sqlite)
        os.replace(temporary_archive, final_archive)

    manifest_payload = manifest.to_dict()
    _write_json_atomic(output_dir / "catalog-manifest.json", manifest_payload)
    _write_json_atomic(release_manifest_path, manifest_payload)
    return manifest
