# M2 catalog lifecycle evidence — 2026-07-31

Статус: локальная инженерная проверка catalog lifecycle. Это evidence не
закрывает M2 целиком, не является clean-Windows install test и не разрешает
публикацию GitHub Release.

## Проверенный runtime contract

Проверка выполнена на рабочем дереве поверх `HEAD`
`ce90d526136f28e807951bcd2144df20d006ae62`.

- `CatalogManifest` принимает только полный manifest v1 без неизвестных полей;
- поддерживаются только `catalog_version = "1"` и `schema_version = 1`;
- resource filenames принимаются только как ожидаемые basename без absolute
  path, директорий, `..`, backslash и drive prefix;
- release binary не компилирует чтение `GIVEMEJOB_CATALOG_PATH`;
- install проверяет archive SHA, потоково распаковывает в уникальный temp,
  синхронизирует файл, проверяет decompressed SHA и полный SQLite contract до
  final rename;
- full contract включает строгий `catalog_meta`, required tables,
  `jobs = jobs_fts_docsize = 78 719`, `foreign_key_check` и
  `integrity_check = ok`;
- после install создаётся seal с hash, size, catalog/schema versions, mtime,
  creation time и readonly metadata;
- fast startup использует seal+metadata и не hash-ит весь SQLite повторно;
- install использует file lock, free-space preflight, stale-temp cleanup,
  `.previous` rollback и не содержит обращений к `user.sqlite`;
- lifecycle и SQLite IPC выполняются через blocking workers; UI получает
  monotonic progress и предоставляет retry/recover.

## Автоматические проверки

```text
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
60 passed, 2 ignored

cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
passed

pnpm -C apps/desktop typecheck
passed

pnpm -C apps/desktop lint
passed

pnpm -C apps/desktop test
30 passed

.venv/Scripts/ruff.exe check . && ruff format --check .
passed; 12 files formatted

.venv/Scripts/mypy.exe .
passed; 10 source files

.venv/Scripts/pytest.exe -q --basetemp <workspace artifact temp>
35 passed
```

Lifecycle fixture tests отдельно покрывают:

- archive SHA mismatch;
- decompressed SHA mismatch;
- unsupported manifest/catalog/schema version;
- job/FTS count mismatch;
- disk-full preflight;
- interrupted install и stale temp;
- final rename + rollback failure;
- seal metadata mismatch и monotonic progress.

Тяжёлый gate был запущен отдельно на настоящем
`.artifacts/catalog/catalog-v1.sqlite`:

```text
cargo test --release --manifest-path apps/desktop/src-tauri/Cargo.toml \
  frozen_catalog_passes_runtime_full_install_validation -- --ignored --nocapture

1 passed; runtime full validation: 7.57 s
```

## Настоящие Windows artifacts

Свежий NSIS собран командой:

```text
pnpm -C apps/desktop tauri build --bundles nsis
```

Проверенные локальные artifacts:

| Artifact | Размер | Catalog entry |
|---|---:|---|
| NSIS `GiveMeJob!_0.1.0_x64-setup.exe` | 347 343 159 bytes | `resources\catalog-v1.sqlite.zst` |
| portable `GiveMeJob-portable-x64.zip` | 344 111 244 bytes | `resources/catalog-v1.sqlite.zst` |

Catalog resource был извлечён из обоих artifacts. SHA-256 обоих извлечённых
файлов совпал с `config/catalog-manifest.json`:

```text
f05e661bbe4bfecfe46e4cc947ddc7c0ae0b0a43c43876ad00e3996b68475671
```

Дополнительный binary scan свежего release executable не нашёл строку
`GIVEMEJOB_CATALOG_PATH`; `cargo check --release` и release clippy с
`-D warnings` прошли.

Windows workflow теперь повторяет structural path check для NSIS и portable
до upload artifact.
