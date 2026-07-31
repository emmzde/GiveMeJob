# GiveMeJob! — метрики snapshot и Windows MVP

Последнее обновление: 31 июля 2026 года.

Этот документ задаёт воспроизводимые acceptance-проверки. Старые
production-пороги freshness, salary coverage и embedding coverage отменены.

## 1. Источник snapshot

Canonical job — активная строка `jobs`, на которую ссылается
`job_groups.canonical_job`.

Базовый PostgreSQL CTE:

```sql
WITH canonical_jobs AS (
  SELECT
    job.*,
    job_group.blocking_key,
    job_group.simhash
  FROM job_groups AS job_group
  JOIN jobs AS job
    ON job.id = job_group.canonical_job
  WHERE job.is_active
)
SELECT *
FROM canonical_jobs;
```

Перед экспортом ссылки должны быть целыми:

```sql
SELECT
  count(*) FILTER (WHERE canonical_job IS NULL) AS missing_canonical,
  count(*) FILTER (
    WHERE canonical_job IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM jobs AS job
        WHERE job.id = job_groups.canonical_job
          AND job.group_id = job_groups.id
      )
  ) AS invalid_canonical
FROM job_groups;
```

Ожидание: оба значения равны нулю.

## 2. Frozen source baseline

Принятый срез:

| Метрика | Значение |
|---|---:|
| Canonical active jobs | 78 719 |
| Jobs with skills | 68 881 / 87,50% |
| Jobs with usable `salary_usd_year` | 22 467 / 28,54% |
| Residual duplicate jobs | 0 |
| Historical 1024-dim embeddings | 1 |
| Median age at freeze | 21,87 дня |
| Active raw source rows | 78 877 |

Embeddings не экспортируются и не измеряются в runtime catalog.

PostgreSQL baseline query:

```sql
WITH canonical_jobs AS (
  SELECT
    job.*,
    job_group.blocking_key,
    job_group.simhash
  FROM job_groups AS job_group
  JOIN jobs AS job
    ON job.id = job_group.canonical_job
  WHERE job.is_active
),
fingerprint_clusters AS (
  SELECT blocking_key, simhash
  FROM canonical_jobs
  GROUP BY blocking_key, simhash
  HAVING count(*) > 1
),
source_url_clusters AS (
  SELECT source_url
  FROM canonical_jobs
  GROUP BY source_url
  HAVING count(*) > 1
),
residual_duplicate_ids AS (
  SELECT canonical.id
  FROM canonical_jobs AS canonical
  JOIN fingerprint_clusters USING (blocking_key, simhash)

  UNION

  SELECT canonical.id
  FROM canonical_jobs AS canonical
  JOIN source_url_clusters USING (source_url)
)
SELECT
  count(*) AS canonical_jobs,
  count(*) FILTER (
    WHERE EXISTS (
      SELECT 1
      FROM job_skills
      WHERE job_skills.job_id = canonical_jobs.id
    )
  ) AS with_skills,
  count(*) FILTER (
    WHERE salary_usd_year IS NOT NULL
  ) AS with_salary,
  count(*) FILTER (
    WHERE attribution IS NULL OR btrim(attribution) = ''
  ) AS missing_attribution,
  count(*) FILTER (
    WHERE source_url IS NULL OR btrim(source_url) = ''
  ) AS missing_source_url,
  (SELECT count(*) FROM residual_duplicate_ids)
    AS residual_duplicate_jobs
FROM canonical_jobs;
```

Acceptance:

```text
canonical_jobs          = 78719
with_skills             = 68881
with_salary             = 22467
missing_attribution     = 0
missing_source_url      = 0
residual_duplicate_jobs = 0
```

Если фактический read-only запрос расходится, export не продолжается, а
расхождение документируется. Нельзя «добрать» данные новым ingestion.

## 3. Snapshot artifact

Artifact:

```text
catalog-v1.sqlite.zst
catalog-manifest.json
catalog-v1.sqlite.zst.sha256
```

Manifest содержит:

- `catalogVersion`;
- `schemaVersion`;
- `createdAt`;
- source baseline date;
- canonical job count;
- skills/salary counts;
- uncompressed/compressed size;
- artifact SHA-256;
- export commit SHA.

Reproducibility означает:

- одинаковый source snapshot и export commit дают одинаковые logical rows;
- rows сортируются по stable canonical ID;
- timestamp упаковки не входит в logical checksum;
- `VACUUM` выполняется после заполнения;
- случайные ID и нестабильный порядок запрещены.

## 4. SQLite catalog acceptance

После распаковки:

