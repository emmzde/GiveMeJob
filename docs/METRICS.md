# Метрики качества данных фазы 1

Дата фиксации определений: 29 июля 2026 года.

Эти определения конкретизируют критерий выхода `docs/PLAN.md` §9. Метрики
покрытия, свежести, дублей и embeddings считаются только по каноническим
вакансиям. Сырые строки источников в знаменатель не входят.

## 1. Каноническая и активная вакансия

Одна `job_group` представляет одну вакансию, а `job_groups.canonical_job`
указывает на единственную строку, которую получает UI. Репозиторий выбирает
каноническую строку детерминированно: активная выше архивной, затем выше
`quality_score`, свежее `posted_at`, затем меньший `id`.

Базовый CTE для метрик и UI:

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

Запрос целостности канонических ссылок должен всегда возвращать нули:

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

## 2. Единый acceptance-запрос

`salary_coverage` означает пригодную для сравнения годовую зарплату в USD, а
не просто встретившееся число или код валюты.

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
  JOIN fingerprint_clusters
    USING (blocking_key, simhash)

  UNION

  SELECT canonical.id
  FROM canonical_jobs AS canonical
  JOIN source_url_clusters
    USING (source_url)
),
metrics AS (
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
      WHERE embedding IS NOT NULL
        AND vector_dims(embedding) = 1024
    ) AS with_embeddings,
    percentile_cont(0.5) WITHIN GROUP (
      ORDER BY
        extract(
          epoch FROM (now() - coalesce(posted_at, first_seen_at))
        ) / 86400.0
    ) AS median_age_days
  FROM canonical_jobs
)
SELECT
  canonical_jobs,
  with_skills,
  round(100.0 * with_skills / nullif(canonical_jobs, 0), 2)
    AS skills_coverage_pct,
  with_salary,
  round(100.0 * with_salary / nullif(canonical_jobs, 0), 2)
    AS salary_coverage_pct,
  with_embeddings,
  round(100.0 * with_embeddings / nullif(canonical_jobs, 0), 2)
    AS embedding_coverage_pct,
  round(median_age_days::numeric, 2) AS median_age_days,
  (SELECT count(*) FROM residual_duplicate_ids) AS residual_duplicate_jobs,
  round(
    100.0 * (SELECT count(*) FROM residual_duplicate_ids)
      / nullif(canonical_jobs, 0),
    2
  ) AS residual_duplicate_pct
FROM metrics;
```

Критерии фазы 1: `canonical_jobs >= 50000`,
`skills_coverage_pct >= 60`, `salary_coverage_pct >= 35`,
`median_age_days < 5`, `residual_duplicate_pct < 3`,
`embedding_coverage_pct = 100`.

## 3. Residual-дубли

Residual-дубль — каноническая запись, для которой осталась другая каноническая
запись с одним из двух строгих подтверждений:

1. одинаковые `blocking_key` и `simhash`;
2. абсолютно одинаковый `source_url`.

Обе записи дублирующей пары входят в числитель. Query string из URL намеренно
не удаляется: некоторые ATS используют один path и передают уникальный job id
только в query string. Это строгая детерминированная нижняя граница; дополнительно
каждый релиз фазы 1 требует ручного просмотра 30 крупнейших многозаписных групп.

SQL ручного аудита:

```sql
SELECT
  job_group.id AS group_id,
  min(company.name) AS company,
  count(*) AS members,
  string_agg(DISTINCT job.title, ' | ' ORDER BY job.title) AS titles
FROM job_groups AS job_group
JOIN jobs AS job
  ON job.group_id = job_group.id
JOIN companies AS company
  ON company.id = job.company_id
GROUP BY job_group.id
HAVING count(*) >= 2
  AND count(DISTINCT company.id) = 1
