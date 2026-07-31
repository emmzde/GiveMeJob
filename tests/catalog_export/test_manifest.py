from __future__ import annotations

import json
from pathlib import Path

import pytest

from tools.catalog_export.manifest import (
    CatalogManifest,
    ProductCatalogContract,
    load_product_contract,
    read_manifest,
    validate_artifact_filename,
    validate_manifest,
    validate_manifest_against_product,
)


def _manifest(**overrides: object) -> CatalogManifest:
    values: dict[str, object] = {
        "manifest_version": 1,
        "catalog_version": "1",
        "schema_version": 1,
        "description_format": "plain_text",
        "source_frozen_at": "2026-07-29T20:30:03Z",
        "exported_at": "2026-07-31T10:00:00Z",
        "published_at": None,
        "canonical_jobs": 78_719,
        "jobs_with_skills": 68_881,
        "jobs_with_salary": 22_467,
        "source_commit_sha": "a" * 40,
        "logical_checksum": "b" * 64,
        "sqlite_file": "catalog-v1.sqlite",
        "sqlite_size_bytes": 100,
        "sqlite_sha256": "c" * 64,
        "archive_file": "catalog-v1.sqlite.zst",
        "archive_size_bytes": 50,
        "archive_sha256": "d" * 64,
    }
    values.update(overrides)
    return CatalogManifest(**values)  # type: ignore[arg-type]


def test_manifest_schema_is_strict_snake_case_without_release_locator() -> None:
    payload = _manifest().to_dict()

    assert CatalogManifest.from_dict(payload) == _manifest()
    assert all(key == key.casefold() and "-" not in key for key in payload)
    for unexpected in ("release_url", "sqliteSizeBytes"):
        invalid = {**payload, unexpected: "https://example.test/catalog"}
        with pytest.raises(ValueError, match="unexpected"):
            CatalogManifest.from_dict(invalid)


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"catalog_version": "01"}, "catalog_version"),
        ({"schema_version": 0}, "schema_version"),
        ({"sqlite_size_bytes": 0}, "sqlite_size_bytes"),
        ({"archive_size_bytes": -1}, "archive_size_bytes"),
        ({"sqlite_sha256": "A" * 64}, "lowercase SHA-256"),
        ({"archive_sha256": "not-a-sha"}, "lowercase SHA-256"),
        ({"source_commit_sha": "ABC" * 13 + "A"}, "source_commit_sha"),
    ],
)
def test_manifest_rejects_invalid_versions_sizes_and_hashes(
    overrides: dict[str, object],
    message: str,
) -> None:
    with pytest.raises(ValueError, match=message):
        validate_manifest(_manifest(**overrides))


@pytest.mark.parametrize(
    "filename",
    [
        "../catalog-v1.sqlite",
        "dir/catalog-v1.sqlite",
        r"dir\catalog-v1.sqlite",
        "/tmp/catalog-v1.sqlite",
        r"C:\catalog-v1.sqlite",
    ],
)
def test_artifact_filenames_reject_absolute_paths_and_parent_traversal(filename: str) -> None:
    with pytest.raises(ValueError, match=r"must not be absolute|path components"):
        validate_artifact_filename(filename, "artifact")


def test_read_manifest_rejects_missing_keys(tmp_path: Path) -> None:
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps({"manifest_version": 1}), encoding="utf-8")

    with pytest.raises(ValueError, match="missing"):
        read_manifest(manifest_path)


def test_product_contract_loads_and_matches_manifest(tmp_path: Path) -> None:
    product_path = tmp_path / "product.json"
    product_path.write_text(
        json.dumps(
            {
                "dataset": {
                    "manifestVersion": 1,
                    "catalogVersion": "1",
                    "schemaVersion": 1,
                    "canonicalJobs": 78_719,
                    "descriptionFormat": "plain_text",
                    "sourceFrozenAt": "2026-07-29T20:30:03Z",
                    "manifest": "config/catalog-manifest.json",
                }
            }
        ),
        encoding="utf-8",
    )

    product = load_product_contract(product_path)
    validate_manifest_against_product(_manifest(), product)
    assert product == ProductCatalogContract(
        manifest_version=1,
        catalog_version="1",
        schema_version=1,
        canonical_jobs=78_719,
        description_format="plain_text",
        source_frozen_at="2026-07-29T20:30:03Z",
        manifest_path="config/catalog-manifest.json",
    )


def test_manifest_product_mismatch_is_rejected() -> None:
    product = ProductCatalogContract(
        manifest_version=1,
        catalog_version="2",
        schema_version=1,
        canonical_jobs=78_719,
        description_format="plain_text",
        source_frozen_at="2026-07-29T20:30:03Z",
        manifest_path="config/catalog-manifest.json",
    )

    with pytest.raises(ValueError, match="catalog_version"):
        validate_manifest_against_product(_manifest(), product)
