-- GiveMeJob! — целевая документированная схема Windows MVP.
-- Обновлено: 2026-07-31.
--
-- Это два независимых SQLite-файла:
--   1. catalog-v1.sqlite — versioned, read-only после сборки;
--   2. user.sqlite       — локальные пользовательские данные.
--
-- Исходный PostgreSQL volume хранится отдельно от репозитория только как
-- архив frozen dataset. Legacy schema/Alembic в кодовой базе удалены.

PRAGMA foreign_keys = ON;

-- ============================================================================
-- catalog-v1.sqlite
-- ============================================================================

CREATE TABLE catalog_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE jobs (
  id                  INTEGER PRIMARY KEY,
  source_job_id       TEXT NOT NULL,
  title               TEXT NOT NULL,
  title_normalized    TEXT NOT NULL,
  company             TEXT NOT NULL,
  company_normalized  TEXT NOT NULL,
  description_text    TEXT NOT NULL,
  seniority           TEXT,
  employment_type     TEXT,
  remote_mode         TEXT,
  country             TEXT,
  city                TEXT,
  location_text       TEXT NOT NULL DEFAULT '',
  salary_min          REAL,
  salary_max          REAL,
  salary_currency     TEXT,
  salary_period       TEXT,
  salary_usd_year     REAL,
  posted_at           TEXT,
  source              TEXT NOT NULL,
  source_url          TEXT NOT NULL,
  apply_url           TEXT,
  attribution         TEXT NOT NULL,
  skills_text         TEXT NOT NULL DEFAULT '',
  search_aliases      TEXT NOT NULL DEFAULT '',
  snapshot_version    TEXT NOT NULL,

  CHECK (trim(title) <> ''),
  CHECK (trim(company) <> ''),
  CHECK (trim(source) <> ''),
  CHECK (trim(source_url) <> ''),
  CHECK (trim(attribution) <> ''),
  CHECK (remote_mode IS NULL OR remote_mode IN ('remote', 'hybrid', 'onsite')),
  CHECK (
    seniority IS NULL OR seniority IN (
      'intern', 'junior', 'middle', 'senior', 'lead', 'staff', 'principal',
      'manager', 'director', 'executive'
    )
  )
) STRICT;

CREATE UNIQUE INDEX jobs_source_identity_idx
  ON jobs (source, source_job_id);

CREATE UNIQUE INDEX jobs_source_url_idx
  ON jobs (source_url);

CREATE INDEX jobs_posted_at_idx
  ON jobs (posted_at DESC, id);

CREATE INDEX jobs_location_idx
  ON jobs (country, city, remote_mode, id);

CREATE INDEX jobs_seniority_idx
  ON jobs (seniority, id);

CREATE INDEX jobs_salary_idx
  ON jobs (salary_usd_year, id);

CREATE TABLE skills (
  id             INTEGER PRIMARY KEY,
  canonical_name TEXT NOT NULL UNIQUE,
  esco_uri       TEXT UNIQUE,
  aliases_json   TEXT NOT NULL DEFAULT '[]',

  CHECK (trim(canonical_name) <> ''),
  CHECK (json_valid(aliases_json))
) STRICT;

CREATE TABLE job_skills (
  job_id   INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id),
  PRIMARY KEY (job_id, skill_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX job_skills_skill_idx
  ON job_skills (skill_id, job_id);

-- External-content FTS. Catalog immutable: runtime triggers не нужны.
CREATE VIRTUAL TABLE jobs_fts USING fts5(
  title,
  skills_text,
  company,
  location_text,
  description_text,
  search_aliases,
  content = 'jobs',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3 4'
);

-- Выполняется export builder после INSERT в jobs:
--
-- INSERT INTO jobs_fts(
--   rowid,
--   title,
--   skills_text,
--   company,
--   location_text,
--   description_text,
--   search_aliases
-- )
-- SELECT
--   id,
--   title,
--   skills_text,
--   company,
--   location_text,
--   description_text,
--   search_aliases
-- FROM jobs
-- ORDER BY id;
--
-- INSERT INTO jobs_fts(jobs_fts) VALUES ('optimize');
-- ANALYZE;
-- VACUUM;

-- catalog_meta обязательные ключи:
--
-- manifest_version
-- catalog_version
-- schema_version
-- description_format
-- source_frozen_at
-- exported_at
-- canonical_jobs
-- jobs_with_skills
-- jobs_with_salary
-- source_commit_sha
-- logical_checksum
--
-- published_at относится к release manifest, а не к SQLite: на момент сборки
-- catalog базы artifact ещё не опубликован.

-- ============================================================================
-- user.sqlite
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE user_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE profile (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  preferred_roles_json  TEXT NOT NULL DEFAULT '[]',
  seniority             TEXT,
  skills_json           TEXT NOT NULL DEFAULT '[]',
  country               TEXT,
  city                  TEXT,
  remote_modes_json     TEXT NOT NULL DEFAULT '[]',
  salary_min_usd_year   REAL,
  version               INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,

  CHECK (json_valid(preferred_roles_json)),
  CHECK (json_valid(skills_json)),
  CHECK (json_valid(remote_modes_json)),
  CHECK (
    seniority IS NULL OR seniority IN (
      'intern', 'junior', 'middle', 'senior', 'lead', 'staff', 'principal',
      'manager', 'director', 'executive'
    )
  )
) STRICT;

CREATE TABLE shortlist (
  job_id            INTEGER PRIMARY KEY,
  catalog_version   TEXT NOT NULL,
  saved_at          TEXT NOT NULL
) STRICT;

CREATE TABLE recent_searches (
  id          INTEGER PRIMARY KEY,
  query_json  TEXT NOT NULL,
  searched_at TEXT NOT NULL,

  CHECK (json_valid(query_json))
) STRICT;

CREATE INDEX recent_searches_time_idx
  ON recent_searches (searched_at DESC);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  CHECK (json_valid(value_json))
) STRICT;

CREATE TABLE conversations (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE chat_messages (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL
                     REFERENCES conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL,
  content_json     TEXT NOT NULL,
  created_at       TEXT NOT NULL,

  CHECK (role IN ('user', 'assistant', 'tool')),
  CHECK (json_valid(content_json))
) STRICT;

CREATE INDEX chat_messages_conversation_idx
  ON chat_messages (conversation_id, created_at);

CREATE TABLE provider_health (
  provider          TEXT NOT NULL,
  model             TEXT NOT NULL,
  ewma_latency_ms   REAL,
  success_count     INTEGER NOT NULL DEFAULT 0,
  error_count       INTEGER NOT NULL DEFAULT 0,
  last_status       TEXT,
  cooldown_until    TEXT,
  quota_window_json TEXT NOT NULL DEFAULT '{}',
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (provider, model),

  CHECK (json_valid(quota_window_json))
) STRICT, WITHOUT ROWID;

CREATE TABLE match_cache (
  job_id           INTEGER NOT NULL,
  profile_version  INTEGER NOT NULL,
  catalog_version  TEXT NOT NULL,
  score            REAL NOT NULL,
  breakdown_json   TEXT NOT NULL,
  computed_at      TEXT NOT NULL,
  PRIMARY KEY (job_id, profile_version, catalog_version),

  CHECK (score >= 0 AND score <= 100),
  CHECK (json_valid(breakdown_json))
) STRICT, WITHOUT ROWID;

-- BYOK здесь не хранится. Только Windows Credential Manager.
