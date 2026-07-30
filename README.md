# GiveMeJob!

GiveMeJob! — публичный pet-project: автономное Windows-приложение для
красивого и умного поиска работы по замороженному каталогу вакансий.

Главные особенности будущего MVP:

- 78 719 канонических вакансий в локальном SQLite FTS5;
- поиск, фильтры и карточки без сервера и Docker;
- короткий локальный профиль и объяснимый match-score;
- избранное и история только на компьютере пользователя;
- Emmy — анимированная SVG-собачка и AI-ассистент с инструментами поиска;
- NSIS `Setup.exe`, portable ZIP и обновления через GitHub Releases.

## Текущий статус

31 июля 2026 года продукт переведён из идеи production-агрегатора в
Windows-only pet MVP.

- Исторический ingestion завершён и заморожен.
- Зафиксировано 78 719 активных канонических вакансий.
- Новые источники, sweep, freshness/salary work и embeddings отменены.
- Следующий технический этап — воспроизводимый экспорт PostgreSQL → SQLite
  FTS5.
- Пользовательский offline runtime пока не реализован.

Актуальный roadmap: [`docs/PLAN.md`](docs/PLAN.md). Обязательные правила:
[`AGENTS.md`](AGENTS.md).

## Как будет работать приложение

После установки приложение распакует versioned catalog в Local AppData.
Поиск и match-score будут работать полностью офлайн. Интернет потребуется
только для Emmy и открытия оригинальной страницы вакансии.

Пользовательские данные будут храниться отдельно от каталога, поэтому
обновление приложения не удалит профиль или избранное.

## Разработка desktop

Требования:

- Node.js 24+ и pnpm 11;
- Rust stable;
- системные зависимости Tauri v2/WebView2.

```powershell
pnpm install
pnpm -C apps/desktop dev
```

Проверки:

```powershell
pnpm -C apps/desktop typecheck
pnpm -C apps/desktop lint
pnpm -C apps/desktop test
pnpm -C apps/desktop web:build
```

## Исторический data-tooling

Python, PostgreSQL, Redis, Alembic и Docker Compose сохраняются только для
аудита исходного набора и реализации snapshot export. Они не будут нужны
пользователю установленного приложения.

```powershell
uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run pytest -q
```

Запуск ingestion запрещён активным scope.

## Emmy и API-ключи

Первая версия использует бесплатные Groq, Gemini и OpenRouter через единый
Rust `LLMRouter`.

Portfolio release может содержать отдельные free-tier demo-ключи, внедрённые
из GitHub Actions Secrets в Rust-сборку. Они считаются извлекаемыми и не
должны иметь billing или доступ к другим сервисам. Реальные значения никогда
не хранятся в Git или frontend bundle.

Продвинутый пользователь сможет включить BYOK; его ключ хранится в Windows
Credential Manager.

## Документация

- [`docs/PLAN.md`](docs/PLAN.md) — полная спецификация и этапы;
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — принятые решения;
- [`docs/MVP_SCOPE.md`](docs/MVP_SCOPE.md) — границы релиза;
- [`docs/METRICS.md`](docs/METRICS.md) — проверки snapshot и продукта;
- [`docs/schema.sql`](docs/schema.sql) — целевая SQLite-схема;
- [`docs/design-tokens.css`](docs/design-tokens.css) — дизайн-токены;
- [`DEVELOPMENT.md`](DEVELOPMENT.md) — порядок разработки и проверок.

## Распространение

Цель — публичный исходный код и публичные GitHub Releases. Первая версия
ориентирована только на Windows 10/11 x64. Authenticode-подписи в v1 нет,
поэтому Windows SmartScreen может показать предупреждение; обновления при этом
будут подписываться отдельным ключом Tauri.
