# GiveMeJob! — разработка

## Активный этап

D0 и M1 завершены. В `config/catalog-manifest.json` зафиксирован проверенный
snapshot из 78 719 вакансий. Текущий этап — M2: offline search и desktop shell.
Backend-фильтры и сортировки relevance/newest/salary готовы; cursor, UI wiring
и match-sort ещё не готовы.
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

В debug-сборке Rust ищет каталог в
`.artifacts/catalog/catalog-v1.sqlite`. Путь можно явно задать переменной
`GIVEMEJOB_CATALOG_PATH`. Release-сборка получает `.zst` как bundle resource,
проверяет оба SHA-256 и атомарно распаковывает catalog в
`%LOCALAPPDATA%\GiveMeJob!\data`.

Rust-проверки:

```powershell
cargo fmt --check --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml `
  --all-targets -- -D warnings
```

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

1. открывает repeatable-read read-only транзакцию;
2. выбирает только active canonical jobs;
3. требует ровно 78 719 записей и полные attribution/URL;
4. строит SQLite STRICT tables и FTS5;
5. выполняет integrity/foreign-key/FTS gates;
6. создаёт `catalog-v1.sqlite.zst` и два SHA-256;
7. атомарно обновляет release manifest.

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
