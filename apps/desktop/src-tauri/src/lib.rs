use std::{
    env,
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
};

use rusqlite::{Connection, OpenFlags};
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use tauri::{path::BaseDirectory, Manager, State};

mod ipc;
mod search;

use ipc::{CatalogStatus, IpcError};
use search::dto::{
    AutocompleteRequest, FilterOptions, JobDetail, JobId, JobSummary, LocationSuggestion,
    SearchFacets, SearchPage, SearchQuery, SkillSuggestion,
};
use search::{
    autocomplete_locations as search_location_suggestions,
    autocomplete_skills as search_skill_suggestions, get_facets,
    get_filter_options as load_filter_options, get_job_detail, search_catalog,
};

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

#[derive(Debug)]
struct CatalogState {
    path: Option<PathBuf>,
    catalog_version: Option<String>,
    unavailable_error: Option<IpcError>,
    status: CatalogStatus,
}

fn read_manifest() -> Result<CatalogManifest, IpcError> {
    serde_json::from_str(CATALOG_MANIFEST).map_err(|_| IpcError::Internal)
}

fn readonly_connection(path: &Path) -> Result<Connection, IpcError> {
    let connection = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY
            | OpenFlags::SQLITE_OPEN_URI
            | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|_| IpcError::OpenFailed)?;
    connection
        .execute_batch("PRAGMA query_only = ON; PRAGMA temp_store = MEMORY;")
        .map_err(|_| IpcError::OpenFailed)?;
    Ok(connection)
}

fn validate_runtime_catalog(path: &Path, manifest: &CatalogManifest) -> Result<(), IpcError> {
    let connection = readonly_connection(path)?;
    let version: String = connection
        .query_row(
            "SELECT value FROM catalog_meta WHERE key = 'catalog_version'",
            [],
            |row| row.get(0),
        )
        .map_err(|_| IpcError::CatalogCorrupt)?;
    let count: i64 = connection
        .query_row("SELECT count(*) FROM jobs", [], |row| row.get(0))
        .map_err(|_| IpcError::CatalogCorrupt)?;
    let expected_count = i64::try_from(manifest.canonical_jobs).map_err(|_| IpcError::Internal)?;
    if version != manifest.catalog_version || count != expected_count {
        return Err(IpcError::CatalogCorrupt);
    }
    Ok(())
}

fn sha256_file(path: &Path) -> Result<String, IpcError> {
    let mut file = File::open(path).map_err(|_| IpcError::OpenFailed)?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 1024 * 1024];
    loop {
        let bytes = file.read(&mut buffer).map_err(|_| IpcError::OpenFailed)?;
        if bytes == 0 {
            break;
        }
        digest.update(&buffer[..bytes]);
    }
    Ok(format!("{:x}", digest.finalize()))
}

fn verify_checksum(path: &Path, expected: &str) -> Result<(), IpcError> {
    if sha256_file(path)? != expected {
        return Err(IpcError::CatalogCorrupt);
    }
    Ok(())
}

fn unpack_catalog(
    archive: &Path,
    destination: &Path,
    manifest: &CatalogManifest,
) -> Result<(), IpcError> {
    verify_checksum(archive, &manifest.archive_sha256)?;
    let parent = destination.parent().ok_or(IpcError::Internal)?;
    fs::create_dir_all(parent).map_err(|_| IpcError::OpenFailed)?;
    let temporary = destination.with_extension("sqlite.tmp");
    let input = File::open(archive).map_err(|_| IpcError::OpenFailed)?;
    let output = File::create(&temporary).map_err(|_| IpcError::OpenFailed)?;
    zstd::stream::copy_decode(input, output).map_err(|_| IpcError::CatalogCorrupt)?;
    verify_checksum(&temporary, &manifest.sqlite_sha256)?;
    validate_runtime_catalog(&temporary, manifest)?;
    if destination.exists() {
        let previous = destination.with_extension("sqlite.previous");
        if previous.exists() {
            fs::remove_file(&previous).map_err(|_| IpcError::OpenFailed)?;
        }
        fs::rename(destination, &previous).map_err(|_| IpcError::OpenFailed)?;
    }
    fs::rename(&temporary, destination).map_err(|_| IpcError::OpenFailed)?;
    Ok(())
}

fn ready_state(path: PathBuf, manifest: &CatalogManifest) -> CatalogState {
    CatalogState {
        path: Some(path),
        catalog_version: Some(manifest.catalog_version.clone()),
        unavailable_error: None,
        status: CatalogStatus {
            state: "ready".to_owned(),
            catalog_version: Some(manifest.catalog_version.clone()),
            source_frozen_at: Some(manifest.source_frozen_at.clone()),
            total_jobs: manifest.canonical_jobs,
            message: None,
        },
    }
}

fn unavailable_state(error: IpcError) -> CatalogState {
    let state = if error == IpcError::CatalogMissing {
        "missing"
    } else {
        "error"
    };
    CatalogState {
        path: None,
        catalog_version: None,
        unavailable_error: Some(error),
        status: CatalogStatus {
            state: state.to_owned(),
            catalog_version: None,
            source_frozen_at: None,
            total_jobs: 0,
            message: Some(error.public_message().to_owned()),
        },
    }
}

