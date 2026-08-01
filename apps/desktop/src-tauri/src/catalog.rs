use std::{
    collections::{HashMap, HashSet},
    fs::{self, File, OpenOptions},
    io::{self, BufReader, Read, Write},
    path::{Component, Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{SystemTime, UNIX_EPOCH},
};

use fs2::FileExt;
use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{path::BaseDirectory, App, AppHandle, Emitter, Manager};
use tempfile::{Builder as TempFileBuilder, NamedTempFile};

use crate::ipc::IpcError;

const CATALOG_MANIFEST_JSON: &str = include_str!("../../../../config/catalog-manifest.json");
const CATALOG_STATUS_EVENT: &str = "catalog://status";
const INSTALL_RESERVE_BYTES: u64 = 64 * 1024 * 1024;
const SEAL_VERSION: u32 = 1;
const SUPPORTED_CATALOG_VERSION: &str = "1";
const SUPPORTED_MANIFEST_VERSION: u32 = 1;
const SUPPORTED_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(crate) struct CatalogManifest {
    pub(crate) manifest_version: u32,
    pub(crate) catalog_version: String,
    pub(crate) schema_version: u32,
    pub(crate) description_format: String,
    pub(crate) source_frozen_at: String,
    pub(crate) exported_at: String,
    pub(crate) published_at: Option<String>,
    pub(crate) canonical_jobs: u64,
    pub(crate) jobs_with_skills: u64,
    pub(crate) jobs_with_salary: u64,
    pub(crate) source_commit_sha: String,
    pub(crate) logical_checksum: String,
    pub(crate) sqlite_file: String,
    pub(crate) sqlite_size_bytes: u64,
    pub(crate) sqlite_sha256: String,
    pub(crate) archive_file: String,
    pub(crate) archive_size_bytes: u64,
    pub(crate) archive_sha256: String,
}

impl CatalogManifest {
    fn parse(input: &str) -> Result<Self, CatalogFailure> {
        let manifest: Self =
            serde_json::from_str(input).map_err(|_| CatalogFailure::UnsupportedManifest)?;
        manifest.validate()?;
        Ok(manifest)
    }

    fn validate(&self) -> Result<(), CatalogFailure> {
        if self.manifest_version != SUPPORTED_MANIFEST_VERSION
            || self.schema_version != SUPPORTED_SCHEMA_VERSION
            || self.catalog_version != SUPPORTED_CATALOG_VERSION
        {
            return Err(CatalogFailure::UnsupportedManifest);
        }
        if !is_positive_decimal(&self.catalog_version)
            || self.description_format != "plain_text"
            || !is_utc_timestamp(&self.source_frozen_at)
            || !is_utc_timestamp(&self.exported_at)
            || self
                .published_at
                .as_deref()
                .is_some_and(|value| !is_utc_timestamp(value))
            || self.canonical_jobs == 0
            || self.jobs_with_skills > self.canonical_jobs
            || self.jobs_with_salary > self.canonical_jobs
            || !is_lower_hex(&self.source_commit_sha, 40)
            || !is_lower_hex(&self.logical_checksum, 64)
            || !is_lower_hex(&self.sqlite_sha256, 64)
            || !is_lower_hex(&self.archive_sha256, 64)
            || self.sqlite_size_bytes == 0
            || self.archive_size_bytes == 0
        {
            return Err(CatalogFailure::UnsupportedManifest);
        }
        validate_resource_filename(&self.sqlite_file)?;
        validate_resource_filename(&self.archive_file)?;
        let expected_sqlite = format!("catalog-v{}.sqlite", self.catalog_version);
        if self.sqlite_file != expected_sqlite
            || self.archive_file != format!("{expected_sqlite}.zst")
        {
            return Err(CatalogFailure::UnsafeResourceName);
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum CatalogStatusKind {
    Initializing,
    Verifying,
    Ready,
    Missing,
    Recovering,
    Error,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum CatalogStage {
    Starting,
    CheckingSeal,
    CheckingSpace,
    CheckingArchive,
    Decompressing,
    CheckingCatalog,
    CheckingSqlite,
    Activating,
    Opening,
    CleaningUp,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CatalogStatus {
    pub(crate) state: CatalogStatusKind,
    pub(crate) stage: Option<CatalogStage>,
    pub(crate) progress: u8,
    pub(crate) catalog_version: Option<String>,
    pub(crate) source_frozen_at: Option<String>,
    pub(crate) total_jobs: u64,
    pub(crate) message: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CatalogHandle {
    pub(crate) path: PathBuf,
    pub(crate) catalog_version: String,
}

#[derive(Debug, Clone)]
struct CatalogPaths {
    root: PathBuf,
    destination: PathBuf,
    previous: PathBuf,
    seal: PathBuf,
    lock: PathBuf,
    archive: PathBuf,
}

#[derive(Debug)]
struct RuntimeState {
    handle: Option<CatalogHandle>,
    unavailable_error: Option<IpcError>,
    status: CatalogStatus,
}

#[derive(Clone)]
pub(crate) struct CatalogManager {
    inner: Arc<CatalogManagerInner>,
}

struct CatalogManagerInner {
    app: AppHandle,
    manifest: Option<Arc<CatalogManifest>>,
    paths: Option<CatalogPaths>,
    debug_catalog: Option<PathBuf>,
    operation_active: AtomicBool,
    runtime: Mutex<RuntimeState>,
}

impl CatalogManager {
    pub(crate) fn from_app(app: &App) -> Self {
        let app_handle = app.handle().clone();
        match CatalogManifest::parse(CATALOG_MANIFEST_JSON).and_then(|manifest| {
            CatalogPaths::resolve(app, &manifest).map(|paths| (manifest, paths))
        }) {
            Ok((manifest, paths)) => {
                let debug_catalog = debug_catalog_path(&manifest);
                let status = lifecycle_status(
                    CatalogStatusKind::Initializing,
                    Some(CatalogStage::Starting),
                    0,
                    Some(&manifest),
                    None,
                );
                Self {
                    inner: Arc::new(CatalogManagerInner {
                        app: app_handle,
                        manifest: Some(Arc::new(manifest)),
                        paths: Some(paths),
                        debug_catalog,
                        operation_active: AtomicBool::new(false),
                        runtime: Mutex::new(RuntimeState {
                            handle: None,
                            unavailable_error: None,
                            status,
                        }),
                    }),
                }
            }
            Err(failure) => Self {
                inner: Arc::new(CatalogManagerInner {
                    app: app_handle,
                    manifest: None,
                    paths: None,
                    debug_catalog: None,
                    operation_active: AtomicBool::new(false),
                    runtime: Mutex::new(RuntimeState {
                        handle: None,
                        unavailable_error: Some(failure.ipc_error()),
                        status: lifecycle_status(
                            CatalogStatusKind::Error,
                            None,
                            0,
                            None,
                            Some(failure.ipc_error()),
                        ),
                    }),
                }),
            },
        }
    }

    pub(crate) fn initialize_background(&self) {
        let manager = self.clone();
        tauri::async_runtime::spawn(async move {
            let _ = manager.run_operation(false).await;
        });
    }

    pub(crate) async fn recover(&self) -> Result<CatalogStatus, IpcError> {
        self.run_operation(true).await
    }

    pub(crate) fn status(&self) -> CatalogStatus {
        self.runtime().status.clone()
    }

    pub(crate) fn available_catalog(&self) -> Result<CatalogHandle, IpcError> {
        let runtime = self.runtime();
        runtime.handle.clone().ok_or_else(|| {
            runtime
                .unavailable_error
                .unwrap_or(IpcError::CatalogMissing)
        })
    }

    async fn run_operation(&self, force_recovery: bool) -> Result<CatalogStatus, IpcError> {
        if self
            .inner
            .operation_active
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_err()
        {
            return Err(IpcError::CatalogBusy);
        }

        let Some(manifest) = self.inner.manifest.clone() else {
            self.inner.operation_active.store(false, Ordering::Release);
            return Err(IpcError::Internal);
        };
        let Some(paths) = self.inner.paths.clone() else {
            self.inner.operation_active.store(false, Ordering::Release);
            return Err(IpcError::Internal);
        };
        self.begin_operation(&manifest, force_recovery);

        let manager = self.clone();
        let worker_manifest = manifest.clone();
        let debug_catalog = self.inner.debug_catalog.clone();
        let worker = tauri::async_runtime::spawn_blocking(move || {
            let progress_manager = manager.clone();
            let progress_manifest = worker_manifest.clone();
            let progress = move |state, stage, value| {
                progress_manager.update_progress(state, stage, value, &progress_manifest);
            };
            run_catalog_lifecycle(
                &worker_manifest,
                &paths,
                debug_catalog.as_deref(),
                force_recovery,
                &RealCatalogSystem,
                &progress,
            )
        })
        .await;

        self.inner.operation_active.store(false, Ordering::Release);
        match worker {
            Ok(Ok(handle)) => {
                self.finish_ready(handle, &manifest);
                Ok(self.status())
            }
            Ok(Err(failure)) => {
                self.finish_failure(failure, &manifest);
                Err(failure.ipc_error())
            }
            Err(_) => {
                let failure = CatalogFailure::WorkerFailed;
                self.finish_failure(failure, &manifest);
                Err(failure.ipc_error())
            }
        }
    }

    fn begin_operation(&self, manifest: &CatalogManifest, force_recovery: bool) {
        let state = if force_recovery {
            CatalogStatusKind::Recovering
        } else {
            CatalogStatusKind::Initializing
        };
        self.replace_runtime(RuntimeState {
            handle: None,
            unavailable_error: None,
            status: lifecycle_status(state, Some(CatalogStage::Starting), 0, Some(manifest), None),
        });
    }

    fn update_progress(
        &self,
        state: CatalogStatusKind,
        stage: CatalogStage,
        progress: u8,
        manifest: &CatalogManifest,
    ) {
        let status = {
            let mut runtime = self.runtime();
            let progress = progress.min(99).max(runtime.status.progress);
            if runtime.status.state == state
                && runtime.status.stage == Some(stage)
                && runtime.status.progress == progress
            {
                return;
            }
            runtime.status = lifecycle_status(state, Some(stage), progress, Some(manifest), None);
            runtime.status.clone()
        };
        self.emit_status(&status);
    }

    fn finish_ready(&self, handle: CatalogHandle, manifest: &CatalogManifest) {
        let status = lifecycle_status(CatalogStatusKind::Ready, None, 100, Some(manifest), None);
        self.replace_runtime(RuntimeState {
            handle: Some(handle),
            unavailable_error: None,
            status,
        });
    }

    fn finish_failure(&self, failure: CatalogFailure, manifest: &CatalogManifest) {
        let error = failure.ipc_error();
        let state = if failure == CatalogFailure::CatalogMissing {
            CatalogStatusKind::Missing
        } else {
            CatalogStatusKind::Error
        };
        let progress = self.status().progress;
        self.replace_runtime(RuntimeState {
            handle: None,
            unavailable_error: Some(error),
            status: lifecycle_status(state, None, progress, Some(manifest), Some(error)),
        });
    }

    fn replace_runtime(&self, replacement: RuntimeState) {
        let status = replacement.status.clone();
        *self.runtime() = replacement;
        self.emit_status(&status);
    }

    fn emit_status(&self, status: &CatalogStatus) {
        let _ = self.inner.app.emit(CATALOG_STATUS_EVENT, status.clone());
    }

    fn runtime(&self) -> std::sync::MutexGuard<'_, RuntimeState> {
        self.inner
            .runtime
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }
}

impl CatalogPaths {
    fn resolve(app: &App, manifest: &CatalogManifest) -> Result<Self, CatalogFailure> {
        let root = app
            .path()
            .local_data_dir()
            .map_err(|_| CatalogFailure::OpenFailed)?
            .join("GiveMeJob!")
            .join("data");
        let destination = root.join(&manifest.sqlite_file);
        let archive = app
            .path()
            .resolve(
                Path::new("resources").join(&manifest.archive_file),
                BaseDirectory::Resource,
            )
            .map_err(|_| CatalogFailure::OpenFailed)?;
        Ok(Self {
            previous: destination.with_extension("sqlite.previous"),
            seal: destination.with_extension("sqlite.seal.json"),
            lock: root.join("catalog-install.lock"),
            root,
            destination,
            archive,
        })
    }

    #[cfg(test)]
    fn for_test(root: &Path, manifest: &CatalogManifest, archive: PathBuf) -> Self {
        let destination = root.join(&manifest.sqlite_file);
        Self {
            previous: destination.with_extension("sqlite.previous"),
            seal: destination.with_extension("sqlite.seal.json"),
            lock: root.join("catalog-install.lock"),
            root: root.to_path_buf(),
            destination,
            archive,
        }
    }
}

fn lifecycle_status(
    state: CatalogStatusKind,
    stage: Option<CatalogStage>,
    progress: u8,
    manifest: Option<&CatalogManifest>,
    error: Option<IpcError>,
) -> CatalogStatus {
    CatalogStatus {
        state,
        stage,
        progress,
        catalog_version: manifest.map(|value| value.catalog_version.clone()),
        source_frozen_at: manifest.map(|value| value.source_frozen_at.clone()),
        total_jobs: manifest.map_or(0, |value| value.canonical_jobs),
        message: error.map(|value| value.public_message().to_owned()),
    }
}

fn validate_resource_filename(value: &str) -> Result<(), CatalogFailure> {
    let path = Path::new(value);
    if value.is_empty()
        || value == "."
        || value == ".."
        || path.is_absolute()
        || value.contains('/')
        || value.contains('\\')
        || value.contains(':')
        || path.components().any(|component| {
            !matches!(component, Component::Normal(_))
                || component.as_os_str().to_string_lossy() != value
        })
    {
        return Err(CatalogFailure::UnsafeResourceName);
    }
    Ok(())
}

fn is_positive_decimal(value: &str) -> bool {
    !value.is_empty()
        && !value.starts_with('0')
        && value.bytes().all(|value| value.is_ascii_digit())
}

fn is_lower_hex(value: &str, length: usize) -> bool {
    value.len() == length
        && value
            .bytes()
            .all(|value| value.is_ascii_digit() || (b'a'..=b'f').contains(&value))
}

fn is_utc_timestamp(value: &str) -> bool {
    let Some(value) = value.strip_suffix('Z') else {
        return false;
    };
    let Some((date, time)) = value.split_once('T') else {
        return false;
    };
    let date_parts = date
        .split('-')
        .map(str::parse::<u32>)
        .collect::<Result<Vec<_>, _>>();
    let Ok(date_parts) = date_parts else {
        return false;
    };
    if date_parts.len() != 3 || date_parts[0] == 0 || !(1..=12).contains(&date_parts[1]) {
        return false;
    }
    let leap_year = date_parts[0].is_multiple_of(4)
        && (!date_parts[0].is_multiple_of(100) || date_parts[0].is_multiple_of(400));
    let days_in_month = match date_parts[1] {
        2 if leap_year => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    };
    if !(1..=days_in_month).contains(&date_parts[2]) {
        return false;
    }

    let (clock, fractional) = time
        .split_once('.')
        .map_or((time, None), |(clock, fraction)| (clock, Some(fraction)));
    if fractional
        .is_some_and(|value| value.is_empty() || !value.bytes().all(|b| b.is_ascii_digit()))
    {
        return false;
    }
    let clock_parts = clock
        .split(':')
        .map(str::parse::<u32>)
        .collect::<Result<Vec<_>, _>>();
    let Ok(clock_parts) = clock_parts else {
        return false;
    };
    clock_parts.len() == 3 && clock_parts[0] <= 23 && clock_parts[1] <= 59 && clock_parts[2] <= 59
}

#[cfg(any(debug_assertions, test))]
fn debug_catalog_path(manifest: &CatalogManifest) -> Option<PathBuf> {
    if let Some(configured) = std::env::var_os("GIVEMEJOB_CATALOG_PATH") {
        return Some(PathBuf::from(configured));
    }
    let development = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../.artifacts/catalog")
        .join(&manifest.sqlite_file);
    development.is_file().then_some(development)
}

#[cfg(not(any(debug_assertions, test)))]
fn debug_catalog_path(_manifest: &CatalogManifest) -> Option<PathBuf> {
    None
}

pub(crate) fn readonly_connection(path: &Path) -> Result<Connection, IpcError> {
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

type ProgressCallback<'a> = dyn Fn(CatalogStatusKind, CatalogStage, u8) + Send + Sync + 'a;

fn run_catalog_lifecycle(
    manifest: &CatalogManifest,
    paths: &CatalogPaths,
    debug_catalog: Option<&Path>,
    force_recovery: bool,
    system: &dyn CatalogSystem,
    progress: &ProgressCallback<'_>,
) -> Result<CatalogHandle, CatalogFailure> {
    if let Some(path) = debug_catalog {
        progress(
            CatalogStatusKind::Verifying,
            CatalogStage::CheckingSqlite,
            20,
        );
        validate_database_contract(path, manifest, false)?;
        progress(CatalogStatusKind::Verifying, CatalogStage::Opening, 95);
        open_validated_catalog(path, manifest)?;
        return Ok(CatalogHandle {
            path: path.to_path_buf(),
            catalog_version: manifest.catalog_version.clone(),
        });
    }

    fs::create_dir_all(&paths.root).map_err(map_io_failure)?;
    let _install_lock = InstallLock::acquire(&paths.lock)?;
    cleanup_stale_temps(paths, system)?;

    if !paths.destination.exists() && paths.previous.is_file() {
        progress(
            CatalogStatusKind::Recovering,
            CatalogStage::CheckingCatalog,
            5,
        );
        if full_validate_catalog(
            &paths.previous,
            manifest,
            true,
            CatalogStatusKind::Recovering,
            progress,
        )
        .is_ok()
        {
            system
                .rename(&paths.previous, &paths.destination)
                .map_err(map_io_failure)?;
            open_validated_catalog(&paths.destination, manifest)?;
            write_seal(&paths.seal, &paths.destination, manifest)?;
            return Ok(CatalogHandle {
                path: paths.destination.clone(),
                catalog_version: manifest.catalog_version.clone(),
            });
        }
    }

    if paths.destination.is_file() && !force_recovery {
        progress(CatalogStatusKind::Verifying, CatalogStage::CheckingSeal, 5);
        if fast_startup_validation(&paths.destination, &paths.seal, manifest)? {
            progress(CatalogStatusKind::Verifying, CatalogStage::Opening, 95);
            return Ok(CatalogHandle {
                path: paths.destination.clone(),
                catalog_version: manifest.catalog_version.clone(),
            });
        }

        progress(
            CatalogStatusKind::Verifying,
            CatalogStage::CheckingCatalog,
            12,
        );
        if full_validate_catalog(
            &paths.destination,
            manifest,
            true,
            CatalogStatusKind::Verifying,
            progress,
        )
        .is_ok()
        {
            open_validated_catalog(&paths.destination, manifest)?;
            write_seal(&paths.seal, &paths.destination, manifest)?;
            return Ok(CatalogHandle {
                path: paths.destination.clone(),
                catalog_version: manifest.catalog_version.clone(),
            });
        }
    }

    if !paths.archive.is_file() {
        return Err(if paths.destination.exists() {
            CatalogFailure::CatalogCorrupt
        } else {
            CatalogFailure::CatalogMissing
        });
    }

    let install_state = if paths.destination.exists() || force_recovery {
        CatalogStatusKind::Recovering
    } else {
        CatalogStatusKind::Initializing
    };
    install_catalog(manifest, paths, install_state, system, progress)
}

fn install_catalog(
    manifest: &CatalogManifest,
    paths: &CatalogPaths,
    state: CatalogStatusKind,
    system: &dyn CatalogSystem,
    progress: &ProgressCallback<'_>,
) -> Result<CatalogHandle, CatalogFailure> {
    progress(state, CatalogStage::CheckingSpace, 8);
    preflight_free_space(&paths.root, manifest, system)?;

    progress(state, CatalogStage::CheckingArchive, 10);
    verify_archive(manifest, &paths.archive, state, progress)?;

    progress(state, CatalogStage::Decompressing, 26);
    let temporary = decompress_catalog(manifest, &paths.archive, &paths.root, state, progress)?;

    progress(state, CatalogStage::CheckingSqlite, 66);
    full_validate_catalog(temporary.path(), manifest, false, state, progress)?;

    progress(state, CatalogStage::Activating, 90);
    activate_catalog(temporary, paths, manifest, system)?;
    progress(state, CatalogStage::Opening, 96);
    open_validated_catalog(&paths.destination, manifest)?;
    write_seal(&paths.seal, &paths.destination, manifest)?;

    progress(state, CatalogStage::CleaningUp, 99);
    if paths.previous.exists() {
        let _ = system.remove_file(&paths.previous);
    }
    cleanup_stale_temps(paths, system)?;
    Ok(CatalogHandle {
        path: paths.destination.clone(),
        catalog_version: manifest.catalog_version.clone(),
    })
}

fn preflight_free_space(
    root: &Path,
    manifest: &CatalogManifest,
    system: &dyn CatalogSystem,
) -> Result<(), CatalogFailure> {
    let reserve = INSTALL_RESERVE_BYTES.max(manifest.sqlite_size_bytes / 10);
    let required = manifest
        .sqlite_size_bytes
        .checked_add(reserve)
        .ok_or(CatalogFailure::DiskFull)?;
    let available = system.available_space(root).map_err(map_io_failure)?;
    if available < required {
        return Err(CatalogFailure::DiskFull);
    }
    Ok(())
}

fn verify_archive(
    manifest: &CatalogManifest,
    archive: &Path,
    state: CatalogStatusKind,
    progress: &ProgressCallback<'_>,
) -> Result<(), CatalogFailure> {
    let metadata = archive.metadata().map_err(map_io_failure)?;
    if metadata.len() != manifest.archive_size_bytes {
        return Err(CatalogFailure::ArchiveChecksum);
    }
    let actual = sha256_file(archive, manifest.archive_size_bytes, 10, 25, |value| {
        progress(state, CatalogStage::CheckingArchive, value);
    })?;
    if actual != manifest.archive_sha256 {
        return Err(CatalogFailure::ArchiveChecksum);
    }
    Ok(())
}

fn decompress_catalog(
    manifest: &CatalogManifest,
    archive: &Path,
    root: &Path,
    state: CatalogStatusKind,
    progress: &ProgressCallback<'_>,
) -> Result<NamedTempFile, CatalogFailure> {
    let mut temporary = TempFileBuilder::new()
        .prefix(&format!(".{}.install-", manifest.sqlite_file))
        .suffix(".tmp")
        .tempfile_in(root)
        .map_err(map_io_failure)?;
    let input = File::open(archive).map_err(map_io_failure)?;
    let mut decoder = zstd::stream::read::Decoder::new(BufReader::new(input))
        .map_err(|_| CatalogFailure::DecompressionFailed)?;
    let mut digest = Sha256::new();
    // Keep the 1 MiB streaming buffer on the heap. Tokio's blocking worker
    // stack on Windows is small enough that a fixed-size local buffer here
    // can terminate the release application with STATUS_STACK_OVERFLOW during
    // a real first-run extraction.
    let mut buffer = vec![0_u8; 1024 * 1024];
    let mut written = 0_u64;
    let mut last_progress = 26_u8;
    loop {
        let bytes = decoder
            .read(&mut buffer)
            .map_err(|_| CatalogFailure::DecompressionFailed)?;
        if bytes == 0 {
            break;
        }
        temporary
            .write_all(&buffer[..bytes])
            .map_err(map_io_failure)?;
        digest.update(&buffer[..bytes]);
        written = written
            .checked_add(u64::try_from(bytes).map_err(|_| CatalogFailure::OpenFailed)?)
            .ok_or(CatalogFailure::DiskFull)?;
        let value = ranged_progress(written, manifest.sqlite_size_bytes, 26, 65);
        if value > last_progress {
            last_progress = value;
            progress(state, CatalogStage::Decompressing, value);
        }
    }
    temporary.flush().map_err(map_io_failure)?;
    temporary.as_file().sync_all().map_err(map_io_failure)?;
    if written != manifest.sqlite_size_bytes
        || format!("{:x}", digest.finalize()) != manifest.sqlite_sha256
    {
        return Err(CatalogFailure::DecompressedChecksum);
    }
    Ok(temporary)
}

fn full_validate_catalog(
    path: &Path,
    manifest: &CatalogManifest,
    verify_hash: bool,
    state: CatalogStatusKind,
    progress: &ProgressCallback<'_>,
) -> Result<(), CatalogFailure> {
    let metadata = path.metadata().map_err(map_io_failure)?;
    if metadata.len() != manifest.sqlite_size_bytes {
        return Err(CatalogFailure::CatalogCorrupt);
    }
    if verify_hash {
        let actual = sha256_file(path, manifest.sqlite_size_bytes, 15, 62, |value| {
            progress(state, CatalogStage::CheckingCatalog, value);
        })?;
        if actual != manifest.sqlite_sha256 {
            return Err(CatalogFailure::DecompressedChecksum);
        }
    }
    progress(state, CatalogStage::CheckingSqlite, 66);
    validate_database_contract(path, manifest, true)
}

fn validate_database_contract(
    path: &Path,
    manifest: &CatalogManifest,
    full_check: bool,
) -> Result<(), CatalogFailure> {
    let connection = readonly_connection(path).map_err(|_| CatalogFailure::OpenFailed)?;
    let metadata = load_catalog_metadata(&connection)?;
    let expected = expected_catalog_metadata(manifest);
    if metadata != expected {
        return Err(CatalogFailure::UnsupportedCatalog);
    }

    let required_tables = [
        "catalog_meta",
        "jobs",
        "skills",
        "job_skills",
        "jobs_fts",
        "jobs_fts_docsize",
    ];
    let placeholders = std::iter::repeat_n("?", required_tables.len())
        .collect::<Vec<_>>()
        .join(", ");
    let mut statement = connection
        .prepare(&format!(
            "SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN ({placeholders})"
        ))
        .map_err(|_| CatalogFailure::CatalogCorrupt)?;
    let present = statement
        .query_map(rusqlite::params_from_iter(required_tables), |row| {
            row.get::<_, String>(0)
        })
        .map_err(|_| CatalogFailure::CatalogCorrupt)?
        .collect::<Result<HashSet<_>, _>>()
        .map_err(|_| CatalogFailure::CatalogCorrupt)?;
    if required_tables.iter().any(|name| !present.contains(*name)) {
        return Err(CatalogFailure::UnsupportedCatalog);
    }

    if !full_check {
        return Ok(());
    }

    let expected_count =
        i64::try_from(manifest.canonical_jobs).map_err(|_| CatalogFailure::UnsupportedManifest)?;
    let jobs_count: i64 = connection
        .query_row("SELECT count(*) FROM jobs", [], |row| row.get(0))
        .map_err(|_| CatalogFailure::CatalogCorrupt)?;
    let fts_count: i64 = connection
        .query_row("SELECT count(*) FROM jobs_fts_docsize", [], |row| {
            row.get(0)
        })
        .map_err(|_| CatalogFailure::CatalogCorrupt)?;
    if jobs_count != expected_count || fts_count != expected_count {
        return Err(CatalogFailure::UnsupportedCatalog);
    }

    let mut integrity = connection
        .prepare("PRAGMA integrity_check")
        .map_err(|_| CatalogFailure::CatalogCorrupt)?;
    let results = integrity
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|_| CatalogFailure::CatalogCorrupt)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| CatalogFailure::CatalogCorrupt)?;
    if results.as_slice() != ["ok"] {
        return Err(CatalogFailure::CatalogCorrupt);
    }

    let mut foreign_keys = connection
        .prepare("PRAGMA foreign_key_check")
        .map_err(|_| CatalogFailure::CatalogCorrupt)?;
    if foreign_keys
        .query([])
        .map_err(|_| CatalogFailure::CatalogCorrupt)?
        .next()
        .map_err(|_| CatalogFailure::CatalogCorrupt)?
        .is_some()
    {
        return Err(CatalogFailure::CatalogCorrupt);
    }
    Ok(())
}

fn expected_catalog_metadata(manifest: &CatalogManifest) -> HashMap<String, String> {
    [
        ("manifest_version", manifest.manifest_version.to_string()),
        ("catalog_version", manifest.catalog_version.clone()),
        ("schema_version", manifest.schema_version.to_string()),
        ("description_format", manifest.description_format.clone()),
        ("source_frozen_at", manifest.source_frozen_at.clone()),
        ("exported_at", manifest.exported_at.clone()),
        ("canonical_jobs", manifest.canonical_jobs.to_string()),
        ("jobs_with_skills", manifest.jobs_with_skills.to_string()),
        ("jobs_with_salary", manifest.jobs_with_salary.to_string()),
        ("source_commit_sha", manifest.source_commit_sha.clone()),
        ("logical_checksum", manifest.logical_checksum.clone()),
    ]
    .into_iter()
    .map(|(key, value)| (key.to_owned(), value))
    .collect()
}

fn load_catalog_metadata(
    connection: &Connection,
) -> Result<HashMap<String, String>, CatalogFailure> {
    let mut statement = connection
        .prepare("SELECT key, value FROM catalog_meta")
        .map_err(|_| CatalogFailure::CatalogCorrupt)?;
    let metadata = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|_| CatalogFailure::CatalogCorrupt)?
        .collect::<Result<HashMap<_, _>, _>>()
        .map_err(|_| CatalogFailure::CatalogCorrupt)?;
    Ok(metadata)
}

fn open_validated_catalog(path: &Path, manifest: &CatalogManifest) -> Result<(), CatalogFailure> {
    validate_database_contract(path, manifest, false)
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct CatalogSeal {
    seal_version: u32,
    catalog_version: String,
    schema_version: u32,
    sha256: String,
    size_bytes: u64,
    file_modified_unix_ns: u64,
    file_created_unix_ns: Option<u64>,
    file_readonly: bool,
}

impl CatalogSeal {
    fn from_catalog(path: &Path, manifest: &CatalogManifest) -> Result<Self, CatalogFailure> {
        let metadata = path.metadata().map_err(map_io_failure)?;
        Ok(Self {
            seal_version: SEAL_VERSION,
            catalog_version: manifest.catalog_version.clone(),
            schema_version: manifest.schema_version,
            sha256: manifest.sqlite_sha256.clone(),
            size_bytes: metadata.len(),
            file_modified_unix_ns: system_time_ns(metadata.modified().map_err(map_io_failure)?)?,
            file_created_unix_ns: metadata
                .created()
                .ok()
                .and_then(|value| system_time_ns(value).ok()),
            file_readonly: metadata.permissions().readonly(),
        })
    }

    fn matches(&self, path: &Path, manifest: &CatalogManifest) -> Result<bool, CatalogFailure> {
        let current = Self::from_catalog(path, manifest)?;
        Ok(self.seal_version == SEAL_VERSION
            && self.catalog_version == manifest.catalog_version
            && self.schema_version == manifest.schema_version
            && self.sha256 == manifest.sqlite_sha256
            && self.size_bytes == manifest.sqlite_size_bytes
            && self.size_bytes == current.size_bytes
            && self.file_modified_unix_ns == current.file_modified_unix_ns
            && self.file_created_unix_ns == current.file_created_unix_ns
            && self.file_readonly == current.file_readonly)
    }
}

fn fast_startup_validation(
    catalog: &Path,
    seal_path: &Path,
    manifest: &CatalogManifest,
) -> Result<bool, CatalogFailure> {
    let seal = match fs::read(seal_path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<CatalogSeal>(&bytes).ok())
    {
        Some(value) => value,
        None => return Ok(false),
    };
    if !seal.matches(catalog, manifest)? {
        return Ok(false);
    }
    Ok(open_validated_catalog(catalog, manifest).is_ok())
}

fn write_seal(
    seal_path: &Path,
    catalog: &Path,
    manifest: &CatalogManifest,
) -> Result<(), CatalogFailure> {
    let seal = CatalogSeal::from_catalog(catalog, manifest)?;
    let parent = seal_path.parent().ok_or(CatalogFailure::OpenFailed)?;
    let mut temporary = TempFileBuilder::new()
        .prefix(".catalog-seal-")
        .suffix(".tmp")
        .tempfile_in(parent)
        .map_err(map_io_failure)?;
    serde_json::to_writer(&mut temporary, &seal).map_err(|_| CatalogFailure::OpenFailed)?;
    temporary.write_all(b"\n").map_err(map_io_failure)?;
    temporary.flush().map_err(map_io_failure)?;
    temporary.as_file().sync_all().map_err(map_io_failure)?;
    if seal_path.exists() {
        fs::remove_file(seal_path).map_err(map_io_failure)?;
    }
    temporary
        .persist(seal_path)
        .map_err(|error| map_io_failure(error.error))?;
    sync_parent_directory(parent)?;
    Ok(())
}

fn activate_catalog(
    temporary: NamedTempFile,
    paths: &CatalogPaths,
    manifest: &CatalogManifest,
    system: &dyn CatalogSystem,
) -> Result<(), CatalogFailure> {
    let temporary = temporary.into_temp_path();
    let had_destination = paths.destination.exists();
    if had_destination {
        if paths.previous.exists() {
            system
                .remove_file(&paths.previous)
                .map_err(map_io_failure)?;
        }
        system
            .rename(&paths.destination, &paths.previous)
            .map_err(map_io_failure)?;
    }
    let has_rollback = had_destination || paths.previous.exists();

    if system.rename(&temporary, &paths.destination).is_err() {
        if has_rollback && system.rename(&paths.previous, &paths.destination).is_err() {
            return Err(CatalogFailure::RollbackFailed);
        }
        return Err(CatalogFailure::ActivationFailed);
    }
    sync_parent_directory(&paths.root)?;

    if open_validated_catalog(&paths.destination, manifest).is_err() {
        if system.remove_file(&paths.destination).is_err()
            || (has_rollback && system.rename(&paths.previous, &paths.destination).is_err())
        {
            return Err(CatalogFailure::RollbackFailed);
        }
        return Err(CatalogFailure::ActivationFailed);
    }
    Ok(())
}

fn cleanup_stale_temps(
    paths: &CatalogPaths,
    system: &dyn CatalogSystem,
) -> Result<(), CatalogFailure> {
    let prefix = format!(
        ".{}.install-",
        paths
            .destination
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
    );
    for entry in fs::read_dir(&paths.root).map_err(map_io_failure)? {
        let entry = entry.map_err(map_io_failure)?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with(&prefix) && name.ends_with(".tmp") && entry.path().is_file() {
            system.remove_file(&entry.path()).map_err(map_io_failure)?;
        }
    }
    Ok(())
}

fn sha256_file(
    path: &Path,
    expected_size: u64,
    start: u8,
    end: u8,
    mut on_progress: impl FnMut(u8),
) -> Result<String, CatalogFailure> {
    let mut file = File::open(path).map_err(map_io_failure)?;
    let mut digest = Sha256::new();
    // This path also runs on a Tokio blocking worker during catalog install
    // and recovery, so the large buffer must not live on that worker's stack.
    let mut buffer = vec![0_u8; 1024 * 1024];
    let mut read_total = 0_u64;
    let mut last_progress = start;
    loop {
        let bytes = file.read(&mut buffer).map_err(map_io_failure)?;
        if bytes == 0 {
            break;
        }
        digest.update(&buffer[..bytes]);
        read_total = read_total
            .checked_add(u64::try_from(bytes).map_err(|_| CatalogFailure::OpenFailed)?)
            .ok_or(CatalogFailure::OpenFailed)?;
        let progress = ranged_progress(read_total, expected_size, start, end);
        if progress > last_progress {
            last_progress = progress;
            on_progress(progress);
        }
    }
    Ok(format!("{:x}", digest.finalize()))
}

fn ranged_progress(completed: u64, total: u64, start: u8, end: u8) -> u8 {
    if total == 0 || end <= start {
        return end;
    }
    let width = u64::from(end - start);
    let scaled = completed.min(total).saturating_mul(width) / total;
    start.saturating_add(u8::try_from(scaled).unwrap_or(end - start))
}

fn system_time_ns(value: SystemTime) -> Result<u64, CatalogFailure> {
    let nanos = value
        .duration_since(UNIX_EPOCH)
        .map_err(|_| CatalogFailure::CatalogCorrupt)?
        .as_nanos();
    u64::try_from(nanos).map_err(|_| CatalogFailure::CatalogCorrupt)
}

fn sync_parent_directory(path: &Path) -> Result<(), CatalogFailure> {
    #[cfg(unix)]
    {
        File::open(path)
            .and_then(|directory| directory.sync_all())
            .map_err(map_io_failure)?;
    }
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}

struct InstallLock(File);

impl InstallLock {
    fn acquire(path: &Path) -> Result<Self, CatalogFailure> {
        let file = OpenOptions::new()
            .create(true)
            .read(true)
            .write(true)
            .truncate(false)
            .open(path)
            .map_err(map_io_failure)?;
        file.lock_exclusive().map_err(map_io_failure)?;
        Ok(Self(file))
    }
}

impl Drop for InstallLock {
    fn drop(&mut self) {
        let _ = FileExt::unlock(&self.0);
    }
}

trait CatalogSystem: Send + Sync {
    fn available_space(&self, path: &Path) -> io::Result<u64>;
    fn rename(&self, from: &Path, to: &Path) -> io::Result<()>;
    fn remove_file(&self, path: &Path) -> io::Result<()>;
}

struct RealCatalogSystem;

impl CatalogSystem for RealCatalogSystem {
    fn available_space(&self, path: &Path) -> io::Result<u64> {
        fs2::available_space(path)
    }

    fn rename(&self, from: &Path, to: &Path) -> io::Result<()> {
        fs::rename(from, to)
    }

    fn remove_file(&self, path: &Path) -> io::Result<()> {
        fs::remove_file(path)
    }
}

fn map_io_failure(error: io::Error) -> CatalogFailure {
    if error
        .raw_os_error()
        .is_some_and(|code| code == 28 || code == 112)
    {
        CatalogFailure::DiskFull
    } else {
        CatalogFailure::OpenFailed
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CatalogFailure {
    ActivationFailed,
    ArchiveChecksum,
    CatalogCorrupt,
    CatalogMissing,
    DecompressedChecksum,
    DecompressionFailed,
    DiskFull,
    OpenFailed,
    RollbackFailed,
    UnsafeResourceName,
    UnsupportedCatalog,
    UnsupportedManifest,
    WorkerFailed,
}

impl CatalogFailure {
    fn ipc_error(self) -> IpcError {
        match self {
            Self::CatalogMissing => IpcError::CatalogMissing,
            Self::ArchiveChecksum
            | Self::CatalogCorrupt
            | Self::DecompressedChecksum
            | Self::DecompressionFailed
            | Self::UnsafeResourceName
            | Self::UnsupportedCatalog
            | Self::UnsupportedManifest => IpcError::CatalogCorrupt,
            Self::DiskFull => IpcError::DiskFull,
            Self::RollbackFailed => IpcError::RecoveryFailed,
            Self::ActivationFailed | Self::OpenFailed => IpcError::OpenFailed,
            Self::WorkerFailed => IpcError::Internal,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{
        collections::BTreeMap,
        fs, io,
        path::{Path, PathBuf},
        sync::{atomic::AtomicUsize, Mutex},
    };

    use rusqlite::{params, Connection};
    use tempfile::TempDir;

    use super::*;

    const FIXTURE_SCHEMA: &str = include_str!("../../../../tools/catalog_export/schema.sql");

    struct RuntimeCatalogFixture {
        _directory: TempDir,
        root: PathBuf,
        sqlite: PathBuf,
        archive: PathBuf,
        manifest: CatalogManifest,
    }

    #[derive(Default)]
    struct RuntimeCatalogFixtureBuilder {
        database_catalog_version: Option<String>,
        database_schema_version: Option<u32>,
        jobs: u64,
        fts_jobs: Option<u64>,
    }

    impl RuntimeCatalogFixtureBuilder {
        fn new() -> Self {
            Self {
                jobs: 2,
                ..Self::default()
            }
        }

        fn database_schema_version(mut self, value: u32) -> Self {
            self.database_schema_version = Some(value);
            self
        }

        fn database_catalog_version(mut self, value: &str) -> Self {
            self.database_catalog_version = Some(value.to_owned());
            self
        }

        fn fts_jobs(mut self, value: u64) -> Self {
            self.fts_jobs = Some(value);
            self
        }

        fn build(self) -> RuntimeCatalogFixture {
            let directory = tempfile::tempdir().expect("fixture directory should be created");
            let root = directory.path().join("runtime");
            fs::create_dir_all(&root).expect("runtime directory should be created");
            let sqlite = directory.path().join("catalog-v1.sqlite");
            let archive = directory.path().join("catalog-v1.sqlite.zst");
            let connection = Connection::open(&sqlite).expect("fixture SQLite should open");
            connection
                .execute_batch(FIXTURE_SCHEMA)
                .expect("fixture schema should be valid");

            let catalog_version = self
                .database_catalog_version
                .unwrap_or_else(|| SUPPORTED_CATALOG_VERSION.to_owned());
            let schema_version = self
                .database_schema_version
                .unwrap_or(SUPPORTED_SCHEMA_VERSION);
            let metadata = BTreeMap::from([
                ("manifest_version", SUPPORTED_MANIFEST_VERSION.to_string()),
                ("catalog_version", catalog_version),
                ("schema_version", schema_version.to_string()),
                ("description_format", "plain_text".to_owned()),
                ("source_frozen_at", "2026-07-29T20:30:03Z".to_owned()),
                ("exported_at", "2026-07-31T11:09:37Z".to_owned()),
                ("canonical_jobs", self.jobs.to_string()),
                ("jobs_with_skills", "0".to_owned()),
                ("jobs_with_salary", "0".to_owned()),
                ("source_commit_sha", "a".repeat(40)),
                ("logical_checksum", "b".repeat(64)),
            ]);
            for (key, value) in metadata {
                connection
                    .execute(
                        "INSERT INTO catalog_meta(key, value) VALUES (?, ?)",
                        params![key, value],
                    )
                    .expect("fixture metadata should insert");
            }
            for id in 1..=self.jobs {
                let sqlite_id = i64::try_from(id).expect("fixture job id should fit SQLite");
                connection
                    .execute(
                        "INSERT INTO jobs (
                            id, source_job_id, title, title_normalized, company,
                            company_normalized, description_text, location_text, source,
                            source_url, attribution, snapshot_version
                         ) VALUES (?, ?, ?, ?, ?, ?, ?, '', 'fixture', ?, 'Fixture', '1')",
                        params![
                            sqlite_id,
                            format!("source-{id}"),
                            format!("Fixture job {id}"),
                            format!("fixture job {id}"),
                            "Fixture",
                            "fixture",
                            "Fixture description",
                            format!("https://example.test/jobs/{id}"),
                        ],
                    )
                    .expect("fixture job should insert");
            }
            let fts_jobs = self.fts_jobs.unwrap_or(self.jobs).min(self.jobs);
            let fts_jobs = i64::try_from(fts_jobs).expect("fixture FTS count should fit SQLite");
            connection
                .execute(
                    "INSERT INTO jobs_fts (
                        rowid, title, skills_text, company, location_text,
                        description_text, search_aliases
                     )
                     SELECT id, title, skills_text, company, location_text,
                            description_text, search_aliases
                     FROM jobs WHERE id <= ? ORDER BY id",
                    params![fts_jobs],
                )
                .expect("fixture FTS rows should insert");
            drop(connection);

            let sqlite_size_bytes = sqlite.metadata().expect("fixture metadata").len();
            let sqlite_sha256 = sha256_file(&sqlite, sqlite_size_bytes, 0, 1, |_| {})
                .expect("fixture SQLite should hash");
            let input = File::open(&sqlite).expect("fixture SQLite should open for compression");
            let output = File::create(&archive).expect("fixture archive should be created");
            zstd::stream::copy_encode(input, output, 1).expect("fixture archive should compress");
            let archive_size_bytes = archive.metadata().expect("archive metadata").len();
            let archive_sha256 = sha256_file(&archive, archive_size_bytes, 0, 1, |_| {})
                .expect("fixture archive should hash");
            let manifest = CatalogManifest {
                manifest_version: SUPPORTED_MANIFEST_VERSION,
                catalog_version: SUPPORTED_CATALOG_VERSION.to_owned(),
                schema_version: SUPPORTED_SCHEMA_VERSION,
                description_format: "plain_text".to_owned(),
                source_frozen_at: "2026-07-29T20:30:03Z".to_owned(),
                exported_at: "2026-07-31T11:09:37Z".to_owned(),
                published_at: None,
                canonical_jobs: self.jobs,
                jobs_with_skills: 0,
                jobs_with_salary: 0,
                source_commit_sha: "a".repeat(40),
                logical_checksum: "b".repeat(64),
                sqlite_file: "catalog-v1.sqlite".to_owned(),
                sqlite_size_bytes,
                sqlite_sha256,
                archive_file: "catalog-v1.sqlite.zst".to_owned(),
                archive_size_bytes,
                archive_sha256,
            };
            RuntimeCatalogFixture {
                _directory: directory,
                root,
                sqlite,
                archive,
                manifest,
            }
        }

        fn manifest_json() -> serde_json::Value {
            serde_json::from_str(CATALOG_MANIFEST_JSON).expect("embedded manifest JSON")
        }
    }

    struct TestSystem {
        available: u64,
        fail_rename_at: Option<usize>,
        rename_calls: AtomicUsize,
    }

    impl TestSystem {
        fn with_space(available: u64) -> Self {
            Self {
                available,
                fail_rename_at: None,
                rename_calls: AtomicUsize::new(0),
            }
        }
    }

    impl CatalogSystem for TestSystem {
        fn available_space(&self, _path: &Path) -> io::Result<u64> {
            Ok(self.available)
        }

        fn rename(&self, from: &Path, to: &Path) -> io::Result<()> {
            let call = self.rename_calls.fetch_add(1, Ordering::Relaxed) + 1;
            if self.fail_rename_at.is_some_and(|failure| call >= failure) {
                return Err(io::Error::new(io::ErrorKind::PermissionDenied, "injected"));
            }
            fs::rename(from, to)
        }

        fn remove_file(&self, path: &Path) -> io::Result<()> {
            fs::remove_file(path)
        }
    }

    fn test_paths(fixture: &RuntimeCatalogFixture) -> CatalogPaths {
        CatalogPaths::for_test(&fixture.root, &fixture.manifest, fixture.archive.clone())
    }

    fn generous_space() -> TestSystem {
        TestSystem::with_space(u64::MAX / 2)
    }

    fn no_progress(_: CatalogStatusKind, _: CatalogStage, _: u8) {}

    #[test]
    fn embedded_manifest_is_strict_complete_and_supported() {
        let manifest = CatalogManifest::parse(CATALOG_MANIFEST_JSON)
            .expect("embedded manifest should be supported");
        assert_eq!(manifest.catalog_version, "1");
        assert_eq!(manifest.canonical_jobs, 78_719);

        let mut unknown = RuntimeCatalogFixtureBuilder::manifest_json();
        unknown["unexpected"] = serde_json::json!(true);
        assert_eq!(
            CatalogManifest::parse(&unknown.to_string()),
            Err(CatalogFailure::UnsupportedManifest)
        );
    }

    #[test]
    fn manifest_rejects_unsupported_versions_and_resource_traversal() {
        for (field, replacement) in [
            ("manifest_version", serde_json::json!(2)),
            ("schema_version", serde_json::json!(2)),
            ("catalog_version", serde_json::json!("2")),
            (
                "source_frozen_at",
                serde_json::json!("2026-02-31T25:00:00Z"),
            ),
            ("sqlite_file", serde_json::json!("../catalog-v1.sqlite")),
            (
                "archive_file",
                serde_json::json!("resources/catalog-v1.sqlite.zst"),
            ),
            (
                "archive_file",
                serde_json::json!("C:\\catalog-v1.sqlite.zst"),
            ),
        ] {
            let mut manifest = RuntimeCatalogFixtureBuilder::manifest_json();
            manifest[field] = replacement;
            assert!(
                CatalogManifest::parse(&manifest.to_string()).is_err(),
                "{field}"
            );
        }
    }

    #[test]
    fn install_streams_valid_archive_writes_seal_and_uses_monotonic_progress() {
        let fixture = RuntimeCatalogFixtureBuilder::new().build();
        let paths = test_paths(&fixture);
        let samples = Mutex::new(Vec::new());
        let handle = install_catalog(
            &fixture.manifest,
            &paths,
            CatalogStatusKind::Initializing,
            &generous_space(),
            &|_, _, value| samples.lock().expect("samples lock").push(value),
        )
        .expect("fixture install should succeed");
        assert_eq!(handle.path, paths.destination);
        assert!(paths.destination.is_file());
        assert!(paths.seal.is_file());
        assert!(
            fast_startup_validation(&paths.destination, &paths.seal, &fixture.manifest)
                .expect("fast validation should run")
        );
        let samples = samples.lock().expect("samples lock");
        assert!(samples.windows(2).all(|window| window[0] <= window[1]));
    }

    #[test]
    fn archive_sha_mismatch_is_rejected_before_decompression() {
        let mut fixture = RuntimeCatalogFixtureBuilder::new().build();
        fixture.manifest.archive_sha256 = "0".repeat(64);
        let paths = test_paths(&fixture);
        assert_eq!(
            install_catalog(
                &fixture.manifest,
                &paths,
                CatalogStatusKind::Initializing,
                &generous_space(),
                &no_progress,
            ),
            Err(CatalogFailure::ArchiveChecksum)
        );
        assert!(!paths.destination.exists());
    }

    #[test]
    fn decompressed_sha_mismatch_is_rejected() {
        let mut fixture = RuntimeCatalogFixtureBuilder::new().build();
        fixture.manifest.sqlite_sha256 = "0".repeat(64);
        let paths = test_paths(&fixture);
        assert_eq!(
            install_catalog(
                &fixture.manifest,
                &paths,
                CatalogStatusKind::Initializing,
                &generous_space(),
                &no_progress,
            ),
            Err(CatalogFailure::DecompressedChecksum)
        );
    }

    #[test]
    fn unsupported_database_schema_and_fts_count_are_rejected() {
        let version = RuntimeCatalogFixtureBuilder::new()
            .database_catalog_version("2")
            .build();
        assert_eq!(
            validate_database_contract(&version.sqlite, &version.manifest, true),
            Err(CatalogFailure::UnsupportedCatalog)
        );
        let schema = RuntimeCatalogFixtureBuilder::new()
            .database_schema_version(2)
            .build();
        assert_eq!(
            validate_database_contract(&schema.sqlite, &schema.manifest, true),
            Err(CatalogFailure::UnsupportedCatalog)
        );
        let count = RuntimeCatalogFixtureBuilder::new().fts_jobs(1).build();
        assert_eq!(
            validate_database_contract(&count.sqlite, &count.manifest, true),
            Err(CatalogFailure::UnsupportedCatalog)
        );
    }

    #[test]
    fn disk_full_preflight_preserves_existing_catalog() {
        let fixture = RuntimeCatalogFixtureBuilder::new().build();
        let paths = test_paths(&fixture);
        fs::copy(&fixture.sqlite, &paths.destination).expect("old catalog should copy");
        let before = fs::read(&paths.destination).expect("old catalog should read");
        let system = TestSystem::with_space(0);
        assert_eq!(
            install_catalog(
                &fixture.manifest,
                &paths,
                CatalogStatusKind::Recovering,
                &system,
                &no_progress,
            ),
            Err(CatalogFailure::DiskFull)
        );
        assert_eq!(
            fs::read(&paths.destination).expect("old catalog remains"),
            before
        );
    }

    #[test]
    fn interrupted_install_restores_previous_and_removes_stale_temp() {
        let fixture = RuntimeCatalogFixtureBuilder::new().build();
        let paths = test_paths(&fixture);
        fs::copy(&fixture.sqlite, &paths.previous).expect("previous catalog should copy");
        let stale = paths.root.join(format!(
            ".{}.install-stale.tmp",
            fixture.manifest.sqlite_file
        ));
        fs::write(&stale, b"partial catalog").expect("stale temp should write");
        let handle = run_catalog_lifecycle(
            &fixture.manifest,
            &paths,
            None,
            false,
            &generous_space(),
            &no_progress,
        )
        .expect("previous catalog should recover");
        assert_eq!(handle.path, paths.destination);
        assert!(paths.destination.is_file());
        assert!(!paths.previous.exists());
        assert!(!stale.exists());
    }

    #[test]
    fn changed_metadata_forces_full_verification_instead_of_fast_open() {
        let fixture = RuntimeCatalogFixtureBuilder::new().build();
        let paths = test_paths(&fixture);
        fs::copy(&fixture.sqlite, &paths.destination).expect("catalog should copy");
        write_seal(&paths.seal, &paths.destination, &fixture.manifest).expect("seal should write");
        let mut bytes = fs::read(&paths.destination).expect("catalog should read");
        bytes.push(0);
        fs::write(&paths.destination, bytes).expect("catalog should mutate");
        assert!(
            !fast_startup_validation(&paths.destination, &paths.seal, &fixture.manifest)
                .expect("fast validation should run")
        );
    }

    #[test]
    fn final_rename_and_rollback_failure_is_closed_recovery_error() {
        let fixture = RuntimeCatalogFixtureBuilder::new().build();
        let paths = test_paths(&fixture);
        fs::copy(&fixture.sqlite, &paths.destination).expect("old catalog should copy");
        let system = TestSystem {
            available: u64::MAX / 2,
            fail_rename_at: Some(2),
            rename_calls: AtomicUsize::new(0),
        };
        assert_eq!(
            install_catalog(
                &fixture.manifest,
                &paths,
                CatalogStatusKind::Recovering,
                &system,
                &no_progress,
            ),
            Err(CatalogFailure::RollbackFailed)
        );
        assert_eq!(
            CatalogFailure::RollbackFailed.ipc_error(),
            IpcError::RecoveryFailed
        );
    }

    #[test]
    fn progress_range_is_bounded_and_monotonic() {
        assert_eq!(ranged_progress(0, 100, 10, 20), 10);
        assert_eq!(ranged_progress(50, 100, 10, 20), 15);
        assert_eq!(ranged_progress(100, 100, 10, 20), 20);
        assert_eq!(ranged_progress(200, 100, 10, 20), 20);
    }

    #[test]
    fn failure_status_exposes_only_closed_public_data() {
        let manifest =
            CatalogManifest::parse(CATALOG_MANIFEST_JSON).expect("embedded manifest should parse");
        let status = lifecycle_status(
            CatalogStatusKind::Error,
            None,
            68,
            Some(&manifest),
            Some(IpcError::CatalogCorrupt),
        );
        let wire = serde_json::to_value(status).expect("status should serialize");
        assert_eq!(wire["state"], serde_json::json!("error"));
        assert_eq!(
            wire["message"],
            serde_json::json!("The local catalog failed validation.")
        );
        assert!(!wire.to_string().contains(".sqlite"));
        assert!(!wire.to_string().contains("\\"));
    }

    #[test]
    #[ignore = "full 1 GB catalog hash and SQLite integrity gate"]
    fn frozen_catalog_passes_runtime_full_install_validation() {
        let manifest =
            CatalogManifest::parse(CATALOG_MANIFEST_JSON).expect("embedded manifest should parse");
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../.artifacts/catalog")
            .join(&manifest.sqlite_file);
        assert!(path.is_file(), "frozen catalog artifact is required");
        full_validate_catalog(
            &path,
            &manifest,
            true,
            CatalogStatusKind::Verifying,
            &no_progress,
        )
        .expect("frozen catalog should pass runtime full validation");
    }
}
