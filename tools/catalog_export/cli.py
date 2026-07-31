from __future__ import annotations

import argparse
import json
import os
from collections.abc import Sequence
from pathlib import Path

from tools.catalog_export.exporter import (
    EXPECTED_CANONICAL_JOBS,
    ExportOptions,
    export_catalog,
    validate_catalog,
    verify_archive,
    verify_catalog_manifest,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m tools.catalog_export",
        description="Build and verify the frozen GiveMeJob SQLite catalog.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    export = subparsers.add_parser("export", help="Export the read-only PostgreSQL snapshot")
    export.add_argument("--env-file", type=Path, default=Path(".env"))
    export.add_argument("--output-dir", type=Path, default=Path(".artifacts/catalog"))
    export.add_argument("--product", type=Path, default=Path("config/product.json"))
    export.add_argument(
        "--manifest",
        type=Path,
        default=Path("config/catalog-manifest.json"),
        help="Tracked release manifest path",
    )
    export.add_argument("--catalog-version", default=os.getenv("CATALOG_VERSION", "1"))
    export.add_argument(
        "--schema-version",
        type=int,
        default=int(os.getenv("CATALOG_SCHEMA_VERSION", "1")),
    )
    export.add_argument("--expected-jobs", type=int, default=EXPECTED_CANONICAL_JOBS)
    export.add_argument("--fts-probe", default="developer")
    export.add_argument("--source-commit-sha")

    verify = subparsers.add_parser("verify", help="Verify an existing catalog artifact")
    verify.add_argument("catalog", type=Path)
    verify.add_argument("--archive", type=Path)
    verify.add_argument("--manifest", type=Path)
    verify.add_argument("--product", type=Path, default=Path("config/product.json"))
    verify.add_argument("--expected-jobs", type=int, default=EXPECTED_CANONICAL_JOBS)
    verify.add_argument("--fts-probe", default="developer")

    return parser


def _read_env_value(path: Path, key: str) -> str | None:
    if not path.exists():
        return None
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() != key:
            continue
        return value.strip().strip("\"'")
    return None


def _database_url(env_file: Path) -> str:
    database_url = os.getenv("DATABASE_URL") or _read_env_value(env_file, "DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required in the environment or the selected env file")
    return database_url


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "export":
        options = ExportOptions(
            catalog_version=args.catalog_version,
            schema_version=args.schema_version,
            expected_jobs=args.expected_jobs,
            fts_probe=args.fts_probe,
            source_commit_sha=args.source_commit_sha,
        )
        manifest = export_catalog(
            database_url=_database_url(args.env_file),
            output_dir=args.output_dir,
            release_manifest_path=args.manifest,
            options=options,
            product_config_path=args.product,
            repository_root=Path.cwd(),
        )
        print(json.dumps(manifest.to_dict(), ensure_ascii=False, indent=2))
        return 0

    if args.manifest:
        if args.archive is None:
            raise SystemExit("verify --manifest requires --archive")
        report = verify_catalog_manifest(
            catalog_path=args.catalog,
            archive_path=args.archive,
            manifest_path=args.manifest,
            product_config_path=args.product,
            repository_root=Path.cwd(),
            fts_probe=args.fts_probe,
        )
    else:
        report = validate_catalog(
            args.catalog,
            expected_jobs=args.expected_jobs,
            fts_probe=args.fts_probe,
        )
        if args.archive:
            report.update(verify_archive(args.archive, args.catalog))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0
