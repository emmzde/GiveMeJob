# GiveMeJob! — разработка

## Активный этап

D0, M1, M2 и минимальный M3 завершены. В `config/catalog-manifest.json`
зафиксирован проверенный snapshot из 78 719 вакансий. Текущий этап — M4: Emmy.
Backend-фильтры, search correctness, сортировки relevance/newest/salary и
cursor/keyset готовы. Filter/sort UI, active chips, local autocomplete,
cursor pagination, виртуализированная лента и job detail подключены к строгому
IPC-контракту. Profile, shortlist и on-demand deterministic match готовы;
глобальный match-sort отложен после core M4 и до M5 по ADR-018.
Core Emmy уже реализован: provider adapters, router, structured contracts,
пять tools, timeline/cards/comparison, локальная история, Credential Manager и
graceful offline. M4 остаётся открытым до live-provider, UI BYOK restart и
native all-providers-unavailable/protected-release smoke; текущая запись —
`docs/evidence/M4_IMPLEMENTATION_PROGRESS_2026-08-01.md`.
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

Для интерактивной проверки нативного окна:

```powershell
pnpm -C apps/desktop dev
```

Или сначала собрать standalone debug executable без installer, затем запустить
`apps/desktop/src-tauri/target/debug/givemejob-desktop.exe`:

```powershell
pnpm -C apps/desktop exec tauri build --debug --no-bundle
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

Debug-сборка позволяет изолировать пользовательскую базу для smoke-тестов без
изменения реального `%LOCALAPPDATA%`: задайте полный путь
`GIVEMEJOB_USER_DATA_PATH`. Переменная читается только в debug/test build;
release-код её игнорирует.

Rust-проверки:

```powershell
cargo fmt --check --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml `
  --all-targets --all-features
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml `
  --all-targets --all-features
cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml `
  --all-targets --all-features -- -D warnings
```

## Emmy и provider credentials

Agent loop, router, provider adapters, пять локальных tools и Credential
Manager находятся в `apps/desktop/src-tauri/src/emmy`. Сетевые вызовы в
unit/integration tests не выполняются: вертикаль search → tool result → второй
model turn проверяется через fake provider.

Адаптер учитывает реальные возможности API: OpenRouter остаётся основным
провайдером и для первого tool-шага использует native function calling по
ровно пяти разрешённым схемам. Reasoning для OpenRouter отключён. Бесплатные
OpenRouter endpoints получают схему в system prompt, а каждый ответ в любом
случае проходит закрытую serde-валидацию. Известный unwrapped response payload
получает закрытые defaults и снова валидируется; CJK/Hangul в generated text
не пропускается, а невалидная quick reply удаляется. Простой чат начинает с OpenRouter
Ling и при невалидном ответе рано переходит к Groq Llama. После tool result
router также сначала делает быструю OpenRouter-попытку, затем может перейти к
Groq, Gemini и Cerebras раньше оставшихся медленных free endpoints. Groq
Llama/Qwen используют JSON Object Mode, Gemini — `responseJsonSchema`,
Cerebras — строгую JSON Schema.

Одна provider/model попытка ограничена тремя секундами, а весь Emmy turn,
включая последовательные model calls и локальные tools, — 15 секундами.
Параллельной гонки нет. В лог попадают только provider, model, закрытый outcome
и latency; prompt, ключи и raw response не логируются. Ошибка инициализации AI
runtime переводит только Emmy в offline и не блокирует запуск каталога.

Полная timeline остаётся в `user.sqlite`. На сетевой запрос уходят последние
12 сообщений и memory-сводка до 4000 символов, обновляемая моделью и
атомарно сохраняемая вместе с ответом. Сводка переносится между моделями и
провайдерами, но не должна содержать ключи, полный профиль или сырые описания
вакансий.

```powershell
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml emmy::
```

Live-smoke с настроенными BYOK запускается отдельно:

```powershell
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml live_openrouter_bridge_answers_within_fifteen_seconds -- --ignored
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml live_openrouter_native_tool_call_answers_within_fifteen_seconds -- --ignored
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml live_openrouter_search_turn_completes_within_fifteen_seconds -- --ignored
```

Для локального live smoke добавьте собственный, предварительно ротированный
ключ на экране Settings → Emmy. Приложение записывает BYOK в Windows Credential
Manager. При вводе поле существует во frontend только до IPC-вызова; после
сохранения Rust возвращает React только `configured`, `byokConfigured` и
`demoAvailable`, но не значение ключа. Очистка ключа выполняется на том же
экране. BYOK имеет приоритет над встроенным demo credential.

Изолированный native CredWrite/CredRead/CredDelete test уже проходит. Перед
закрытием M4 отдельно выполняется пользовательский UI smoke: save → restart →
`configured` → clear для каждого настроенного провайдера, без вывода значения
ключа в IPC или logs.

Отдельный native offline smoke запускается без доступных credentials/сети и
подтверждает, что каталог, профиль и shortlist продолжают работать после
перехода Emmy в `offline`.

Release workflow получает четыре значения только из secrets защищённого
GitHub Environment `release`:

```text
GIVEMEJOB_GROQ_DEMO_KEY
GIVEMEJOB_GEMINI_DEMO_KEY
GIVEMEJOB_OPENROUTER_DEMO_KEY
GIVEMEJOB_CEREBRAS_DEMO_KEY
```

`build.rs` читает их только при `PROFILE=release`; debug/test сборки всегда
получают пустые встроенные credentials. Значения не добавляются в `.env`, Git,
документацию или команды. Обфускация release-значений не делает их секретными:
для публичного бинарника используются отдельные free-tier проекты без billing,
с минимальными квотами и готовой процедурой revoke/rotation.

Versioned M2 corpus benchmark запускается отдельно уже после release build и
при остановленном UI: он выполняет 5 warm-ups и 30 samples для каждого из 90
сценариев, измеряет cold first query и обходит все 78 719 ID через cursor.
Feature нужен только benchmark binary и исключает его из пользовательского
NSIS/portable payload.

```powershell
cargo build --release --manifest-path apps/desktop/src-tauri/Cargo.toml `
  --features m2-benchmark --bin m2_benchmark

apps/desktop/src-tauri/target/release/m2_benchmark.exe `
  --catalog .artifacts/catalog/catalog-v1.sqlite `
  --config config/search/benchmark-v1.json `
  --output .artifacts/m2/benchmark-v1-run.json
```

Runner требует release mode, проверяет неизменяемый контракт корпуса и создаёт
output только по новому пути. Зафиксированные raw timings и native gate:
`docs/evidence/M2_BENCHMARK_GATE_2026-08-01.md`.

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

1. M2 — завершён; closing evidence:
   `docs/evidence/M2_FINAL_ACCEPTANCE_2026-08-01.md`.
2. M3 — завершён: профиль, shortlist и детерминированный on-demand match-score;
   глобальный match-sort отложен по ADR-018.
3. M4 — текущий этап: Emmy, Rust `LLMRouter`, пять разрешённых tools и BYOK.
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
