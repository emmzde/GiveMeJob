from __future__ import annotations

import hashlib
import json
import sqlite3
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

import pytest
import zstandard

from tools.catalog_export.exporter import (
    CatalogManifest,
    ExportOptions,
    SourceMetadata,
    build_catalog,
    normalize_search_text,
    validate_catalog,
    verify_archive,
)


@dataclass
class FixtureSource:
    job_rows: Sequence[Mapping[str, object]]

    def metadata(self) -> SourceMetadata:
        return SourceMetadata(
            canonical_jobs=len(self.job_rows),
            jobs_with_skills=1,
            jobs_with_salary=1,
            source_frozen_at="2026-07-29T20:30:03Z",
        )

    def skills(self) -> Sequence[Mapping[str, object]]:
        return [
            {
                "id": 7,
                "name": "Python",
                "esco_uri": "https://example.test/python",
                "aliases": ["Python", "Py"],
            }
        ]

    def job_skills(self) -> Sequence[tuple[int, int]]:
        return [(1, 7)]

    def jobs(self) -> Iterable[Mapping[str, object]]:
        return self.job_rows


def _source() -> FixtureSource:
    return FixtureSource(
        job_rows=[
            {
                "id": 1,
                "source_job_id": "source-1",
                "title": "Senior Python Developer",
                "title_normalized": "senior python developer",
                "company": "Example Co",
                "description_md": "Build reliable offline software.",
                "seniority": "senior",
                "employment_type": "full_time",
                "remote_type": "remote",
                "country": "AZ",
                "city": "Baku",
                "salary_min": 50_000,
                "salary_max": 70_000,
                "salary_currency": "USD",
                "salary_period": "year",
                "salary_usd_year": 60_000,
                "posted_at": "2026-07-29T00:00:00Z",
                "source": "fixture",
                "source_url": "https://example.test/jobs/1",
                "apply_url": None,
                "attribution": "Fixture",
            }
        ]
    )


def test_build_catalog_creates_searchable_deterministic_snapshot(tmp_path: Path) -> None:
    first = tmp_path / "first.sqlite"
    second = tmp_path / "second.sqlite"
    options = ExportOptions(expected_jobs=1, fts_probe="python", source_commit_sha="abc123")

    first_metadata, first_logical = build_catalog(_source(), first, options)
    second_metadata, second_logical = build_catalog(_source(), second, options)

    assert first_metadata == second_metadata
    assert first_logical == second_logical
    assert validate_catalog(first, expected_jobs=1, fts_probe="python") == {
        "integrity_check": "ok",
        "foreign_key_errors": 0,
        "canonical_jobs": 1,
        "fts_probe": "python",
        "fts_job_id": 1,
        "logical_checksum": first_logical,
    }
    with sqlite3.connect(first) as connection:
        assert connection.execute(
            "SELECT skills_text, search_aliases FROM jobs WHERE id = 1"
        ).fetchone() == ("Python", "Python Py")


def test_build_catalog_rejects_an_unexpected_source_count(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match="expected 2, got 1"):
        build_catalog(
            _source(),
            tmp_path / "catalog.sqlite",
            ExportOptions(expected_jobs=2, source_commit_sha="abc123"),
        )


def test_normalize_search_text_is_unicode_and_whitespace_stable() -> None:
    assert normalize_search_text("  PYTHON\u00a0Developer  ") == "python developer"


def test_verify_archive_checks_decompressed_sqlite(tmp_path: Path) -> None:
    catalog = tmp_path / "catalog.sqlite"
    archive = tmp_path / "catalog.sqlite.zst"
    catalog.write_bytes(b"verified catalog")
    archive.write_bytes(
        zstandard.ZstdCompressor(write_checksum=True).compress(catalog.read_bytes())
    )

    assert verify_archive(archive, catalog) == hashlib.sha256(archive.read_bytes()).hexdigest()

    catalog.write_bytes(b"different")
    with pytest.raises(RuntimeError, match="does not expand"):
        verify_archive(archive, catalog)


def test_manifest_serializes_all_release_checksums() -> None:
    manifest = CatalogManifest(
        catalog_version="1",
        schema_version=1,
        source_frozen_at="2026-07-29T20:30:03Z",
        exported_at="2026-07-31T10:00:00Z",
        published_at=None,
        canonical_jobs=1,
        jobs_with_skills=1,
        jobs_with_salary=1,
        source_commit_sha="abc123",
        logical_checksum="logical",
        sqlite_file="catalog-v1.sqlite",
        sqlite_sha256="sqlite",
        archive_file="catalog-v1.sqlite.zst",
        archive_sha256="archive",
    )

    payload = manifest.to_dict()
    assert payload["archive_sha256"] == "archive"
    assert payload["source_frozen_at"] == "2026-07-29T20:30:03Z"
    assert payload["exported_at"] == "2026-07-31T10:00:00Z"
    assert payload["published_at"] is None
    assert "created_at" not in payload


def test_release_manifest_describes_the_verified_frozen_snapshot() -> None:
    manifest_path = Path(__file__).parents[2] / "config" / "catalog-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    assert manifest["catalog_version"] == "1"
    assert manifest["schema_version"] == 1
    assert manifest["canonical_jobs"] == 78_719
    assert manifest["jobs_with_skills"] == 68_881
    assert manifest["jobs_with_salary"] == 22_467
    assert manifest["source_frozen_at"] == "2026-07-29T20:30:03.846872Z"
    assert manifest["exported_at"] == "2026-07-29T20:30:03.846872Z"
    assert manifest["published_at"] is None
    assert "created_at" not in manifest
    assert len(manifest["sqlite_sha256"]) == 64
    assert len(manifest["archive_sha256"]) == 64
