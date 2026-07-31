# M2 filters, facets and SQL performance — 2026-07-31

Scope этой записи ограничен backend-фильтрами, локальными autocomplete/facets и
corpus performance. Она не закрывает UI wiring или M2 целиком.

## Artifact и среда

- `catalog-v1.sqlite`: 78 719 jobs, 1 043 488 768 bytes;
- SHA-256: `e03b6b3e76be625c432268043cc241eb133e41566c3057dfdb610dbab92ab71e`;
- Windows 11 Home `10.0.26200`;
- Intel Core i5-13420H, 15.8 GiB RAM, NVMe SSD;
- SQLite открыт read-only с `query_only = ON` и `temp_store = MEMORY`;
- release Rust test binary;
- для каждого scenario: 5 warm-ups и 30 измеряемых first-page запросов;
- page size 40 + один lookahead row; exact `total` включён во время запроса.

Команда:

```powershell
cargo test --release --manifest-path apps/desktop/src-tauri/Cargo.toml `
  frozen_artifact_location_and_salary_benchmark -- --ignored --nocapture
```

## Результаты

Ниже указан худший p95 из трёх последовательных чистых release-прогонов уже
собранного test binary.

| Scenario | Exact rows | worst p95, ms |
|---|---:|---:|
| location `Berlin` | 16 | 0.64 |
| location `New York` | 237 | 4.64 |
| location `US` | 41 506 | 273.02 |
| country-only input `DE` | 2 372 | 18.40 |
| location zero-result | 0 | 0.56 |
| salary threshold `0` | 22 467 | 153.54 |
| salary threshold `100 000` | 13 925 | 111.18 |
| salary threshold `10 000 000` | 0 | 0.33 |

Worst observed clean-run p95 — `273.02 ms`, строго ниже hard gate `<300 ms`.
Целевой уровень `<150 ms` не пройден для broad `US` и в одном прогоне для
salary `0`; это не блокирует M2 hard gate.

## Correctness и query plans

- country/city candidate IDs выбираются через существующий
  `jobs_location_idx`;
- `location_text` candidate IDs выбираются через column-scoped FTS5;
- после preselection всегда повторяется точный predicate
  `country IN (...) OR city IN (...) OR location_text IN (...)`;
- first-page location/salary query считает exact total и page одним проходом;
- salary threshold preselection использует существующий `jobs_salary_idx`,
  затем повторяет точный `salary_usd_year >= ?`;
- `EXPLAIN QUERY PLAN` regression checks требуют `jobs_location_idx`, FTS5 и
  `jobs_salary_idx` для sparse/edge cases;
- полный ID-set нового location pipeline совпал со старым exact scan для
  `Berlin`, `New York`, `US`, `DE`, OR (`Berlin` + `New York`) и zero-result.

Artifact-backed tests также проверили каждый filter, OR внутри skills, OR внутри
locations и AND между skill/location/remote/salary/source.

## Решение по индексу

После одного noisy release-run выше 300 ms был измерен
`jobs_location_text_idx(location_text, id)` на отдельной временной копии полного
artifact. При сохранении обязательного FTS preselector этот index не улучшил
план и дал p95 до `332.77 ms`, поэтому он отклонён. Временная копия удалена.

Новые SQLite indexes и corrective export не выполнялись: три последующих чистых
release-прогона прошли hard gate на исходном corpus и существующей schema.
