# GiveMeJob!

GiveMeJob! — кроссплатформенный агрегатор вакансий с локальным быстрым
поиском, объяснимым match-score и калиброванной оценкой шанса получить оффер.

Сейчас репозиторий находится в фазе 0: фундамент без продуктовых функций и
без вызовов LLM.

## Требования

- Python 3.13 и [uv](https://docs.astral.sh/uv/)
- Node.js 24+ и pnpm 11
- Rust stable и системные зависимости Tauri v2
- Docker с Compose

## Первый запуск

```bash
cp .env.example .env
docker compose up -d
uv sync --all-groups
uv run alembic upgrade head
uv run uvicorn services.api.main:app --reload
```

API будет доступен на `http://127.0.0.1:8000`; проверка:

```bash
curl http://127.0.0.1:8000/health
```

В другом терминале:

```bash
pnpm install
pnpm -C apps/desktop dev
```

## Проверки качества

```bash
uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run pytest -q

pnpm -C apps/desktop typecheck
pnpm -C apps/desktop lint
pnpm -C apps/desktop test
pnpm -C apps/desktop web:build
```

Полная спецификация находится в [`docs/PLAN.md`](docs/PLAN.md), обязательные
инварианты — в [`AGENTS.md`](AGENTS.md).

## Зафиксированный scope MVP

Решения о рынке, локализации, каноне скиллов и закрытой модели исходников
зафиксированы в [`docs/DECISIONS.md`](docs/DECISIONS.md) и
[`config/product.json`](config/product.json).
