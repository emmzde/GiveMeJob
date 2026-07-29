# GiveMeJob! — scope pet-project MVP

Дата решения: 30 июля 2026 года.

## Статус

GiveMeJob! развивается как pet-project и демонстрационный MVP, а не как
production-агрегатор вакансий. Цель — показать работающий пользовательский
продукт на уже собранном репрезентативном наборе данных.

Фаза 1 закрыта. Следующая активная работа — пользовательский поиск и API на
PostgreSQL FTS. Векторный поиск и embeddings в текущий MVP не входят.

## Зафиксированный набор данных

Срез локальной PostgreSQL на момент решения:

| Метрика | Значение |
|---|---:|
| Активные канонические вакансии | 78 719 |
| Канонические вакансии со skills | 68 881 (87,50%) |
| Канонические вакансии с `salary_usd_year` | 22 467 (28,54%) |
| Residual-дубли | 0 |
| Embeddings с `vector_dims = 1024` | 1 |
| Медианный возраст | 21,87 дня |
| Активные сырые строки | 78 877 |

Каноническая вакансия определяется через `job_groups.canonical_job`; SQL
определения остаются в `docs/METRICS.md`. Метрики salary, freshness и
embeddings сохраняются как диагностические, но больше не являются gate для MVP.

Himalayas full sweep завершён:

- обработано 96 200 элементов feed;
- сохранено идемпотентным upsert 96 182;
- в БД 68 409 строк источника Himalayas;
- у всех строк есть attribution `Himalayas` и backlink;
- persistent checkpoint помечен завершённым.

## Что входит в завершённую фазу 1

- Connector SDK и демонстрационные API/ATS-коннекторы;
- нормализация вакансий и извлечение skills;
- канонизация и дедупликация SimHash с блокирующим ключом;
- батчевый PostgreSQL persistence;
- resumable checkpoints и progress logging;
- достаточный для UI и поиска набор данных.

Коннекторы Adzuna и Jooble могут оставаться в репозитории как код и
контрактные fixtures, но их live-интеграция, сбор и эксплуатация не входят в
MVP.

## Явно отменено

- live-интеграция и sweep Adzuna и Jooble;
- продолжение ATS sweep;
- новые источники вакансий;
- достижение salary coverage 35%;
- достижение медианной свежести меньше 5 дней;
- backfill embeddings по всей базе;
- production scheduler/retry, дальнейшая оптимизация ingestion и масштабирование
  агрегатора.

Новые ingestion-запуски не выполняются без отдельного решения об изменении
scope.

## Активный продуктовый этап

FTS-only API поиска:

- `GET /jobs` с пагинацией;
- PostgreSQL full-text search;
- фильтры skills, location, `remote_type`, seniority и salary;
- сортировки relevance, newest и salary;
- `GET /jobs/{id}`;
- желательный p95 обычного запроса меньше 300 мс на текущем наборе;
- embeddings не используются.

