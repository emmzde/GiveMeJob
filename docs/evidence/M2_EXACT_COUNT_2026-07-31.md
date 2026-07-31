# M2 exact count benchmark — 2026-07-31

Назначение: решить, допустимо ли вычислять optional `SearchPage.total` точным
`count(*)` на первой странице поиска. Этот замер не заменяет полный M2 search
corpus gate из `docs/METRICS.md`.

## Среда

- Windows 11 Home `10.0.26200`;
- Intel Core i5-13420H;
- 15.8 GiB RAM;
- SKHynix HFS001TEJ4X112N SSD;
- `catalog-v1.sqlite`, 78 719 jobs;
- SQLite открыт read-only с `query_only = ON` и `temp_store = MEMORY`.

Для каждого сценария выполнено 5 warm-up и 30 измеряемых запусков. Page query
выбирал 41 ID (page size 40 + lookahead). Exact count не включал cursor predicate,
то есть считал полный набор результатов текущего query/filter contract.

## Результаты

| Scenario | Exact rows | count p50, ms | count p95, ms | page p95, ms | page + count p95, ms |
|---|---:|---:|---:|---:|---:|
| feed/newest | 78 719 | 0.03 | 0.03 | 0.04 | 0.08 |
| FTS `python` | 9 306 | 26.26 | 27.55 | 35.17 | 62.16 |
| FTS `machine learning` | 6 056 | 20.10 | 21.65 | 28.87 | 50.89 |
| remote + salary | 13 925 | 112.04 | 118.34 | 0.74 | 117.59 |
| skill with no exact canonical match | 0 | 0.03 | 0.03 | 0.03 | 0.06 |
| FTS + remote modes + salary + sources | 0 | 46.54 | 47.84 | 48.90 | 96.01 |
| zero result | 0 | 0.03 | 0.06 | 0.05 | 0.13 |

Худший наблюдавшийся page + exact count p95 — `117.59 ms`, строго ниже hard
gate `<300 ms`; худший count-only p95 — `118.34 ms`.

## Решение

`SearchPage.total` остаётся optional по IPC-контракту. Runtime вычисляет и
возвращает exact total только для первой страницы (`cursor` отсутствует). Для
следующих страниц count не повторяется и поле `total` отсутствует. Frontend при
отсутствующем total показывает число уже загруженных результатов.
