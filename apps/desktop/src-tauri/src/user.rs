use std::{collections::HashSet, fs, path::PathBuf, time::Duration};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{App, Manager};
use unicode_normalization::UnicodeNormalization;

use crate::{
    ipc::IpcError,
    search::dto::{JobId, RemoteMode, Seniority},
};

const MAX_LIST_ITEM_LENGTH: usize = 100;
const MAX_PROFILE_ROLES: usize = 5;
const MAX_PROFILE_SKILLS: usize = 50;
const MAX_SALARY_USD_YEAR: f64 = 10_000_000.0;
const USER_SCHEMA_VERSION: &str = "1";

const USER_SCHEMA: &str = r#"
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS user_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS profile (
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
  CHECK (salary_min_usd_year IS NULL OR salary_min_usd_year BETWEEN 0 AND 10000000),
  CHECK (version > 0),
  CHECK (
    seniority IS NULL OR seniority IN (
      'intern', 'junior', 'middle', 'senior', 'lead', 'staff', 'principal',
      'manager', 'director', 'executive'
    )
  )
) STRICT;

CREATE TABLE IF NOT EXISTS shortlist (
  job_id            INTEGER PRIMARY KEY,
  catalog_version   TEXT NOT NULL,
  saved_at          TEXT NOT NULL,
  CHECK (job_id > 0),
  CHECK (trim(catalog_version) <> '')
) STRICT;

CREATE TABLE IF NOT EXISTS recent_searches (
  id          INTEGER PRIMARY KEY,
  query_json  TEXT NOT NULL,
  searched_at TEXT NOT NULL,
  CHECK (json_valid(query_json))
) STRICT;

CREATE INDEX IF NOT EXISTS recent_searches_time_idx
  ON recent_searches (searched_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (json_valid(value_json))
) STRICT;

CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS chat_messages (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL
                   REFERENCES conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL,
  content_json     TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  CHECK (role IN ('user', 'assistant', 'tool')),
  CHECK (json_valid(content_json))
) STRICT;

