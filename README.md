# GiveMeJob!

[![Quality](https://github.com/emmzde/GiveMeJob/actions/workflows/quality.yml/badge.svg)](https://github.com/emmzde/GiveMeJob/actions/workflows/quality.yml)

GiveMeJob! — open-source portfolio pet-project: локальное Windows-приложение
для поиска по зафиксированному каталогу вакансий. Репозиторий пока private и
станет публичным после release gate и проверки на секреты.

## Текущий статус

- D0 (документационный pivot) — завершён;
- M1 (verified snapshot) — завершён;
- M2 (offline search и desktop shell) — завершён;
- M3 (profile, on-demand match и shortlist) — завершён;
- M4 (Emmy) — core реализован, acceptance продолжается;
- опубликованных GitHub Releases пока нет.

Локальные NSIS и portable artifacts успешно собираются, но это инженерная
проверка, а не готовая пользовательская версия. Решение и критерии первого
релиза: [`docs/RELEASE_STATUS.md`](docs/RELEASE_STATUS.md).

## Что уже работает

- воспроизводимый PostgreSQL → SQLite FTS5 export;
- проверенный snapshot из 78 719 активных канонических вакансий;
- `PRAGMA integrity_check`, foreign key audit, attribution/URL gate;
- versioned manifest, SHA-256 и Zstandard archive;
- строгий локальный Rust IPC для статуса, FTS5-поиска, detail и facets;
- backend-фильтры, сортировки relevance/newest/salary и cursor/keyset;
- React shell с доступными фильтрами, сортировкой рядом с выдачей, active
  chips, cursor pagination, виртуализированной лентой и отдельной карточкой;
- локальные skill/location autocomplete с keyboard navigation и популярными
  значениями до ввода;
- выбранное состояние вакансии, адаптивные панели, структурированное
  plain-text описание и безопасный переход на оригинал;
- session-only system/light/dark theme, WCAG AA tokens, roving keyboard feed и
  доступная `Ctrl+K` command palette;
- локальный profile с сохранением черновика, field-level validation и Retry;
- schema v1 `user.sqlite`, сохраняемый shortlist, экран избранного и shortcut
  `s`;
- детерминированный on-demand match-score с пятью компонентами, strengths и
  gaps;
- Rust `LLMRouter` с последовательным Groq → Gemini → OpenRouter → Cerebras
  fallback, timeout, `Retry-After`, cooldown и in-memory health metrics;
- закрытые Rust/zod-схемы Emmy, максимум 12 сообщений и четыре tool-шага;
- ровно пять локальных tools: `search_jobs`, `get_job`, `compare_jobs`,
  `get_match_breakdown`, `set_shortlist` с отдельным подтверждением записи;
- настоящий Emmy chat с timeline, tool activity, job cards, comparison table,
  quick replies, историей разговоров и состояниями SVG-маскота;
- BYOK через Windows Credential Manager и release-only wiring demo credentials;
- graceful AI offline: отказ всех моделей не блокирует локальный продукт;
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
gates. Current exact-SHA catalog baseline сохранён в
[`docs/evidence/M2_CATALOG_BASELINE_B30162A.md`](docs/evidence/M2_CATALOG_BASELINE_B30162A.md),
а состояние filter/feed/detail UI — в
[`docs/evidence/M2_FILTER_UI_2026-08-01.md`](docs/evidence/M2_FILTER_UI_2026-08-01.md).
Versioned corpus timings, cursor audit и native package/recovery metrics:
[`docs/evidence/M2_BENCHMARK_GATE_2026-08-01.md`](docs/evidence/M2_BENCHMARK_GATE_2026-08-01.md).
Финальная physical-offline, Narrator/keyboard и reduced-motion запись, официально
закрывающая M2:
[`docs/evidence/M2_FINAL_ACCEPTANCE_2026-08-01.md`](docs/evidence/M2_FINAL_ACCEPTANCE_2026-08-01.md).
Закрывающая запись M3 с native save/restart/load smoke:
[`docs/evidence/M3_FINAL_ACCEPTANCE_2026-08-01.md`](docs/evidence/M3_FINAL_ACCEPTANCE_2026-08-01.md).
Текущая проверка M4 core, включая fake-provider failover, native Credential
Manager roundtrip и список ещё открытых live gates:
[`docs/evidence/M4_IMPLEMENTATION_PROGRESS_2026-08-01.md`](docs/evidence/M4_IMPLEMENTATION_PROGRESS_2026-08-01.md).

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

`.env` не коммитится. BYOK хранится только в Windows Credential Manager; React
получает лишь статус настройки, но не значение ключа. Release demo-ключи
считаются извлекаемыми и поступают только из защищённого GitHub Actions
environment в Rust release build. Debug/test-сборки не содержат demo keys.
