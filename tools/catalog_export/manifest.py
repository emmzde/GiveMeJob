from __future__ import annotations

import json
import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import cast

MANIFEST_VERSION = 1
DESCRIPTION_FORMAT = "plain_text"
_VERSION_RE = re.compile(r"[1-9][0-9]*\Z")
_SHA256_RE = re.compile(r"[0-9a-f]{64}\Z")
_COMMIT_SHA_RE = re.compile(r"[0-9a-f]{40}\Z")
_MANIFEST_KEYS = frozenset(
    {
        "manifest_version",
        "catalog_version",
        "schema_version",
        "description_format",
        "source_frozen_at",
        "exported_at",
        "published_at",
        "canonical_jobs",
        "jobs_with_skills",
        "jobs_with_salary",
        "source_commit_sha",
        "logical_checksum",
        "sqlite_file",
        "sqlite_size_bytes",
        "sqlite_sha256",
        "archive_file",
        "archive_size_bytes",
        "archive_sha256",
    }
)


@dataclass(frozen=True)
class ProductCatalogContract:
    manifest_version: int
    catalog_version: str
    schema_version: int
    canonical_jobs: int
    description_format: str
    source_frozen_at: str
    manifest_path: str


@dataclass(frozen=True)
class CatalogManifest:
    manifest_version: int
    catalog_version: str
    schema_version: int
    description_format: str
    source_frozen_at: str
    exported_at: str
    published_at: str | None
    canonical_jobs: int
    jobs_with_skills: int
    jobs_with_salary: int
    source_commit_sha: str
    logical_checksum: str
    sqlite_file: str
    sqlite_size_bytes: int
    sqlite_sha256: str
    archive_file: str
    archive_size_bytes: int
    archive_sha256: str

    def to_dict(self) -> dict[str, str | int | None]:
        return {
            "manifest_version": self.manifest_version,
            "catalog_version": self.catalog_version,
            "schema_version": self.schema_version,
            "description_format": self.description_format,
            "source_frozen_at": self.source_frozen_at,
            "exported_at": self.exported_at,
            "published_at": self.published_at,
            "canonical_jobs": self.canonical_jobs,
            "jobs_with_skills": self.jobs_with_skills,
            "jobs_with_salary": self.jobs_with_salary,
            "source_commit_sha": self.source_commit_sha,
            "logical_checksum": self.logical_checksum,
            "sqlite_file": self.sqlite_file,
            "sqlite_size_bytes": self.sqlite_size_bytes,
            "sqlite_sha256": self.sqlite_sha256,
            "archive_file": self.archive_file,
            "archive_size_bytes": self.archive_size_bytes,
            "archive_sha256": self.archive_sha256,
        }

    @classmethod
    def from_dict(cls, payload: Mapping[str, object]) -> CatalogManifest:
        keys = frozenset(payload)
        if keys != _MANIFEST_KEYS:
            missing = sorted(_MANIFEST_KEYS - keys)
            unexpected = sorted(keys - _MANIFEST_KEYS)
            raise ValueError(
                f"manifest schema mismatch: missing={missing}, unexpected={unexpected}"
            )

        manifest = cls(
            manifest_version=_integer(payload, "manifest_version"),
            catalog_version=_string(payload, "catalog_version"),
            schema_version=_integer(payload, "schema_version"),
            description_format=_string(payload, "description_format"),
            source_frozen_at=_string(payload, "source_frozen_at"),
            exported_at=_string(payload, "exported_at"),
            published_at=_optional_string(payload, "published_at"),
            canonical_jobs=_integer(payload, "canonical_jobs"),
            jobs_with_skills=_integer(payload, "jobs_with_skills"),
            jobs_with_salary=_integer(payload, "jobs_with_salary"),
            source_commit_sha=_string(payload, "source_commit_sha"),
            logical_checksum=_string(payload, "logical_checksum"),
            sqlite_file=_string(payload, "sqlite_file"),
            sqlite_size_bytes=_integer(payload, "sqlite_size_bytes"),
            sqlite_sha256=_string(payload, "sqlite_sha256"),
            archive_file=_string(payload, "archive_file"),
            archive_size_bytes=_integer(payload, "archive_size_bytes"),
            archive_sha256=_string(payload, "archive_sha256"),
        )
        validate_manifest(manifest)
        return manifest


def _string(payload: Mapping[str, object], key: str) -> str:
    value = payload[key]
    if not isinstance(value, str):
        raise ValueError(f"manifest {key} must be a string")
    return value


def _optional_string(payload: Mapping[str, object], key: str) -> str | None:
    value = payload[key]
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError(f"manifest {key} must be a string or null")
    return value


def _integer(payload: Mapping[str, object], key: str) -> int:
    value = payload[key]
    if type(value) is not int:
        raise ValueError(f"manifest {key} must be an integer")
    return value


def _positive_integer(value: int, name: str) -> None:
    if value <= 0:
        raise ValueError(f"{name} must be a positive integer")


def _timestamp(value: str, name: str) -> None:
    if not value.endswith("Z"):
        raise ValueError(f"{name} must be an ISO-8601 UTC timestamp ending in Z")
    try:
        datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError as error:
        raise ValueError(f"{name} must be a valid ISO-8601 UTC timestamp") from error


def validate_artifact_filename(value: str, name: str) -> None:
    if not value or value in {".", ".."}:
        raise ValueError(f"{name} must be a non-empty artifact filename")
    posix = PurePosixPath(value)
    windows = PureWindowsPath(value)
    if (
        posix.is_absolute()
        or windows.is_absolute()
        or posix.name != value
        or windows.name != value
        or ".." in posix.parts
        or ".." in windows.parts
    ):
        raise ValueError(f"{name} must not be absolute or contain path components")