CREATE INDEX IF NOT EXISTS chat_messages_conversation_idx
  ON chat_messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS provider_health (
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

CREATE TABLE IF NOT EXISTS match_cache (
  job_id           INTEGER NOT NULL,
  profile_version  INTEGER NOT NULL,
  catalog_version  TEXT NOT NULL,
  score            REAL NOT NULL,
  breakdown_json   TEXT NOT NULL,
  computed_at      TEXT NOT NULL,
  PRIMARY KEY (job_id, profile_version, catalog_version),
  CHECK (job_id > 0),
  CHECK (profile_version > 0),
  CHECK (score >= 0 AND score <= 100),
  CHECK (json_valid(breakdown_json))
) STRICT, WITHOUT ROWID;

INSERT INTO user_meta(key, value)
VALUES ('schema_version', '1')
ON CONFLICT(key) DO NOTHING;
"#;

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ProfileInput {
    pub(crate) preferred_roles: Vec<String>,
    pub(crate) seniority: Option<Seniority>,
    pub(crate) skills: Vec<String>,
    pub(crate) country: Option<String>,
    pub(crate) city: Option<String>,
    pub(crate) remote_modes: Vec<RemoteMode>,
    pub(crate) salary_min_usd_year: Option<f64>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct UserProfile {
    pub(crate) preferred_roles: Vec<String>,
    pub(crate) seniority: Option<Seniority>,
    pub(crate) skills: Vec<String>,
    pub(crate) country: Option<String>,
    pub(crate) city: Option<String>,
    pub(crate) remote_modes: Vec<RemoteMode>,
    pub(crate) salary_min_usd_year: Option<f64>,
    pub(crate) version: u64,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SetShortlistInput {
    pub(crate) job_id: JobId,
    pub(crate) saved: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ShortlistRecord {
    pub(crate) job_id: JobId,
    pub(crate) catalog_version: String,
    pub(crate) saved_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ShortlistState {
    pub(crate) job_id: JobId,
    pub(crate) saved: bool,
    pub(crate) catalog_version: String,
    pub(crate) saved_at: Option<String>,
}

impl ProfileInput {
    pub(crate) fn validate_and_normalize(self) -> Result<Self, IpcError> {
        if self.preferred_roles.len() > MAX_PROFILE_ROLES
            || self.skills.len() > MAX_PROFILE_SKILLS
            || self.remote_modes.len() > RemoteMode::ALL.len()
            || self.salary_min_usd_year.is_some_and(|salary| {
                !salary.is_finite() || !(0.0..=MAX_SALARY_USD_YEAR).contains(&salary)
            })
        {
            return Err(IpcError::InvalidQuery);
        }

        let preferred_roles = normalize_list(self.preferred_roles)?;
        let skills = normalize_list(self.skills)?;
        let country = normalize_optional(self.country)?;
        let city = normalize_optional(self.city)?;
        let mut remote_modes_seen = HashSet::new();
        if self
            .remote_modes
            .iter()
            .any(|mode| !remote_modes_seen.insert(mode.as_str()))
        {
            return Err(IpcError::InvalidQuery);
        }

        Ok(Self {
            preferred_roles,
            seniority: self.seniority,
            skills,
            country,
            city,
            remote_modes: self.remote_modes,
            salary_min_usd_year: self.salary_min_usd_year,
        })
    }
}

#[derive(Clone)]
pub(crate) struct UserStore {
    path: Option<PathBuf>,
}

impl UserStore {
    pub(crate) fn from_app(app: &App) -> Self {
        #[cfg(any(debug_assertions, test))]
        if let Some(configured) = std::env::var_os("GIVEMEJOB_USER_DATA_PATH") {
            return Self {
                path: Some(PathBuf::from(configured)),
            };
        }
        let path = app
            .path()
            .local_data_dir()
            .ok()
            .map(|root| root.join("GiveMeJob!").join("data").join("user.sqlite"));
        Self { path }
    }

    #[cfg(test)]
    fn for_test(path: PathBuf) -> Self {
        Self { path: Some(path) }
    }

    pub(crate) fn get_profile(&self) -> Result<Option<UserProfile>, IpcError> {
        let connection = self.open()?;
        load_profile(&connection)
    }

    pub(crate) fn save_profile(&self, input: ProfileInput) -> Result<UserProfile, IpcError> {
        let input = input.validate_and_normalize()?;
        let connection = self.open()?;
        let preferred_roles = serde_json::to_string(&input.preferred_roles)
            .map_err(|_| IpcError::UserDataUnavailable)?;
        let skills =
            serde_json::to_string(&input.skills).map_err(|_| IpcError::UserDataUnavailable)?;
        let remote_modes = serde_json::to_string(&input.remote_modes)
            .map_err(|_| IpcError::UserDataUnavailable)?;
        connection
            .execute(
                r#"
                INSERT INTO profile (
                  id, preferred_roles_json, seniority, skills_json, country, city,
                  remote_modes_json, salary_min_usd_year, version, created_at, updated_at
                )
                VALUES (
                  1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, 1,
                  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                )
                ON CONFLICT(id) DO UPDATE SET
                  preferred_roles_json = excluded.preferred_roles_json,
                  seniority = excluded.seniority,
                  skills_json = excluded.skills_json,
                  country = excluded.country,
                  city = excluded.city,
                  remote_modes_json = excluded.remote_modes_json,
                  salary_min_usd_year = excluded.salary_min_usd_year,
                  version = profile.version + 1,
                  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                "#,
                params![
                    preferred_roles,
                    input.seniority.map(Seniority::as_str),
                    skills,
                    input.country,
                    input.city,
                    remote_modes,
                    input.salary_min_usd_year,
                ],
            )
            .map_err(|_| IpcError::UserDataUnavailable)?;
        load_profile(&connection)?.ok_or(IpcError::UserDataUnavailable)
    }

    pub(crate) fn list_shortlist(&self) -> Result<Vec<ShortlistRecord>, IpcError> {
        let connection = self.open()?;
        let mut statement = connection
            .prepare(
                "SELECT job_id, catalog_version, saved_at
                 FROM shortlist
                 ORDER BY saved_at DESC, job_id",
            )
            .map_err(|_| IpcError::UserDataUnavailable)?;
        let records = statement
            .query_map([], |row| {
                let raw_id = row.get(0)?;
                Ok((raw_id, row.get(1)?, row.get(2)?))
            })
            .map_err(|_| IpcError::UserDataUnavailable)?
            .map(|row| {
                let (raw_id, catalog_version, saved_at): (i64, String, String) =
                    row.map_err(|_| IpcError::UserDataUnavailable)?;
                Ok(ShortlistRecord {
                    job_id: JobId::from_i64(raw_id).map_err(|_| IpcError::UserDataUnavailable)?,
                    catalog_version,
                    saved_at,
                })
            })
            .collect();
        records
    }

    pub(crate) fn is_shortlisted(
        &self,
        job_id: &JobId,
        catalog_version: &str,
    ) -> Result<bool, IpcError> {
        let connection = self.open()?;
        let id = job_id.as_i64()?;
        connection
            .query_row(
                "SELECT EXISTS(
                   SELECT 1 FROM shortlist
                   WHERE job_id = ?1 AND catalog_version = ?2
                 )",
                params![id, catalog_version],
                |row| row.get(0),
            )
            .map_err(|_| IpcError::UserDataUnavailable)
    }

    pub(crate) fn set_shortlist(
        &self,
        input: SetShortlistInput,
        catalog_version: &str,
    ) -> Result<ShortlistState, IpcError> {
        if catalog_version.trim().is_empty() || catalog_version.chars().count() > 100 {
            return Err(IpcError::UserDataUnavailable);
        }
        let connection = self.open()?;
        let id = input.job_id.as_i64()?;
        if input.saved {
            connection
                .execute(
                    "INSERT INTO shortlist (job_id, catalog_version, saved_at)
                     VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                     ON CONFLICT(job_id) DO UPDATE SET
                       catalog_version = excluded.catalog_version,
                       saved_at = excluded.saved_at",
                    params![id, catalog_version],
                )
                .map_err(|_| IpcError::UserDataUnavailable)?;
            let saved_at = connection
                .query_row(
                    "SELECT saved_at FROM shortlist WHERE job_id = ?1",
                    params![id],
                    |row| row.get(0),
                )
                .map_err(|_| IpcError::UserDataUnavailable)?;
            Ok(ShortlistState {
                job_id: input.job_id,
                saved: true,
                catalog_version: catalog_version.to_owned(),
                saved_at: Some(saved_at),
            })
        } else {
            connection
                .execute("DELETE FROM shortlist WHERE job_id = ?1", params![id])
                .map_err(|_| IpcError::UserDataUnavailable)?;
            Ok(ShortlistState {
                job_id: input.job_id,
                saved: false,
                catalog_version: catalog_version.to_owned(),
                saved_at: None,
            })
        }
    }

    fn open(&self) -> Result<Connection, IpcError> {
        let path = self.path.as_ref().ok_or(IpcError::UserDataUnavailable)?;
        let parent = path.parent().ok_or(IpcError::UserDataUnavailable)?;
        fs::create_dir_all(parent).map_err(|_| IpcError::UserDataUnavailable)?;
        let connection = Connection::open(path).map_err(|_| IpcError::UserDataUnavailable)?;
        connection
            .busy_timeout(Duration::from_secs(2))
            .map_err(|_| IpcError::UserDataUnavailable)?;
        connection
            .execute_batch(USER_SCHEMA)
            .map_err(|_| IpcError::UserDataUnavailable)?;
        let schema_version: String = connection
            .query_row(
                "SELECT value FROM user_meta WHERE key = 'schema_version'",
                [],
                |row| row.get(0),
            )
            .map_err(|_| IpcError::UserDataUnavailable)?;
        if schema_version != USER_SCHEMA_VERSION {
            return Err(IpcError::UserDataUnavailable);
        }
        Ok(connection)
    }
}

struct StoredProfile {
    preferred_roles_json: String,
    seniority: Option<String>,
    skills_json: String,
    country: Option<String>,
    city: Option<String>,
    remote_modes_json: String,
    salary_min_usd_year: Option<f64>,
    version: i64,
    created_at: String,
    updated_at: String,
}

fn load_profile(connection: &Connection) -> Result<Option<UserProfile>, IpcError> {
    let stored = connection
        .query_row(
            r#"
            SELECT preferred_roles_json, seniority, skills_json, country, city,
                   remote_modes_json, salary_min_usd_year, version, created_at, updated_at
            FROM profile
            WHERE id = 1
            "#,
            [],
            |row| {
                Ok(StoredProfile {
                    preferred_roles_json: row.get(0)?,
                    seniority: row.get(1)?,
                    skills_json: row.get(2)?,
                    country: row.get(3)?,
                    city: row.get(4)?,
                    remote_modes_json: row.get(5)?,
                    salary_min_usd_year: row.get(6)?,
                    version: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            },
        )
        .optional()
        .map_err(|_| IpcError::UserDataUnavailable)?;

    stored.map(decode_profile).transpose()
}

fn decode_profile(stored: StoredProfile) -> Result<UserProfile, IpcError> {
    let preferred_roles = serde_json::from_str(&stored.preferred_roles_json)
        .map_err(|_| IpcError::UserDataUnavailable)?;
    let skills =
        serde_json::from_str(&stored.skills_json).map_err(|_| IpcError::UserDataUnavailable)?;
    let remote_modes = serde_json::from_str(&stored.remote_modes_json)
        .map_err(|_| IpcError::UserDataUnavailable)?;
    let seniority = stored
        .seniority
        .map(|value| serde_json::from_value(serde_json::Value::String(value)))
        .transpose()
        .map_err(|_| IpcError::UserDataUnavailable)?;
    Ok(UserProfile {
        preferred_roles,
        seniority,
        skills,
        country: stored.country,
        city: stored.city,
        remote_modes,
        salary_min_usd_year: stored.salary_min_usd_year,
        version: u64::try_from(stored.version).map_err(|_| IpcError::UserDataUnavailable)?,
        created_at: stored.created_at,
        updated_at: stored.updated_at,
    })
}

fn normalize_list(values: Vec<String>) -> Result<Vec<String>, IpcError> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::with_capacity(values.len());
    for value in values {
        let value = normalize_required(value)?;
        if !seen.insert(value.to_lowercase()) {
            return Err(IpcError::InvalidQuery);
        }
        normalized.push(value);
    }
    Ok(normalized)
}

fn normalize_optional(value: Option<String>) -> Result<Option<String>, IpcError> {
    value
        .map(|value| {
            let normalized = value.nfkc().collect::<String>().trim().to_owned();
            if normalized.is_empty() {
                Ok(None)
            } else if normalized.chars().count() > MAX_LIST_ITEM_LENGTH {
                Err(IpcError::InvalidQuery)
            } else {
                Ok(Some(normalized))
            }
        })
        .transpose()
        .map(Option::flatten)
}

fn normalize_required(value: String) -> Result<String, IpcError> {
    let normalized = value.nfkc().collect::<String>().trim().to_owned();
    if normalized.is_empty() || normalized.chars().count() > MAX_LIST_ITEM_LENGTH {
        return Err(IpcError::InvalidQuery);
    }
    Ok(normalized)
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::{ProfileInput, SetShortlistInput, UserStore};
    use crate::{
        ipc::IpcError,
        search::dto::{JobId, RemoteMode, Seniority},
    };

    fn input() -> ProfileInput {
        ProfileInput {
            preferred_roles: vec!["  Rust Engineer  ".to_owned()],
            seniority: Some(Seniority::Senior),
            skills: vec!["Rust".to_owned(), "SQLite".to_owned()],
            country: Some("  Azerbaijan ".to_owned()),
            city: Some(" Baku ".to_owned()),
            remote_modes: vec![RemoteMode::Remote, RemoteMode::Hybrid],
            salary_min_usd_year: Some(100_000.0),
        }
    }

    #[test]
    fn profile_round_trip_persists_and_increments_version() {
        let directory = tempdir().expect("temporary directory should exist");
        let path = directory.path().join("user.sqlite");
        let store = UserStore::for_test(path.clone());

        assert_eq!(
            store.get_profile().expect("empty database should open"),
            None
        );
        let first = store.save_profile(input()).expect("profile should save");
        assert_eq!(first.version, 1);
        assert_eq!(first.preferred_roles, vec!["Rust Engineer"]);
        assert_eq!(first.country.as_deref(), Some("Azerbaijan"));

        let reopened = UserStore::for_test(path);
        assert_eq!(
            reopened.get_profile().expect("profile should reload"),
            Some(first.clone())
        );
        let second = reopened
            .save_profile(input())
            .expect("profile should update");
        assert_eq!(second.version, 2);
        assert_eq!(second.created_at, first.created_at);
    }

    #[test]
    fn invalid_or_duplicate_values_are_rejected() {
        let directory = tempdir().expect("temporary directory should exist");
        let store = UserStore::for_test(directory.path().join("user.sqlite"));
        let mut duplicate = input();
        duplicate.skills = vec!["Rust".to_owned(), " rust ".to_owned()];
        assert_eq!(store.save_profile(duplicate), Err(IpcError::InvalidQuery));

        let mut excessive_salary = input();
        excessive_salary.salary_min_usd_year = Some(10_000_001.0);
        assert_eq!(
            store.save_profile(excessive_salary),
            Err(IpcError::InvalidQuery)
        );
    }

    #[test]
    fn shortlist_round_trip_survives_reopen_and_tracks_catalog_version() {
        let directory = tempdir().expect("temporary directory should exist");
        let path = directory.path().join("user.sqlite");
        let store = UserStore::for_test(path.clone());
        let job_id = JobId::parse("42").expect("fixture job ID should be valid");

        assert!(!store
            .is_shortlisted(&job_id, "1")
            .expect("empty shortlist should open"));
        let saved = store
            .set_shortlist(
                SetShortlistInput {
                    job_id: job_id.clone(),
                    saved: true,
                },
                "1",
            )
            .expect("shortlist item should save");
        assert!(saved.saved);
        assert!(saved.saved_at.is_some());

        let reopened = UserStore::for_test(path);
        assert!(reopened
            .is_shortlisted(&job_id, "1")
            .expect("shortlist item should reload"));
        assert!(!reopened
            .is_shortlisted(&job_id, "2")
            .expect("catalog version should be part of shortlist identity"));
        assert_eq!(
            reopened
                .list_shortlist()
                .expect("shortlist should list")
                .len(),
            1
        );

        let removed = reopened
            .set_shortlist(
                SetShortlistInput {
                    job_id,
                    saved: false,
                },
                "1",
            )
            .expect("shortlist item should remove");
        assert!(!removed.saved);
        assert!(reopened
            .list_shortlist()
            .expect("shortlist should remain readable")
            .is_empty());
    }

    #[test]
    fn schema_version_one_initializes_the_complete_public_user_schema() {
        let directory = tempdir().expect("temporary directory should exist");
        let path = directory.path().join("user.sqlite");
        let store = UserStore::for_test(path.clone());
        store.get_profile().expect("schema should initialize");
        let connection = rusqlite::Connection::open(path).expect("database should reopen");
        let mut statement = connection
            .prepare(
                "SELECT name FROM sqlite_schema
                 WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
                 ORDER BY name",
            )
            .expect("schema query should prepare");
        let tables = statement
            .query_map([], |row| row.get::<_, String>(0))
            .expect("schema query should run")
            .collect::<Result<Vec<_>, _>>()
            .expect("schema rows should decode");
        assert_eq!(
            tables,
            vec![
                "chat_messages",
                "conversations",
                "match_cache",
                "profile",
                "provider_health",
                "recent_searches",
                "settings",
                "shortlist",
                "user_meta",
            ]
        );
    }

    #[test]
    fn unknown_schema_version_fails_closed() {
        let directory = tempdir().expect("temporary directory should exist");
        let path = directory.path().join("user.sqlite");
        let store = UserStore::for_test(path.clone());
        store.get_profile().expect("schema should initialize");
        let connection = rusqlite::Connection::open(path).expect("database should reopen");
        connection
            .execute(
                "UPDATE user_meta SET value = '999' WHERE key = 'schema_version'",
                [],
            )
            .expect("fixture should update");
        assert_eq!(store.get_profile(), Err(IpcError::UserDataUnavailable));
    }
}
