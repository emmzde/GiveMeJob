from __future__ import annotations

import hashlib
import json
import sqlite3
import subprocess
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

import pytest

from tools.catalog_export.exporter import (
    ExportOptions,
    SourceMetadata,
    build_catalog,
    calculate_logical_checksum,
    compress_catalog,
    sha256_file,
    validate_catalog,
    validate_export_repository,
    verify_archive,
    verify_catalog_manifest,
)
from tools.catalog_export.manifest import CatalogManifest
from tools.catalog_export.text import description_to_plain_text

_COMMIT_SHA = "a" * 40
_EXPORTED_AT = "2026-07-31T10:00:00Z"


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


def _source(description: str = "Build reliable offline software.") -> FixtureSource:
    return FixtureSource(
        job_rows=[
            {
                "id": 1,
                "source_job_id": "source-1",
                "title": "Senior Python Developer",
                "title_normalized": "senior python developer",
                "company": "Example Co",
                "description_md": description,
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


def _options(source_commit_sha: str = _COMMIT_SHA) -> ExportOptions:
    return ExportOptions(
        expected_jobs=1,
        fts_probe="python",
        source_commit_sha=source_commit_sha,
        exported_at=_EXPORTED_AT,
    )


def _git(repository: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(repository), *args],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def _fixture_repository(tmp_path: Path) -> tuple[Path, str]:
    repository = tmp_path / "repository"
    exporter = repository / "tools" / "catalog_export" / "exporter.py"
    exporter.parent.mkdir(parents=True)
    exporter.write_text("# fixture exporter\n", encoding="utf-8")
    _git(repository, "init")
    _git(repository, "config", "user.email", "fixture@example.test")
    _git(repository, "config", "user.name", "Fixture")
    _git(repository, "add", "tools/catalog_export/exporter.py")
    _git(repository, "commit", "-m", "test: add fixture exporter")
    return repository, _git(repository, "rev-parse", "HEAD")


def test_build_catalog_is_byte_stable_in_the_pinned_fixture_toolchain(tmp_path: Path) -> None:
    first = tmp_path / "first.sqlite"
    second = tmp_path / "second.sqlite"

    first_metadata, first_logical = build_catalog(_source(), first, _options())
    second_metadata, second_logical = build_catalog(_source(), second, _options())

    assert first_metadata == second_metadata
    assert first_logical == second_logical
    assert first.read_bytes() == second.read_bytes()
    report = validate_catalog(first, expected_jobs=1, fts_probe="python")
    assert report["integrity_check"] == "ok"
    assert report["foreign_key_errors"] == 0
    assert report["canonical_jobs"] == 1
    assert report["fts_jobs"] == 1
    assert report["jobs_with_skills"] == 1
    assert report["jobs_with_salary"] == 1
    assert report["logical_checksum"] == first_logical
    with sqlite3.connect(first) as connection:
        assert connection.execute(
            "SELECT skills_text, search_aliases FROM jobs WHERE id = 1"
        ).fetchone() == ("Python", "Python Py")


def test_zstandard_archives_are_byte_stable(tmp_path: Path) -> None:
    catalog = tmp_path / "catalog.sqlite"
    first = tmp_path / "first.zst"
    second = tmp_path / "second.zst"
    build_catalog(_source(), catalog, _options())

    compress_catalog(catalog, first)
    compress_catalog(catalog, second)

    assert first.read_bytes() == second.read_bytes()
    report = verify_archive(first, catalog)
    assert report["archive_sha256"] == sha256_file(first)
    assert report["decompressed_sha256"] == sha256_file(catalog)
    assert report["decompressed_size_bytes"] == catalog.stat().st_size


def test_build_catalog_rejects_an_unexpected_source_count(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match="expected 2, got 1"):
        build_catalog(
            _source(),
            tmp_path / "catalog.sqlite",
            ExportOptions(expected_jobs=2, source_commit_sha=_COMMIT_SHA),
        )


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("# Heading\n\nBody", "Heading\n\nBody"),
        ("- First\n- Second", "First\nSecond"),
        ("Read [the docs](https://example.test).", "Read the docs."),
        ("Fish &amp; Chips&nbsp;today", "Fish & Chips today"),
        ("<p>Visible</p><script>alert(1)</script><style>p{}</style>", "Visible"),
        ("Привет, мир 👋 — café", "Привет, мир 👋 — café"),
    ],
)
def test_description_to_plain_text_fixtures(source: str, expected: str) -> None:
    assert description_to_plain_text(source) == expected


def test_build_catalog_stores_normalized_plain_text_description(tmp_path: Path) -> None:
    catalog = tmp_path / "catalog.sqlite"
    build_catalog(
        _source("## Role\n\n<ul><li>Build [tools](https://example.test)</li></ul>"),
        catalog,
        _options(),
    )

    with sqlite3.connect(catalog) as connection:
        description = connection.execute("SELECT description_text FROM jobs").fetchone()[0]
    assert description == "Role\n\nBuild tools"


def test_logical_checksum_is_recalculated_instead_of_trusting_catalog_meta(
    tmp_path: Path,
) -> None:
    catalog = tmp_path / "catalog.sqlite"
    _, expected = build_catalog(_source(), catalog, _options())
    with sqlite3.connect(catalog) as connection:
        connection.execute(
            "UPDATE catalog_meta SET value = ? WHERE key = 'logical_checksum'",
            ("0" * 64,),
        )
        connection.commit()

    assert calculate_logical_checksum(catalog) == expected
    with pytest.raises(RuntimeError, match="catalog_meta logical_checksum mismatch"):
        validate_catalog(catalog, expected_jobs=1, fts_probe="python")


def test_verify_archive_rejects_different_decompressed_sqlite(tmp_path: Path) -> None:
    catalog = tmp_path / "catalog.sqlite"
    archive = tmp_path / "catalog.sqlite.zst"
    catalog.write_bytes(b"verified catalog")
    compress_catalog(catalog, archive)

    catalog.write_bytes(b"different")
    with pytest.raises(RuntimeError, match="does not expand"):
        verify_archive(archive, catalog)


def test_validate_export_repository_requires_clean_tracked_head_with_exporter(
    tmp_path: Path,
) -> None:
    repository, source_commit_sha = _fixture_repository(tmp_path)

    assert validate_export_repository(repository) == source_commit_sha

    exporter = repository / "tools" / "catalog_export" / "exporter.py"
    exporter.write_text("# dirty fixture exporter\n", encoding="utf-8")
    with pytest.raises(RuntimeError, match="clean tracked Git tree"):
        validate_export_repository(repository)


def test_verify_catalog_manifest_checks_every_artifact_layer(tmp_path: Path) -> None:
    repository, source_commit_sha = _fixture_repository(tmp_path)
    artifacts = repository / ".artifacts" / "catalog"
    artifacts.mkdir(parents=True)
    catalog = artifacts / "catalog-v1.sqlite"
    archive = artifacts / "catalog-v1.sqlite.zst"
    checksum = artifacts / "catalog-v1.sqlite.zst.sha256"
    _, logical_checksum = build_catalog(_source(), catalog, _options(source_commit_sha))
    compress_catalog(catalog, archive)
    sqlite_sha256 = sha256_file(catalog)
    archive_sha256 = sha256_file(archive)
    checksum.write_text(f"{archive_sha256}  {archive.name}\n", encoding="ascii")

    config = repository / "config"
    config.mkdir()
    product = config / "product.json"
    product.write_text(
        json.dumps(
            {
                "dataset": {
                    "manifestVersion": 1,
                    "catalogVersion": "1",
                    "schemaVersion": 1,
                    "canonicalJobs": 1,
                    "descriptionFormat": "plain_text",
                    "sourceFrozenAt": "2026-07-29T20:30:03Z",
                    "manifest": "config/catalog-manifest.json",
                }
            }
        ),
        encoding="utf-8",
    )
    manifest = CatalogManifest(
        manifest_version=1,
        catalog_version="1",
        schema_version=1,
        description_format="plain_text",
        source_frozen_at="2026-07-29T20:30:03Z",
        exported_at=_EXPORTED_AT,
        published_at=None,
        canonical_jobs=1,
        jobs_with_skills=1,
        jobs_with_salary=1,
        source_commit_sha=source_commit_sha,
        logical_checksum=logical_checksum,
        sqlite_file=catalog.name,
        sqlite_size_bytes=catalog.stat().st_size,
        sqlite_sha256=sqlite_sha256,
        archive_file=archive.name,
        archive_size_bytes=archive.stat().st_size,
        archive_sha256=archive_sha256,
    )
    manifest_path = config / "catalog-manifest.json"
    manifest_path.write_text(json.dumps(manifest.to_dict()), encoding="utf-8")

    report = verify_catalog_manifest(
        catalog_path=catalog,
        archive_path=archive,
        manifest_path=manifest_path,
        product_config_path=product,
        repository_root=repository,
        fts_probe="python",
    )

    assert report["canonical_jobs"] == 1
    assert report["fts_jobs"] == 1
    assert report["archive_sha256"] == archive_sha256
    assert report["decompressed_sha256"] == sqlite_sha256
    assert report["logical_checksum"] == logical_checksum
    assert report["checksum_file"] == checksum.name


def test_sha256_file_returns_lowercase_digest(tmp_path: Path) -> None:
    artifact = tmp_path / "artifact.bin"
    artifact.write_bytes(b"catalog")

    assert sha256_file(artifact) == hashlib.sha256(b"catalog").hexdigest()