def validate_manifest(manifest: CatalogManifest) -> None:
    if manifest.manifest_version != MANIFEST_VERSION:
        raise ValueError(f"unsupported manifest_version: {manifest.manifest_version}")
    if _VERSION_RE.fullmatch(manifest.catalog_version) is None:
        raise ValueError("catalog_version must be a positive decimal string without leading zeros")
    _positive_integer(manifest.schema_version, "schema_version")
    if manifest.description_format != DESCRIPTION_FORMAT:
        raise ValueError(f"description_format must be {DESCRIPTION_FORMAT!r}")
    _timestamp(manifest.source_frozen_at, "source_frozen_at")
    _timestamp(manifest.exported_at, "exported_at")
    if manifest.published_at is not None:
        _timestamp(manifest.published_at, "published_at")
    _positive_integer(manifest.canonical_jobs, "canonical_jobs")
    if not 0 <= manifest.jobs_with_skills <= manifest.canonical_jobs:
        raise ValueError("jobs_with_skills must be between zero and canonical_jobs")
    if not 0 <= manifest.jobs_with_salary <= manifest.canonical_jobs:
        raise ValueError("jobs_with_salary must be between zero and canonical_jobs")
    if _COMMIT_SHA_RE.fullmatch(manifest.source_commit_sha) is None:
        raise ValueError("source_commit_sha must be a lowercase full Git SHA-1")
    for name, value in (
        ("logical_checksum", manifest.logical_checksum),
        ("sqlite_sha256", manifest.sqlite_sha256),
        ("archive_sha256", manifest.archive_sha256),
    ):
        if _SHA256_RE.fullmatch(value) is None:
            raise ValueError(f"{name} must be a lowercase SHA-256")
    validate_artifact_filename(manifest.sqlite_file, "sqlite_file")
    validate_artifact_filename(manifest.archive_file, "archive_file")
    expected_sqlite = f"catalog-v{manifest.catalog_version}.sqlite"
    if manifest.sqlite_file != expected_sqlite:
        raise ValueError(f"sqlite_file must be {expected_sqlite!r}")
    if manifest.archive_file != f"{expected_sqlite}.zst":
        raise ValueError(f"archive_file must be {expected_sqlite}.zst")
    _positive_integer(manifest.sqlite_size_bytes, "sqlite_size_bytes")
    _positive_integer(manifest.archive_size_bytes, "archive_size_bytes")


def read_manifest(path: Path) -> CatalogManifest:
    payload: object = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not all(isinstance(key, str) for key in payload):
        raise ValueError("catalog manifest must be a JSON object with string keys")
    return CatalogManifest.from_dict(cast(dict[str, object], payload))


def load_product_contract(path: Path) -> ProductCatalogContract:
    payload: object = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("product config must be a JSON object")
    dataset = payload.get("dataset")
    if not isinstance(dataset, dict):
        raise ValueError("product config dataset must be a JSON object")
    typed = cast(dict[str, object], dataset)
    contract = ProductCatalogContract(
        manifest_version=_product_integer(typed, "manifestVersion"),
        catalog_version=_product_string(typed, "catalogVersion"),
        schema_version=_product_integer(typed, "schemaVersion"),
        canonical_jobs=_product_integer(typed, "canonicalJobs"),
        description_format=_product_string(typed, "descriptionFormat"),
        source_frozen_at=_product_string(typed, "sourceFrozenAt"),
        manifest_path=_product_string(typed, "manifest"),
    )
    if contract.manifest_version != MANIFEST_VERSION:
        raise ValueError("product manifestVersion does not match the supported manifest schema")
    if _VERSION_RE.fullmatch(contract.catalog_version) is None:
        raise ValueError("product catalogVersion is invalid")
    _positive_integer(contract.schema_version, "product schemaVersion")
    _positive_integer(contract.canonical_jobs, "product canonicalJobs")
    if contract.description_format != DESCRIPTION_FORMAT:
        raise ValueError("product descriptionFormat does not match exporter normalization")
    _timestamp(contract.source_frozen_at, "product sourceFrozenAt")
    manifest_posix = PurePosixPath(contract.manifest_path)
    manifest_windows = PureWindowsPath(contract.manifest_path)
    if (
        not contract.manifest_path
        or "\\" in contract.manifest_path
        or manifest_posix.is_absolute()
        or manifest_windows.is_absolute()
        or ".." in manifest_posix.parts
        or ".." in manifest_windows.parts
    ):
        raise ValueError("product dataset manifest must be a repository-relative path")
    return contract


def _product_string(payload: Mapping[str, object], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str):
        raise ValueError(f"product dataset {key} must be a string")
    return value


def _product_integer(payload: Mapping[str, object], key: str) -> int:
    value = payload.get(key)
    if type(value) is not int:
        raise ValueError(f"product dataset {key} must be an integer")
    return value


def validate_manifest_against_product(
    manifest: CatalogManifest,
    product: ProductCatalogContract,
) -> None:
    comparisons: tuple[tuple[str, object, object], ...] = (
        ("manifest_version", manifest.manifest_version, product.manifest_version),
        ("catalog_version", manifest.catalog_version, product.catalog_version),
        ("schema_version", manifest.schema_version, product.schema_version),
        ("canonical_jobs", manifest.canonical_jobs, product.canonical_jobs),
        ("description_format", manifest.description_format, product.description_format),
        ("source_frozen_at", manifest.source_frozen_at, product.source_frozen_at),
    )
    for name, manifest_value, product_value in comparisons:
        if manifest_value != product_value:
            raise ValueError(
                f"manifest {name} does not match config/product.json: "
                f"{manifest_value!r} != {product_value!r}"
            )
