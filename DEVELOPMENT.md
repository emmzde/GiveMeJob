# GiveMeJob! — разработка

## Активный этап

D0 и M1 завершены. В `config/catalog-manifest.json` зафиксирован проверенный
snapshot из 78 719 вакансий. Текущий этап — M2: offline search и desktop shell.
Backend-фильтры, search correctness, сортировки relevance/newest/salary и
cursor/keyset готовы; UI wiring и относящийся к M3 match-sort ещё не готовы.
GitHub Release отложен до M5; актуальный gate описан в
`docs/RELEASE_STATUS.md`.

Legacy API/ingestion удалён. Его нельзя восстанавливать или заменять новым
сборщиком без отдельного ADR и явного решения пользователя.

## Установка

```powershell
pnpm install
uv sync --locked --all-groups
pnpm quality
```

Root-команда `pnpm quality` последовательно вызывает все существующие
frontend gates, затем Rust gates, затем Python gates. Для точечной разработки
те же команды можно запускать по группам ниже.

Node.js нужен только frontend-разработке. Python нужен только
`tools/catalog_export`; установленное приложение не зависит ни от одного из
них.

## Desktop

```powershell
pnpm -C apps/desktop dev
pnpm -C apps/desktop typecheck
pnpm -C apps/desktop lint
pnpm -C apps/desktop test
pnpm -C apps/desktop web:build
```

В debug/test-сборке Rust ищет каталог в
`.artifacts/catalog/catalog-v1.sqlite`. Путь можно явно задать переменной
`GIVEMEJOB_CATALOG_PATH`; release-код эту переменную не читает. Release-сборка
получает `.zst` как `resources/<archive_file>`, а тяжёлый lifecycle выполняет в
blocking worker: проверяет archive SHA-256, свободное место, потоково
распаковывает во временный файл, проверяет decompressed SHA-256, полный SQLite
contract и только затем атомарно устанавливает catalog в
`%LOCALAPPDATA%\GiveMeJob!\data`.

После full validation рядом записывается строгий `.seal.json` с checksum,
размером, версиями и file metadata. Обычный старт сравнивает seal, size/mtime и
metadata без повторного hash всего SQLite; любое расхождение запускает полную
verification/recovery. `user.sqlite` в этом lifecycle не открывается и не
изменяется.

Rust-проверки:

```powershell
cargo fmt --check --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml `
  --all-targets -- -D warnings
```

Воспроизводимый full-corpus benchmark location/salary запускается отдельно,
потому что выполняет 5 warm-ups и 30 samples на каждый scenario:

```powershell
cargo test --release --manifest-path apps/desktop/src-tauri/Cargo.toml `
  frozen_artifact_location_and_salary_benchmark -- --ignored --nocapture
```

Для него обязателен `.artifacts/catalog/catalog-v1.sqlite` либо явный
`GIVEMEJOB_CATALOG_PATH`. Зафиксированный результат и решение не добавлять
новый index находятся в
`docs/evidence/M2_FILTERS_SQL_PERFORMANCE_2026-07-31.md`.

## Catalog exporter

Зависимости экспортёра намеренно ограничены `psycopg[binary]` и `zstandard`.
FastAPI, SQLAlchemy, Redis, Celery, Alembic, pgvector, scraper libraries и
Sentry отсутствуют.

```powershell
uv run ruff check .
uv run ruff format --check .
uv run mypy
uv run pytest -q
```

Для повторного export нужен только сохранённый PostgreSQL volume и
`DATABASE_URL` в локальном `.env`:

```powershell
uv run python -m tools.catalog_export export
```

Экспортёр:

1. до подключения к PostgreSQL требует clean tracked tree и проверяет, что
   `HEAD` содержит `tools/catalog_export/exporter.py`;
2. сверяет версии, count и frozen boundary с `config/product.json`;
3. открывает repeatable-read read-only транзакцию;
4. выбирает только active canonical jobs и преобразует mixed Markdown/HTML
   descriptions в детерминированный `plain_text`;
5. требует ровно 78 719 записей и полные attribution/original URL;
6. строит SQLite STRICT tables и FTS5;
7. выполняет integrity, foreign-key, job/FTS count и metadata gates;
8. создаёт `catalog-v1.sqlite.zst`, отдельные SHA-256 и release checksum asset
   `catalog-v1.sqlite.zst.sha256`;
9. атомарно обновляет локальную и tracked копии manifest.

Manifest проверяется целиком, включая schema, оба размера, SQLite/archive/
decompressed SHA-256, пересчитанный из таблиц logical checksum, counts и source
commit:

```powershell
uv run python -m tools.catalog_export verify `
  .artifacts/catalog/catalog-v1.sqlite `
  --archive .artifacts/catalog/catalog-v1.sqlite.zst `
  --manifest config/catalog-manifest.json `
  --product config/product.json
```

Generated manifest содержит только artifact identity/provenance в `snake_case`.
Release URL/locator появится отдельно в M5 release descriptor.

Artifact находится в `.artifacts/` и не коммитится. PostgreSQL volume нельзя
удалять без отдельного подтверждения пользователя.

## Порядок этапов

1. M2 — полноценные фильтры, сортировки, виртуализация и search benchmark.
2. M3 — профиль, shortlist и детерминированный match-score.
3. M4 — Emmy, Rust `LLMRouter`, пять разрешённых tools и BYOK.
4. M5 — NSIS, portable ZIP, updater и public release.

Следующий этап начинается только после фактического прохождения критерия
текущего.

## Запреты

- не добавлять live ingestion или job-source HTTP calls;
- не возвращать backend runtime, Docker Compose или scheduler;
- не добавлять embeddings/vector search;
- не отправлять полный профиль или каталог LLM-провайдерам;
- не собирать продукт для macOS/Linux/mobile;
- не хранить секреты в Git, frontend, SQLite или логах.
