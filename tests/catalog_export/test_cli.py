from collections.abc import Iterable, Mapping, Sequence
from pathlib import Path

import pytest

import tools.catalog_export.cli as cli
from tools.catalog_export.cli import _read_env_value, main
from tools.catalog_export.exporter import (
    ExportOptions,
    SourceMetadata,
    build_catalog,
)


class FixtureSource:
    def metadata(self) -> SourceMetadata:
        return SourceMetadata(
            canonical_jobs=1,
            jobs_with_skills=1,
            jobs_with_salary=0,
            source_frozen_at="2026-07-29T20:30:03Z",
        )

    def skills(self) -> Sequence[Mapping[str, object]]:
        return [{"id": 1, "name": "Python", "esco_uri": None, "aliases": []}]

    def job_skills(self) -> Sequence[tuple[int, int]]:
        return [(1, 1)]

    def jobs(self) -> Iterable[Mapping[str, object]]:
        return [
            {
                "id": 1,
                "source_job_id": "one",
                "title": "Python Developer",
                "title_normalized": "python developer",
                "company": "Fixture",
                "description_md": "",
                "seniority": "middle",
                "employment_type": "full_time",
                "remote_type": "remote",
                "country": None,
                "city": None,
                "salary_min": None,
                "salary_max": None,
                "salary_currency": None,
                "salary_period": None,
                "salary_usd_year": None,
                "posted_at": None,
                "source": "fixture",
                "source_url": "https://example.test/one",
                "apply_url": None,
                "attribution": "Fixture",
            }
        ]


def test_read_env_value_reads_only_the_requested_key(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text("DATABASE_URL='postgresql://local'\nSECRET=hidden\n", encoding="utf-8")

    assert _read_env_value(env_file, "DATABASE_URL") == "postgresql://local"
    assert _read_env_value(env_file, "MISSING") is None


def test_verify_command_reports_a_valid_fixture(tmp_path: Path) -> None:
    catalog = tmp_path / "catalog.sqlite"
    build_catalog(
        FixtureSource(),
        catalog,
        ExportOptions(expected_jobs=1, fts_probe="python", source_commit_sha="a" * 40),
    )

    assert (
        main(
            [
                "verify",
                str(catalog),
                "--expected-jobs",
                "1",
                "--fts-probe",
                "python",
            ]
        )
        == 0
    )


def test_verify_manifest_cli_routes_all_artifact_paths(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    catalog = tmp_path / "catalog-v1.sqlite"
    archive = tmp_path / "catalog-v1.sqlite.zst"
    manifest = tmp_path / "catalog-manifest.json"
    product = tmp_path / "product.json"
    received: dict[str, object] = {}

    def fake_verify_catalog_manifest(**kwargs: object) -> dict[str, str | int]:
        received.update(kwargs)
        return {"canonical_jobs": 1}

    monkeypatch.setattr(cli, "verify_catalog_manifest", fake_verify_catalog_manifest)

    assert (
        main(
            [
                "verify",
                str(catalog),
                "--archive",
                str(archive),
                "--manifest",
                str(manifest),
                "--product",
                str(product),
                "--fts-probe",
                "python",
            ]
        )
        == 0
    )
    assert received["catalog_path"] == catalog
    assert received["archive_path"] == archive
    assert received["manifest_path"] == manifest
    assert received["product_config_path"] == product


def test_verify_manifest_cli_requires_archive(tmp_path: Path) -> None:
    with pytest.raises(SystemExit, match="requires --archive"):
        main(
            [
                "verify",
                str(tmp_path / "catalog-v1.sqlite"),
                "--manifest",
                str(tmp_path / "catalog-manifest.json"),
            ]
        )
