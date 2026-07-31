# M2 catalog baseline — b30162a

Статус: зафиксирован 31 июля 2026 года. Это evidence конкретного corrective
catalog gate; оно не расширяет scope и не разрешает ingestion.

## Provenance

- exporter commit: `b30162a21d1e473b61d037d10165d283798aa586`;
- commit существует и содержит `tools/catalog_export/exporter.py`;
- hardening был закоммичен до реального export;
- tracked tree перед export был clean;
- исходный `givemejob_postgres-data` монтировался только read-only;
- PostgreSQL 17.10 запускался на удалённой после проверки временной копии;
- connection: `default_transaction_read_only=on`, transaction:
  `REPEATABLE READ, READ ONLY`;
- ingestion и source HTTP calls не запускались.

## Pinned fixture toolchain

- `.python-version`: 3.13; фактический Python: 3.13.14;
- SQLite: 3.53.1;
- `uv.lock`: zstandard 0.25.0, psycopg 3.3.4, pytest 8.4.2;
- local verification platform: Windows 11 x64;
- два fixture SQLite build byte-identical;
- два fixture Zstandard archive byte-identical;
- Python suite: 35 passed;
- frontend: 6 Vitest passed, typecheck/lint/build passed;
- Rust: 11 tests passed, fmt/check/clippy passed.

## Final manifest

```text
manifest_version    = 1
catalog_version     = 1
schema_version      = 1
description_format  = plain_text
source_frozen_at    = 2026-07-29T20:30:03.846872Z
exported_at         = 2026-07-31T11:09:37.316686Z
published_at        = null
canonical_jobs      = 78719
jobs_with_skills    = 68881
jobs_with_salary    = 22467
source_commit_sha   = b30162a21d1e473b61d037d10165d283798aa586
logical_checksum    = 895d38f383597e7ba8e2de60c7cab5c99a8ae32de6df7f51035a225a4ed5bb6b
sqlite_file         = catalog-v1.sqlite
sqlite_size_bytes   = 1043488768
sqlite_sha256       = e03b6b3e76be625c432268043cc241eb133e41566c3057dfdb610dbab92ab71e
archive_file        = catalog-v1.sqlite.zst
archive_size_bytes  = 340085972
archive_sha256      = f05e661bbe4bfecfe46e4cc947ddc7c0ae0b0a43c43876ad00e3996b68475671
checksum_file       = catalog-v1.sqlite.zst.sha256
```

## `verify --manifest`

Проверка завершилась с кодом 0:

```text
integrity_check       = ok
foreign_key_errors    = 0
canonical_jobs        = 78719
fts_jobs              = 78719
jobs_with_skills      = 68881
jobs_with_salary      = 22467
missing_attribution   = 0
invalid_source_url    = 0
decompressed_size     = 1043488768
decompressed_sha256   = e03b6b3e76be625c432268043cc241eb133e41566c3057dfdb610dbab92ab71e
```

Manifest schema, sizes, SQLite/archive/decompressed hashes, обязательные
metadata keys, product contract, checksum asset и source commit также прошли.

## Logical checksum migration

Старый logical checksum:
`1ef6792c62ef099b21974805fbade6c6eec1eeeb2db249a97a355ef1ffc8776b`.

Normalization изменила representation 78 317 descriptions; все 78 719 новых
`description_text` совпали с детерминированным normalizer. Контрфактический
пересчёт нового SQLite с единственной заменой normalized description на
исходный trimmed `description_md` дал старый checksum точно. Следовательно,
изменение current logical checksum объясняется только переходом на
`description_format = plain_text`; иных row-level расхождений нет.
