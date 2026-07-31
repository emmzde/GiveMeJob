# GiveMeJob!

[![Quality](https://github.com/emmzde/GiveMeJob/actions/workflows/quality.yml/badge.svg)](https://github.com/emmzde/GiveMeJob/actions/workflows/quality.yml)

GiveMeJob! — open-source portfolio pet-project: локальное Windows-приложение
для поиска по зафиксированному каталогу вакансий. Репозиторий пока private и
станет публичным после release gate и проверки на секреты.

## Текущий статус

- D0 (документационный pivot) — завершён;
- M1 (verified snapshot) — завершён;
- M2 (offline search и desktop shell) — в работе;
- опубликованных GitHub Releases пока нет.

Локальные NSIS и portable artifacts успешно собираются, но это инженерная
проверка, а не готовая пользовательская версия. Решение и критерии первого
релиза: [`docs/RELEASE_STATUS.md`](docs/RELEASE_STATUS.md).

## Что уже работает

- воспроизводимый PostgreSQL → SQLite FTS5 export;
- проверенный snapshot из 78 719 активных канонических вакансий;
- `PRAGMA integrity_check`, foreign key audit, attribution/URL gate;
- versioned manifest, SHA-256 и Zstandard archive;
- локальный Rust IPC для статуса каталога и FTS5-поиска;
- backend-фильтры и сортировки relevance/newest/salary;
- React shell с лентой, карточкой, фильтрами-заготовками и offline state;
- Windows-only Tauri configuration с NSIS и portable ZIP workflow.

Пользовательский runtime не требует Docker, Python, PostgreSQL или сервера.
Интернет в целевой версии нужен только для Emmy, открытия оригинальной
вакансии и необязательной асинхронной проверки обновлений. Эта проверка не
блокирует offline startup.

## Snapshot

| Метрика | Значение |
|---|---:|
| Канонические активные вакансии | 78 719 |
| Вакансии со skills | 68 881 |
| Вакансии с `salary_usd_year` | 22 467 |
| Пропущенные attribution/URL | 0 |

Release manifest: [`config/catalog-manifest.json`](config/catalog-manifest.json).
Сам `catalog-v1.sqlite.zst` не хранится в Git и должен публиковаться отдельным
release asset только вместе с первой готовой версией.

## Структура

```text
apps/desktop/          Tauri v2 + React 19 Windows app
config/search/         локальные ESCO/skill aliases
docs/                  продуктовый и технический контракт
tools/catalog_export/  единственный Python data-tool
tests/catalog_export/  unit/contract tests экспортёра
```

Legacy FastAPI, Alembic, ingestion, коннекторы, Redis, pgvector и Docker Compose
удалены после успешной сборки snapshot. Исходный PostgreSQL named volume
сохраняется локально отдельно от репозитория и не нужен обычной разработке.

## Разработка

```powershell
pnpm install
pnpm quality

pnpm -C apps/desktop dev
pnpm -C apps/desktop typecheck
pnpm -C apps/desktop lint
pnpm -C apps/desktop test
pnpm -C apps/desktop web:build

uv sync --locked --all-groups
uv run ruff check .
uv run ruff format --check .
uv run mypy
uv run pytest -q
```

`pnpm quality` последовательно запускает существующие frontend, Rust и Python
gates. Exact-SHA baseline M2 сохранён в
[`docs/evidence/M2_BASELINE_74A8588.md`](docs/evidence/M2_BASELINE_74A8588.md).

Однократный export из сохранённого frozen volume:

```powershell
uv run python -m tools.catalog_export export
uv run python -m tools.catalog_export verify `
  .artifacts/catalog/catalog-v1.sqlite `
  --archive .artifacts/catalog/catalog-v1.sqlite.zst
```

Команда export открывает PostgreSQL в `REPEATABLE READ, READ ONLY`; она не
запускает ingestion и не меняет исходную базу.

## Scope

В MVP нет live ingestion, backend runtime, embeddings, вероятности оффера,
парсинга резюме, tracker/auto-apply, аккаунтов или сборок macOS/Linux.
Подробности: [`AGENTS.md`](AGENTS.md), [`docs/PLAN.md`](docs/PLAN.md) и
[`docs/DECISIONS.md`](docs/DECISIONS.md).

## Секреты

`.env` не коммитится. BYOK в приложении должен храниться только в Windows
Credential Manager. Release demo-ключи считаются извлекаемыми и поступают
только из защищённого GitHub Actions environment в Rust release build.
