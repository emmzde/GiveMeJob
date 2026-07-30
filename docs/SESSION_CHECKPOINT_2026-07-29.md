# Исторический checkpoint ingestion — 29 июля 2026

> Архивный документ. Не использовать как инструкцию для продолжения работы.
> Активный scope с 31 июля 2026 года находится в `AGENTS.md` и
> `docs/PLAN.md`. Ingestion заморожен.

## Зачем сохранён этот файл

Checkpoint фиксирует происхождение текущего dataset и объясняет, какие части
репозитория являются историческим data-tooling. Команды продолжения sweep,
backfill и live API намеренно удалены.

## Состояние репозитория на 29 июля

- Ветка: `main`.
- Зафиксированный на тот момент commit:
  `bc334af fix(ci): configure Tauri bundle icons`.
- Remote тогда был приватным: `https://github.com/emmzde/GiveMeJob`.
- Quality и Desktop build workflows на указанном commit были зелёными.
- Фаза 0 проверяла Docker, миграции, pgvector, FTS/HNSW/GIN, нативное окно
  Tauri и release bundle.

Решение от 31 июля требует сделать репозиторий публичным на release-этапе
после secret/history audit.

## Что было реализовано в ingestion

- общий polite HTTP client;
- Connector SDK и fixture contract tests;
- Adzuna, Jooble, Himalayas, Arbeitnow, Remotive, Jobicy;
- Greenhouse, Lever, Ashby, Workable;
- выключенная hh.ru-заглушка;
- ATS registry;
- детерминированная нормализация;
- ESCO canonical skills и aliases;
- SimHash-дедупликация;
- FastEmbed wrapper;
- PostgreSQL repository, checkpoints и CLI.

Этот код может использоваться для чтения, тестов и воспроизводимого snapshot
export. Его сетевые ingestion entrypoints не запускаются.

## Промежуточный срез на момент остановки

До завершения Himalayas sweep и финального freeze в базе было:

| Метрика | Значение |
|---|---:|
| Active source rows | 10 468 |
| Rows со skills | 9 296 / 88,80% |
| Rows с salary | 938 / 8,96% |
| Rows с embedding | 1 |
| Median age | около 61 дня |

Эти числа исторические и заменены финальным baseline:

| Метрика | Финальный freeze |
|---|---:|
| Active canonical jobs | 78 719 |
| Со skills | 68 881 / 87,50% |
| С salary USD/year | 22 467 / 28,54% |
| Residual duplicates | 0 |
| Median age at freeze | 21,87 дня |

## Секреты

Локальный `.env` существовал и содержал Adzuna/Jooble credentials. Значения
не выводились и были исключены из Git.

Эти ingestion credentials не нужны Windows MVP и не должны попадать в
snapshot или release.

Отдельные LLM demo credentials допускаются только по актуальной policy:
GitHub Actions Secrets → Rust release build, free tier, без billing, считаются
извлекаемыми.

## Разрешённое использование исторической БД

Только:

- read-only подтверждение baseline;
- snapshot export;
- integrity/attribution audit;
- regression tests существующего data-tooling.

Не разрешено:

- продолжение ATS sweep;
- Adzuna/Jooble live calls;
- новые источники;
- freshness/salary backfill;
- embeddings;
- запуск scheduler.

Следующий активный этап — M1 из `docs/PLAN.md`: детерминированный
PostgreSQL → SQLite FTS5 artifact.