ORDER BY count(*) DESC, job_group.id
LIMIT 30;
```

### Аудит до исправления порога

При пороге Хэмминга 3 было 971 многозаписных групп; 89 из них содержали разные
`title_normalized` (260 строк). Выборка 30 крупнейших групп:

| group | company | members | titles |
|---:|---|---:|---|
| 5255 | Apex Companies | 28 | Landscape Technician (Stormwater) |
| 5254 | Apex Companies | 15 | Landscape Foreman (Stormwater) |
| 2587 | Alpha Financial Markets Consulting | 12 | Manager |
| 8620 | Cgsfederal | 11 | Affirmative Civil Enforcement (ACE) Investigator |
| 8632 | Cgsfederal | 11 | Auditor |
| 8658 | Cgsfederal | 11 | Data Specialist |
| 4266 | Anduril Industries | 10 | Senior Reliability Engineer · Senior Software Engineer |
| 6500 | AvePoint | 10 | Partner Development Manager |
| 8621 | Cgsfederal | 10 | Agile Coach |
| 8625 | Cgsfederal | 10 | ALS Lab Manager |
| 8630 | Cgsfederal | 10 | APEX Developer (Top Secret Clearance Required) |
| 8634 | Cgsfederal | 10 | Business Analyst |
| 8643 | Cgsfederal | 10 | Cloud and Storage Engineer |
| 8644 | Cgsfederal | 10 | Cloud Engineer (AWS) |
| 8645 | Cgsfederal | 10 | Cloud Systems Architect |
| 8646 | Cgsfederal | 10 | CommVault Systems Engineer |
| 8648 | Cgsfederal | 10 | Contract Mandarin Document Review Attorney |
| 8650 | Cgsfederal | 10 | Contracts Manager |
| 8652 | Cgsfederal | 10 | Courtroom Presentation Specialist |
| 8657 | Cgsfederal | 10 | Data Engineer |
| 8659 | Cgsfederal | 10 | Desktop/Workstation Design Engineer |
| 8660 | Cgsfederal | 10 | Digital Forensic Analyst I |
| 8661 | Cgsfederal | 10 | Director of eDiscovery |
| 8662 | Cgsfederal | 10 | Discovery Business and System Analyst (Top Secret Clearance Required) |
| 8663 | Cgsfederal | 10 | Discovery Database Administrator (DBA) (Top Secret Clearance Required) |
| 8664 | Cgsfederal | 10 | Discovery IT System Administrator (Top Secret Clearance Required) |
| 2597 | Alpha Financial Markets Consulting | 9 | Senior Consultant |
| 3946 | Anduril Industries | 9 | Senior Cloud Deployment Engineer, Space · Senior Electrical Engineer · Senior GNC Engineer · Senior Procurement Engineer |
| 4223 | Anduril Industries | 9 | Senior Product Quality Engineer |
| 4123 | Anduril Industries | 8 | Senior Manufacturing Engineer · Senior Production Engineer · Senior Thermal Engineer |

Разные вакансии действительно склеивались. Порог уменьшен до 0. Дополнительно
устранена причина точных SimHash-коллизий: `blocking_key` теперь включает
нормализованные company, title и location, как требует `PLAN.md` §2.4, а
SimHash считается по описанию внутри блока. После перестройки 10 468 строк:
10 363 группы, 95 многозаписных групп, групп с разными
`title_normalized` — 0.

## 4. Свежесть и first_seen_at

Свежесть — медиана
`now() - coalesce(posted_at, first_seen_at)` по активным каноническим
вакансиям. `first_seen_at` устанавливается default-значением только при первом
INSERT. Batch upsert намеренно не включает его в `DO UPDATE SET`.

Проверка целостности:

```sql
SELECT
  count(*) FILTER (WHERE first_seen_at IS NULL) AS missing_first_seen,
  count(*) FILTER (WHERE first_seen_at > last_seen_at) AS invalid_seen_order
FROM jobs;
```

Повторный bulk upsert и неизменность `first_seen_at` покрыты integration-тестом
`tests/ingest/test_repository_integration.py`.

## 5. Текущий снимок

Снимок после перестройки дедупликации 29 июля 2026 года:

| Метрика | Значение |
|---|---:|
| Канонические активные вакансии | 10 363 |
| Со skills | 9 198 / 88,76% |
| С пригодной `salary_usd_year` | 0 / 0,00% |
| С `VECTOR(1024)` | 1 / 0,01% |
| Медианная свежесть | 61,20 дня |
| Residual-дубли | 0 / 0,00% |

Диагностически 934 канонические записи (9,01%) содержат хотя бы одну сырую
границу зарплаты, но у всех периодичность пока `unknown`, поэтому они честно не
засчитываются в usable salary coverage.
