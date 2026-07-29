-- GiveMeJob! — схема БД (PostgreSQL 17 + pgvector)
-- Профиль пользователя может жить локально в SQLite с той же логической схемой.

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Ядро: компании и вакансии
-- ============================================================

CREATE TABLE companies (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE,
  website       TEXT,
  logo_url      TEXT,
  size_bucket   TEXT,          -- startup / smb / enterprise
  industry      TEXT
);

CREATE TABLE job_groups (      -- дедуплицированная сущность "одна вакансия"
  id            BIGSERIAL PRIMARY KEY,
  canonical_job BIGINT,
  simhash       BIGINT,
  blocking_key  TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE jobs (
  id               BIGSERIAL PRIMARY KEY,
  group_id         BIGINT REFERENCES job_groups(id),
  company_id       BIGINT REFERENCES companies(id),
  title            TEXT NOT NULL,
  title_normalized TEXT,
  description_md   TEXT,
  seniority        TEXT,        -- intern/junior/middle/senior/lead/staff/principal
  employment_type  TEXT,        -- full_time/part_time/contract/internship
  remote_type      TEXT,        -- onsite/hybrid/remote
  country          TEXT,
  city             TEXT,
  timezone_hint    TEXT,
  salary_min       NUMERIC,
  salary_max       NUMERIC,
  salary_currency  TEXT,
  salary_period    TEXT,
  salary_usd_year  NUMERIC,     -- нормализовано для сравнения
  visa_sponsorship BOOLEAN,
  min_years_exp    SMALLINT,
  posted_at        TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  source           TEXT NOT NULL,
  source_scope     TEXT NOT NULL,
  source_job_id    TEXT NOT NULL,
  source_url       TEXT NOT NULL,
  apply_url        TEXT,
  attribution      TEXT NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ingested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  quality_score    REAL,        -- полнота полей, наличие зарплаты, прямой ATS-источник
  raw              JSONB,
  embedding        VECTOR(1024),
  fts              TSVECTOR GENERATED ALWAYS AS (
                     to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description_md,''))
                   ) STORED
);

CREATE INDEX ON jobs USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON jobs USING gin  (fts);
CREATE INDEX ON jobs (posted_at DESC);
CREATE UNIQUE INDEX ON jobs (source, source_job_id);
CREATE INDEX ON jobs (is_active, posted_at DESC);

-- ============================================================
-- Таксономия навыков (ESCO / O*NET + свои алиасы)
-- ============================================================

CREATE TABLE skills (
  id       BIGSERIAL PRIMARY KEY,
  name     TEXT UNIQUE,
  aliases  TEXT[],
  category TEXT,
  esco_uri TEXT UNIQUE
);

CREATE TABLE job_skills (
  job_id      BIGINT REFERENCES jobs(id) ON DELETE CASCADE,
  skill_id    BIGINT REFERENCES skills(id),
  requirement TEXT,             -- must_have / nice_to_have
  PRIMARY KEY (job_id, skill_id)
);

-- ============================================================
-- Пользователь
-- ============================================================

CREATE TABLE profiles (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT,
  version        INT,           -- ключ инвалидации кэша оценок
  years_total    REAL,
  seniority      TEXT,
  countries_ok   TEXT[],
  work_auth      JSONB,
  languages      JSONB,
  preferences    JSONB,         -- зарплата, remote, домены, no-go
  resume_md      TEXT,
  embedding      VECTOR(1024)
);

CREATE TABLE profile_skills (
  profile_id BIGINT,
  skill_id   BIGINT,
  years      REAL,
  level      SMALLINT,          -- 1..5
  evidence   TEXT,              -- где применял
  PRIMARY KEY (profile_id, skill_id)
);

-- ============================================================
-- Оценки и калибровка
-- ============================================================

CREATE TABLE match_scores (
  profile_id      BIGINT,
  job_id          BIGINT,
  profile_version INT,
  fit_score       REAL,
  probability     REAL,
  prob_low        REAL,
  prob_high       REAL,
  components      JSONB,
  llm_adjustment  REAL,
  explanation     JSONB,
  model_used      TEXT,
  computed_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (profile_id, job_id, profile_version)
);

CREATE TABLE applications (     -- источник истины для калибровки
  id                    BIGSERIAL PRIMARY KEY,
  profile_id            BIGINT,
  job_id                BIGINT,
  status                TEXT,   -- saved/applied/viewed/screen/interview/offer/rejected/ghosted
  predicted_probability REAL,   -- что мы предсказали в момент отправки
  timeline              JSONB,
  updated_at            TIMESTAMPTZ
);
