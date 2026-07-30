# GiveMeJob! — разработка

Актуальное направление проекта — автономный Windows pet MVP. Перед началом
работы следует ознакомиться с:

1. `AGENTS.md`;
2. `docs/PLAN.md`;
3. `docs/DECISIONS.md`;
4. `docs/MVP_SCOPE.md`;
5. `docs/METRICS.md`;
6. `config/product.json`.

Приоритет имеют правила из `AGENTS.md`.

## Текущее состояние

- Целевая платформа — Windows 10/11 x64.
- Runtime не требует FastAPI, PostgreSQL, Redis, Docker или Python.
- Каталог заморожен на 78 719 активных канонических вакансиях.
- Ingestion, новые источники и embeddings остановлены.
- Поиск строится на локальном SQLite FTS5.
- Match-score локальный, детерминированный и не является вероятностью оффера.
- Emmy — анимированная SVG-собачка и ассистент внутри приложения.
- Основной release artifact — NSIS `Setup.exe`.
- Дополнительный artifact — portable ZIP.

## Порядок работы

Этапы выполняются последовательно:

1. M1 — snapshot;
2. M2 — offline search;
3. M3 — profile, match и shortlist;
4. M4 — Emmy;
5. M5 — public Windows release.

Следующий этап начинается только после фактической проверки критерия
предыдущего. Текущая задача не должна незаметно расширяться соседними
функциями.

## Ближайший технический этап

M1 создаёт воспроизводимый PostgreSQL → SQLite FTS5 snapshot:

1. Подтвердить frozen dataset read-only SQL-запросами.
2. Реализовать детерминированный export.
3. Не обращаться к внешним job APIs.
4. Проверить 78 719 canonical jobs.
5. Проверить attribution и `source_url` каждой записи.
6. Сформировать versioned artifact, manifest и SHA-256.
7. Добавить integration test.

UI и Emmy не входят в M1.

## Локальные проверки

Desktop:

```powershell
pnpm install
pnpm -C apps/desktop typecheck
pnpm -C apps/desktop lint
pnpm -C apps/desktop test
pnpm -C apps/desktop web:build
```

Data tooling:

```powershell
uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run pytest -q
```

Docker/PostgreSQL используется только для read-only аудита frozen dataset и
snapshot export. Запуск ingestion не допускается.

## Безопасность release

- Реальные credentials не коммитятся.
- Pull request workflows не получают release secrets.
- Demo credentials находятся в защищённом GitHub Actions environment.
- Release build внедряет их только в Rust-часть приложения.
- Ключи создаются отдельно для проекта, работают без billing и считаются
  извлекаемыми из бинарника.
- BYOK хранится в Windows Credential Manager.
- Updater private key хранится только в GitHub Secrets.

Перед публикацией обязательны:

- `git diff --check`;
- тесты изменённых подсистем;
- secret scan tracked files и истории;
- проверка release artifacts;
- сверка документации с фактическим поведением.

## Устаревшие направления

Не возобновляются без нового решения:

- ATS sweep;
- Adzuna/Jooble live calls;
- новые источники;
- freshness/salary backfill;
- embeddings и vector search;
- обязательный cloud backend;
- сборки macOS/Linux;
- probability score;
- tracker и auto apply.
