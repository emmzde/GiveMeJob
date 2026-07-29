# Session checkpoint — 2026-07-29 17:35 Asia/Baku

Работа остановлена по просьбе пользователя. Активных процессов
`python -m services.ingest.cli run-ats` нет. PostgreSQL и Redis оставлены
запущенными в Docker и имеют статус `healthy`.

Обновление после остановки: локальный `.env` создан и пользователь заполнил
`ADZUNA_APP_ID`, `ADZUNA_APP_KEY` и `JOOBLE_API_KEY`. Проверено только наличие
непустых значений; сами секреты не выводились. `.env` исключён из Git.

## Git и фаза 0

- Ветка: `main`.
- Последний сохранённый commit: `bc334af fix(ci): configure Tauri bundle icons`.
- Remote: приватный `https://github.com/emmzde/GiveMeJob`.
- Последние Quality и Desktop build workflows на `bc334af` завершились успешно.
- Фаза 0 фактически проверена: Docker, миграция, pgvector 1024, FTS/HNSW/GIN,
  нативное окно Tauri и release bundle.
- Весь текущий код фазы 1 пока не закоммичен и не запушен.

## Реализовано в рабочем дереве для фазы 1

- Общий `PoliteHttpClient`: truthful User-Agent, per-domain rate limit, retry,
  exponential backoff, timeout, redacted credential URLs.
- Connector SDK и отдельные fixture contract tests.
- API-коннекторы: Adzuna, Jooble, Himalayas, Arbeitnow, Remotive, Jobicy.
- ATS-коннекторы: Greenhouse, Lever, Ashby, Workable.
- `hh.ru` оставлен выключенной заглушкой до Developer Agreement.
- ATS registry: 345 slug, polling 8 часов.
- Celery schedule: ATS 8 часов; публичные feeds 6 часов; Himalayas 24 часа.
- Детерминированная нормализация без LLM: HTML→Markdown, salary parsing,
  current FX conversion, seniority/min experience, locations, quality score.
- English ESCO catalog через официальный API: 54 canonical URI и 150 aliases.
- SimHash 64-bit + company blocking.
- FastEmbed `intfloat/multilingual-e5-large`; реальная запись в PostgreSQL
  подтверждена как `vector_dims(embedding) = 1024`.
- Идемпотентный PostgreSQL repository и CLI для seed/run/run-ats/backfill.
- Живая БД мигрирована до `20260729_0003`.

## Фактическое состояние живой БД на остановке

| Метрика | Значение | Критерий фазы 1 |
|---|---:|---:|
| Active source rows | 10 468 | ≥50 000 уникальных |
| SimHash groups | 8 666 | — |
| Rows со skills | 9 296 / 88.80% | ≥60% |
| Rows с salary | 938 / 8.96% | ≥35% |
| Rows с embedding | 1 | все |
| Raw rows сверх unique groups | 17.21% | <3% после дедупликации |
| Median posted_at | 2026-05-29 13:53 UTC | age <5 дней |
| Median age | около 61 дня | <5 дней |

Source rows до остановки:

- Greenhouse: sweep начал/частично завершил запись, в БД 8k+ rows.
- Lever: sweep был прерван в процессе, в БД 2k+ rows.
- Arbeitnow: 5 smoke-test rows.
- Ashby и Workable в прерванном общем sweep ещё не дошли до записи.

Точные counts нужно переснять SQL при возобновлении: несколько последних
транзакций завершались непосредственно перед остановкой.

## Известные незавершённые пункты

1. Live Adzuna/Jooble ещё не проверены, но необходимые ключи уже находятся
   в локальном `.env`.
2. ATS sweep остановлен вручную. Повтор безопасен: upsert идемпотентен по
   `(source, source_job_id)`.
3. До 50k вакансий не добрано.
4. Salary coverage, freshness, embeddings и duplicate acceptance пока не пройдены.
5. Нужны фильтрация stale postings и формальное определение duplicate metric
   на canonical groups, а не raw source variants.
6. CLI долгих sweep пока не печатает progress по каждой компании.
7. После последних ESCO/repository изменений полный `pytest -q` ещё не повторён.
   Последние факты: Ruff green, strict mypy green, targeted ESCO tests `4 passed`,
   FastEmbed wrapper test `1 passed`.
8. Изменения фазы 1 нужно разбить на осмысленные commits, проверить gitleaks,
   push и дождаться зелёного CI.

## Безопасное продолжение

```powershell
# Проверить инфраструктуру и состояние
docker compose ps
docker compose exec -T db psql -U postgres -d givemejob -c "select source, count(*) from jobs group by source order by count(*) desc;"

# Полная локальная проверка перед дальнейшим ingestion
uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run pytest -q

# Продолжить ATS идемпотентно по провайдерам
uv run python -m services.ingest.cli run-ats --provider lever --no-embed --batch-size 64
uv run python -m services.ingest.cli run-ats --provider ashby --no-embed --batch-size 64
uv run python -m services.ingest.cli run-ats --provider workable --no-embed --batch-size 64

# Затем публичные feeds, backfill embeddings и финальные SQL acceptance queries.
```