fn initialize_catalog(app: &tauri::App) -> CatalogState {
    let manifest = match read_manifest() {
        Ok(manifest) => manifest,
        Err(error) => return unavailable_state(error),
    };

    if let Some(configured) = env::var_os("GIVEMEJOB_CATALOG_PATH") {
        let path = PathBuf::from(configured);
        if !path.is_file() {
            return unavailable_state(IpcError::CatalogMissing);
        }
        return match validate_runtime_catalog(&path, &manifest) {
            Ok(()) => ready_state(path, &manifest),
            Err(error) => unavailable_state(error),
        };
    }

    if cfg!(debug_assertions) {
        let development = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../.artifacts/catalog")
            .join(&manifest.sqlite_file);
        if development.exists() {
            return match validate_runtime_catalog(&development, &manifest) {
                Ok(()) => ready_state(development, &manifest),
                Err(error) => unavailable_state(error),
            };
        }
    }

    let local_root = match env::var_os("LOCALAPPDATA") {
        Some(root) => PathBuf::from(root).join("GiveMeJob!").join("data"),
        None => return unavailable_state(IpcError::OpenFailed),
    };
    let local_catalog = local_root.join(&manifest.sqlite_file);
    let local_error = if local_catalog.exists() {
        match validate_runtime_catalog(&local_catalog, &manifest) {
            Ok(()) => return ready_state(local_catalog, &manifest),
            Err(error) => Some(error),
        }
    } else {
        None
    };

    let archive = match app.path().resolve(
        format!("resources/{}", manifest.archive_file),
        BaseDirectory::Resource,
    ) {
        Ok(path) => path,
        Err(_) => return unavailable_state(IpcError::Internal),
    };
    if !archive.exists() {
        return unavailable_state(local_error.unwrap_or(IpcError::CatalogMissing));
    }
    match unpack_catalog(&archive, &local_catalog, &manifest) {
        Ok(()) => ready_state(local_catalog, &manifest),
        Err(error) => unavailable_state(error),
    }
}

fn available_catalog(state: &CatalogState) -> Result<(&Path, &str), IpcError> {
    let path = state
        .path
        .as_deref()
        .ok_or_else(|| state.unavailable_error.unwrap_or(IpcError::CatalogMissing))?;
    let version = state.catalog_version.as_deref().ok_or(IpcError::Internal)?;
    Ok((path, version))
}

#[tauri::command]
fn catalog_status(state: State<'_, CatalogState>) -> CatalogStatus {
    state.status.clone()
}

#[tauri::command]
fn search_jobs(
    request: Value,
    state: State<'_, CatalogState>,
) -> Result<SearchPage<JobSummary>, IpcError> {
    let request: SearchQuery =
        serde_json::from_value(request).map_err(|_| IpcError::InvalidQuery)?;
    request.validate()?;
    let (path, catalog_version) = available_catalog(&state)?;
    let connection = readonly_connection(path)?;
    search_catalog(&connection, &request, catalog_version)
}

#[tauri::command]
fn get_job(id: Value, state: State<'_, CatalogState>) -> Result<JobDetail, IpcError> {
    let id: JobId = serde_json::from_value(id).map_err(|_| IpcError::InvalidQuery)?;
    let (path, _) = available_catalog(&state)?;
    let connection = readonly_connection(path)?;
    get_job_detail(&connection, &id)
}

#[tauri::command]
fn get_search_facets(state: State<'_, CatalogState>) -> Result<SearchFacets, IpcError> {
    let (path, _) = available_catalog(&state)?;
    let connection = readonly_connection(path)?;
    get_facets(&connection)
}

#[tauri::command]
fn get_filter_options(state: State<'_, CatalogState>) -> Result<FilterOptions, IpcError> {
    let (path, _) = available_catalog(&state)?;
    let connection = readonly_connection(path)?;
    load_filter_options(&connection)
}

#[tauri::command]
fn autocomplete_skills(
    request: Value,
    state: State<'_, CatalogState>,
) -> Result<Vec<SkillSuggestion>, IpcError> {
    let request: AutocompleteRequest =
        serde_json::from_value(request).map_err(|_| IpcError::InvalidQuery)?;
    request.validate_and_normalize()?;
    let (path, _) = available_catalog(&state)?;
    let connection = readonly_connection(path)?;
    search_skill_suggestions(&connection, &request)
}

#[tauri::command]
fn autocomplete_locations(
    request: Value,
    state: State<'_, CatalogState>,
) -> Result<Vec<LocationSuggestion>, IpcError> {
    let request: AutocompleteRequest =
        serde_json::from_value(request).map_err(|_| IpcError::InvalidQuery)?;
    request.validate_and_normalize()?;
    let (path, _) = available_catalog(&state)?;
    let connection = readonly_connection(path)?;
    search_location_suggestions(&connection, &request)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(initialize_catalog(app));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            catalog_status,
            search_jobs,
            get_job,
            get_search_facets,
            get_filter_options,
            autocomplete_skills,
            autocomplete_locations
        ])
        .run(tauri::generate_context!())
        .expect("error while running GiveMeJob");
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{read_manifest, unavailable_state};
    use crate::ipc::IpcError;

    #[test]
    fn embedded_manifest_matches_the_frozen_catalog() {
        let manifest = read_manifest().expect("manifest should be valid");
        assert_eq!(manifest.catalog_version, "1");
        assert_eq!(manifest.canonical_jobs, 78_719);
    }

    #[test]
    fn unavailable_status_contains_only_a_public_message() {
        let state = unavailable_state(IpcError::CatalogCorrupt);
        let value = serde_json::to_value(state.status).expect("status should serialize");
        assert_eq!(value["state"], json!("error"));
        assert_eq!(
            value["message"],
            json!("The local catalog failed validation.")
        );
        assert!(!value.to_string().contains("sqlite"));
        assert!(!value.to_string().contains("\\"));
    }

    #[test]
    fn ipc_errors_are_closed_discriminated_objects() {
        assert_eq!(
            serde_json::to_value(IpcError::OpenFailed).expect("error should serialize"),
            json!({ "code": "open_failed" })
        );
        assert!(serde_json::from_value::<IpcError>(json!({
            "code": "open_failed",
            "path": "C:\\private\\catalog.sqlite"
        }))
        .is_err());
    }
}