```sql
PRAGMA integrity_check;

SELECT value
FROM catalog_meta
WHERE key = 'catalog_version';

SELECT count(*) AS jobs
FROM jobs;

SELECT count(*) AS fts_rows
FROM jobs_fts;

SELECT count(*) AS missing_attribution
FROM jobs
WHERE trim(attribution) = '';

SELECT count(*) AS missing_source_url
FROM jobs
WHERE trim(source_url) = '';

SELECT count(*) AS duplicate_source_url
FROM (
  SELECT source_url
  FROM jobs
  GROUP BY source_url
  HAVING count(*) > 1
);

PRAGMA foreign_key_check;
```

Ожидание:

```text
integrity_check       = ok
catalog_version       = 1
jobs                  = 78719
fts_rows              = 78719
missing_attribution   = 0
missing_source_url    = 0
duplicate_source_url  = 0
foreign_key_check     = no rows
```

Если несколько канонических вакансий намеренно имеют один `source_url`,
исключение должно быть явно зафиксировано в manifest; молчаливое ослабление
проверки запрещено.

### FTS smoke

Минимальные запросы:

```sql
SELECT job.id, job.title
FROM jobs_fts AS fts
JOIN jobs AS job ON job.id = fts.rowid
WHERE jobs_fts MATCH 'python'
ORDER BY bm25(jobs_fts, 8.0, 6.0, 3.0, 2.0, 1.0, 1.0)
LIMIT 20;

SELECT job.id, job.title
FROM jobs_fts AS fts
JOIN jobs AS job ON job.id = fts.rowid
WHERE jobs_fts MATCH '"machine learning"'
LIMIT 20;
```

Результат должен быть непустым и детерминированным при одинаковом catalog.

## 5. Search performance

Тестовая среда записывает:

- Windows version;
- CPU;
- RAM;
- SSD/HDD;
- cold/warm;
- catalog SHA-256;
- query corpus version.

Corpus:

- 20 RU запросов;
- 20 EN запросов;
- 10 смешанных RU/EN;
- 10 quoted phrases;
- 10 skill aliases;
- 10 filter-heavy запросов;
- 10 zero-result/typo запросов.

Для каждого запроса выполняются пять прогревочных и 30 измеряемых запусков.

Gates:

| Метрика | Цель | Обязательный предел |
|---|---:|---:|
| Warm search p95 | <150 мс | <300 мс |
| Cold first query | <300 мс | <500 мс |
| Feed scroll | 60 fps | без длительных кадров >100 мс |
| Repeated startup | <1,5 с | <2,5 с |
| Steady-state RAM | <200 МБ | <250 МБ |

First-run распаковка измеряется отдельно и не входит в repeated startup.

## 6. Match acceptance

Вес:

```text
skills   0.40
role     0.20
seniority 0.15
location 0.15
salary   0.10
```

Проверки:

- score конечный и в диапазоне 0–100;
- одинаковый profile/job даёт byte-equivalent component JSON;
- неизвестный компонент исключается, остальные веса нормализуются до 1;
- score не меняется из-за сети, AI provider или истории чата;
- strengths/gaps ссылаются только на фактические profile/job fields.

Термин «probability» отсутствует в публичной match-схеме.

## 7. Emmy reliability

На fixture providers:

| Сценарий | Ожидание |
|---|---|
| primary success | один provider call, валидный `EmmyResponse` |
| timeout | fallback на следующий provider |
| 429 | учесть `Retry-After`, поставить cooldown, fallback |
| invalid schema | не показывать сырой ответ, fallback |
| all unavailable | typed unavailable + mascot `offline` |
| prompt injection in job | нет нового tool/system behavior |
| fifth tool step | loop прекращается на лимите 4 |
| shortlist mutation | требуется UI confirmation |

Отдельно проверяется, что demo/BYOK-ключ не появляется:

- в IPC payload;
- JavaScript bundle;
- application logs;
- error message;
- crash report fixture.

## 8. Release acceptance

На чистых Windows 10 и 11 x64:

- installer устанавливается и удаляется;
- portable ZIP запускается;
- Node, Python, Rust и Docker отсутствуют;
- catalog checksum проходит;
- offline search работает;
- user data переживает restart;
- повреждённый catalog не открывается молча;
- updater отвергает неверную подпись;
- отсутствие сети не вызывает crash;
- SmartScreen limitation описано в release notes.

## 9. Исторические метрики

Показатели ingestion до freeze сохраняются только как provenance. Они не
являются активным gate и не дают разрешения на новые сборы.

Зафиксированные provenance-значения находятся в этом документе,
`MVP_SCOPE.md` и `config/catalog-manifest.json`; отдельный session checkpoint
удалён вместе с legacy-кодом.
