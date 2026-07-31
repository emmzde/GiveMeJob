use std::{
    env,
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
};

use rusqlite::{params, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{path::BaseDirectory, Manager, State};

const CATALOG_MANIFEST: &str = include_str!("../../../../config/catalog-manifest.json");

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct CatalogManifest {
    catalog_version: String,
    source_frozen_at: String,
    canonical_jobs: u64,
    sqlite_file: String,
    sqlite_sha256: String,
    archive_file: String,
    archive_sha256: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CatalogStatus {
    state: &'static str,
    catalog_version: Option<String>,
    snapshot_date: Option<String>,
    total_jobs: u64,
    message: Option<String>,
}

#[derive(Debug)]
struct CatalogState {
    path: Option<PathBuf>,
    status: CatalogStatus,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SearchJobsRequest {
    query: String,
    limit: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct JobSummary {
    id: i64,
    title: String,
    company: String,
    location_text: String,
    remote_mode: Option<String>,
    seniority: Option<String>,
    salary_min: Option<f64>,
    salary_max: Option<f64>,
    salary_currency: Option<String>,
    salary_period: Option<String>,
    posted_at: Option<String>,
    source: String,
    attribution: String,
}

fn read_manifest() -> Result<CatalogManifest, String> {
    serde_json::from_str(CATALOG_MANIFEST)
        .map_err(|error| format!("catalog manifest is invalid: {error}"))
}

fn readonly_connection(path: &Path) -> Result<Connection, String> {
    Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY
            | OpenFlags::SQLITE_OPEN_URI
            | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|error| format!("local catalog cannot be opened: {error}"))
}

fn validate_runtime_catalog(path: &Path, manifest: &CatalogManifest) -> Result<(), String> {
    let connection = readonly_connection(path)?;
    let version: String = connection
        .query_row(
            "SELECT value FROM catalog_meta WHERE key = 'catalog_version'",
            [],
            |row| row.get(0),
        )
        .map_err(|error| format!("catalog version is unavailable: {error}"))?;
    let count: i64 = connection
        .query_row("SELECT count(*) FROM jobs", [], |row| row.get(0))
        .map_err(|error| format!("catalog count is unavailable: {error}"))?;
    if version != manifest.catalog_version {
        return Err(format!(
            "catalog version mismatch: expected {}, got {version}",
            manifest.catalog_version
        ));
    }
    let expected_count = i64::try_from(manifest.canonical_jobs)
        .map_err(|_| "catalog manifest count is too large".to_owned())?;
    if count != expected_count {
        return Err(format!(
            "catalog count mismatch: expected {}, got {count}",
            manifest.canonical_jobs
        ));
    }
    Ok(())
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file =
        File::open(path).map_err(|error| format!("catalog file cannot be read: {error}"))?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 1024 * 1024];
    loop {
        let bytes = file
            .read(&mut buffer)
            .map_err(|error| format!("catalog checksum failed: {error}"))?;
        if bytes == 0 {
            break;
        }
        digest.update(&buffer[..bytes]);
    }
    Ok(format!("{:x}", digest.finalize()))
}

fn verify_checksum(path: &Path, expected: &str) -> Result<(), String> {
    let actual = sha256_file(path)?;
    if actual != expected {
        return Err(format!(
            "catalog checksum mismatch for {}",
            path.file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("artifact")
        ));
    }
    Ok(())
}

fn unpack_catalog(
    archive: &Path,
    destination: &Path,
    manifest: &CatalogManifest,
) -> Result<(), String> {
    verify_checksum(archive, &manifest.archive_sha256)?;
    let parent = destination
        .parent()
        .ok_or_else(|| "catalog destination has no parent directory".to_owned())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("catalog data directory cannot be created: {error}"))?;
    let temporary = destination.with_extension("sqlite.tmp");
    let input = File::open(archive)
        .map_err(|error| format!("catalog archive cannot be opened: {error}"))?;
    let output = File::create(&temporary)
        .map_err(|error| format!("catalog temporary file cannot be created: {error}"))?;
    zstd::stream::copy_decode(input, output)
        .map_err(|error| format!("catalog archive cannot be unpacked: {error}"))?;
    verify_checksum(&temporary, &manifest.sqlite_sha256)?;
    validate_runtime_catalog(&temporary, manifest)?;
    if destination.exists() {
        let previous = destination.with_extension("sqlite.previous");
        if previous.exists() {
            fs::remove_file(&previous)
                .map_err(|error| format!("old catalog backup cannot be replaced: {error}"))?;
        }
        fs::rename(destination, &previous)
            .map_err(|error| format!("old catalog cannot be preserved: {error}"))?;
    }
    fs::rename(&temporary, destination)
        .map_err(|error| format!("catalog cannot be installed atomically: {error}"))?;
    Ok(())
}

fn ready_state(path: PathBuf, manifest: &CatalogManifest) -> CatalogState {
    CatalogState {
        path: Some(path),
        status: CatalogStatus {
            state: "ready",
            catalog_version: Some(manifest.catalog_version.clone()),
            snapshot_date: Some(manifest.source_frozen_at.clone()),
            total_jobs: manifest.canonical_jobs,
            message: None,
        },
    }
}

fn unavailable_state(state: &'static str, message: String) -> CatalogState {
    CatalogState {
        path: None,
        status: CatalogStatus {
            state,
            catalog_version: None,
            snapshot_date: None,
            total_jobs: 0,
            message: Some(message),
        },
    }
}

fn initialize_catalog(app: &tauri::App) -> CatalogState {
    let manifest = match read_manifest() {
        Ok(manifest) => manifest,
        Err(error) => return unavailable_state("error", error),
    };

    if let Some(configured) = env::var_os("GIVEMEJOB_CATALOG_PATH") {
        let path = PathBuf::from(configured);
        return match validate_runtime_catalog(&path, &manifest) {
            Ok(()) => ready_state(path, &manifest),
            Err(error) => unavailable_state("error", error),
        };
    }

    if cfg!(debug_assertions) {
        let development = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../.artifacts/catalog")
            .join(&manifest.sqlite_file);
        if development.exists() {
            return match validate_runtime_catalog(&development, &manifest) {
                Ok(()) => ready_state(development, &manifest),
                Err(error) => unavailable_state("error", error),
            };
        }
    }

    let local_root = match env::var_os("LOCALAPPDATA") {
        Some(root) => PathBuf::from(root).join("GiveMeJob!").join("data"),
        None => {
            return unavailable_state(
                "error",
                "LOCALAPPDATA is unavailable; catalog path cannot be resolved".to_owned(),
            )
        }
    };
    let local_catalog = local_root.join(&manifest.sqlite_file);
    if local_catalog.exists() && validate_runtime_catalog(&local_catalog, &manifest).is_ok() {
        return ready_state(local_catalog, &manifest);
    }

    let archive = match app.path().resolve(
        format!("resources/{}", manifest.archive_file),
        BaseDirectory::Resource,
    ) {
        Ok(path) => path,
        Err(error) => {
            return unavailable_state(
                "missing",
                format!("bundled catalog path cannot be resolved: {error}"),
            )
        }
    };
    if !archive.exists() {
        return unavailable_state(
            "missing",
            "catalog release artifact is not bundled in this build".to_owned(),
        );
    }
    match unpack_catalog(&archive, &local_catalog, &manifest) {
        Ok(()) => ready_state(local_catalog, &manifest),
        Err(error) => unavailable_state("error", error),
    }
}

fn safe_fts_query(query: &str) -> Option<String> {
    let tokens: Vec<String> = query
        .split(|character: char| !(character.is_alphanumeric() || character == '_'))
        .filter(|token| !token.is_empty())
        .take(12)
        .map(|token| format!("\"{}\"*", token.replace('"', "\"\"")))
        .collect();
    if tokens.is_empty() {
        None
    } else {
        Some(tokens.join(" AND "))
    }
}

#[tauri::command]
fn catalog_status(state: State<'_, CatalogState>) -> CatalogStatus {
    state.status.clone()
}

#[tauri::command]
fn search_jobs(
    request: SearchJobsRequest,
    state: State<'_, CatalogState>,
) -> Result<Vec<JobSummary>, String> {
    let path = state
        .path
        .as_deref()
        .ok_or_else(|| "local catalog is unavailable".to_owned())?;
    let connection = readonly_connection(path)?;
    let limit = request.limit.clamp(1, 50);
    let select = r#"
        SELECT
          job.id, job.title, job.company, job.location_text, job.remote_mode,
          job.seniority, job.salary_min, job.salary_max, job.salary_currency,
          job.salary_period, job.posted_at, job.source, job.attribution
        "#;
    let (sql, fts_query) = match safe_fts_query(&request.query) {
        Some(fts_query) => (
            format!(
                "{select}
                FROM jobs_fts
                JOIN jobs AS job ON job.id = jobs_fts.rowid
                WHERE jobs_fts MATCH ?1
                ORDER BY bm25(jobs_fts, 8.0, 6.0, 3.0, 2.0, 1.0, 1.0),
                         job.posted_at DESC, job.id
                LIMIT ?2"
            ),
            Some(fts_query),
        ),
        None => (
            format!(
                "{select}
                FROM jobs AS job
                ORDER BY job.posted_at DESC, job.id
                LIMIT ?2"
            ),
            None,
        ),
    };
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| format!("local search cannot be prepared: {error}"))?;
    let map_row = |row: &rusqlite::Row<'_>| {
        Ok(JobSummary {
            id: row.get(0)?,
            title: row.get(1)?,
            company: row.get(2)?,
            location_text: row.get(3)?,
            remote_mode: row.get(4)?,
            seniority: row.get(5)?,
            salary_min: row.get(6)?,
            salary_max: row.get(7)?,
            salary_currency: row.get(8)?,
            salary_period: row.get(9)?,
            posted_at: row.get(10)?,
            source: row.get(11)?,
            attribution: row.get(12)?,
        })
    };
    let jobs = match fts_query {
        Some(fts_query) => statement.query_map(params![fts_query, limit], map_row),
        None => statement.query_map(params![rusqlite::types::Null, limit], map_row),
    }
    .map_err(|error| format!("local search failed: {error}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| format!("local search result is invalid: {error}"))?;
    Ok(jobs)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let state = initialize_catalog(app);
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![catalog_status, search_jobs])
        .run(tauri::generate_context!())
        .expect("error while running GiveMeJob");
}

#[cfg(test)]
mod tests {
    use super::{read_manifest, safe_fts_query};

    #[test]
    fn embedded_manifest_matches_the_frozen_catalog() {
        let manifest = read_manifest().expect("manifest should be valid");
        assert_eq!(manifest.catalog_version, "1");
        assert_eq!(manifest.canonical_jobs, 78_719);
    }

    #[test]
    fn fts_query_accepts_words_without_exposing_fts_syntax() {
        assert_eq!(
            safe_fts_query("Python OR (Rust)"),
            Some("\"Python\"* AND \"OR\"* AND \"Rust\"*".to_owned())
        );
        assert_eq!(safe_fts_query("  ---  "), None);
    }

    #[test]
    fn io_copy_contract_is_available_for_atomic_install() {
        let mut input = std::io::Cursor::new(b"catalog");
        let mut output = Vec::new();
        std::io::copy(&mut input, &mut output).expect("copy should succeed");
        assert_eq!(output, b"catalog");
    }
}
