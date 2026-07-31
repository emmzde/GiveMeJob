PRAGMA foreign_keys = ON;

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
