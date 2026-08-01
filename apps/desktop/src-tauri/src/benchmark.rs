use std::{
    collections::{BTreeMap, HashSet},
    env,
    fs::{self, File, OpenOptions},
    io::{BufReader, Read, Write},
    path::{Path, PathBuf},
    process::Command,
    time::{Instant, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::{
    catalog::CatalogHandle,
    execute_search_command,
    search::dto::{EmploymentType, RemoteMode, SearchQuery, SearchSort, Seniority},
};

const EXPECTED_WARMUPS: u32 = 5;
const EXPECTED_SAMPLES: u32 = 30;
const HARD_WARM_P95_MS: f64 = 300.0;
const HARD_COLD_MS: f64 = 500.0;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
enum BenchmarkCategory {
    Ru,
    En,
    Mixed,
    QuotedPhrase,
    Alias,
    FilterHeavy,
    ZeroTypo,
}

impl BenchmarkCategory {
    fn expected_count(self) -> usize {
        match self {
            Self::Ru | Self::En => 20,
            Self::Mixed | Self::QuotedPhrase | Self::Alias | Self::FilterHeavy | Self::ZeroTypo => {
                10
            }
        }
    }

    fn all() -> [Self; 7] {
        [
            Self::Ru,
            Self::En,
            Self::Mixed,
            Self::QuotedPhrase,
            Self::Alias,
            Self::FilterHeavy,
            Self::ZeroTypo,
        ]
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BenchmarkConfig {
    schema_version: u32,
    corpus_version: String,
    catalog_version: String,
    warmups: u32,
    samples: u32,
    default_limit: u32,
    cases: Vec<BenchmarkCase>,
}

impl BenchmarkConfig {
    fn parse(input: &str) -> Result<Self, String> {
        let config: Self = serde_json::from_str(input)
            .map_err(|error| format!("benchmark config is invalid: {error}"))?;
        config.validate()?;
        Ok(config)
    }

    fn validate(&self) -> Result<(), String> {
        if self.schema_version != 1 {
            return Err("benchmark schemaVersion must be 1".to_owned());
        }
        if self.corpus_version != "m2-search-benchmark-v1" {
            return Err("benchmark corpusVersion must be m2-search-benchmark-v1".to_owned());
        }
        if self.catalog_version.is_empty()
            || self.catalog_version.starts_with('0')
            || !self
                .catalog_version
                .bytes()
                .all(|value| value.is_ascii_digit())
        {
            return Err("benchmark catalogVersion must be a positive decimal string".to_owned());
        }
        if self.warmups != EXPECTED_WARMUPS || self.samples != EXPECTED_SAMPLES {
            return Err("benchmark requires exactly 5 warmups and 30 samples".to_owned());
        }
        if !(1..=50).contains(&self.default_limit) {
            return Err("benchmark defaultLimit must be between 1 and 50".to_owned());
        }

        let mut identifiers = HashSet::new();
        let mut category_counts = BTreeMap::new();
        for case in &self.cases {
            if case.id.trim().is_empty() || !identifiers.insert(case.id.as_str()) {
                return Err(format!(
                    "benchmark case ID is empty or duplicated: {}",
                    case.id
                ));
            }
            let query = case.to_query(self.default_limit);
            query
                .validate()
                .map_err(|_| format!("benchmark request is invalid: {}", case.id))?;
            *category_counts.entry(case.category).or_insert(0_usize) += 1;
        }
        for category in BenchmarkCategory::all() {
            let actual = category_counts.get(&category).copied().unwrap_or_default();
            let expected = category.expected_count();
            if actual != expected {
                return Err(format!(
                    "benchmark category {category:?} has {actual} cases; expected {expected}"
                ));
            }
        }
        if self.cases.len() != 90 {
            return Err(format!(
                "benchmark corpus has {} cases; expected 90",
                self.cases.len()
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BenchmarkCase {
    id: String,
    category: BenchmarkCategory,
    text: String,
    #[serde(default)]
    skills: Vec<String>,
    #[serde(default)]
    locations: Vec<String>,
    #[serde(default)]
    remote_modes: Vec<RemoteMode>,
    #[serde(default)]
    seniorities: Vec<Seniority>,
    #[serde(default)]
    employment_types: Vec<EmploymentType>,
    #[serde(default)]
    salary_min_usd_year: Option<f64>,
    #[serde(default)]
    salary_known_only: bool,
    #[serde(default)]
    sources: Vec<String>,
    #[serde(default)]
    sort: Option<SearchSort>,
}

impl BenchmarkCase {
    fn to_query(&self, limit: u32) -> SearchQuery {
        SearchQuery {
            text: self.text.clone(),
            skills: self.skills.clone(),
            locations: self.locations.clone(),
            remote_modes: self.remote_modes.clone(),
            seniorities: self.seniorities.clone(),
            employment_types: self.employment_types.clone(),
            salary_min_usd_year: self.salary_min_usd_year,
            salary_known_only: self.salary_known_only,
            sources: self.sources.clone(),
            sort: self.sort.unwrap_or(SearchSort::Relevance),
            limit,
            cursor: None,
        }
    }
}

#[derive(Debug)]
struct CliArgs {
    catalog: PathBuf,
    config: PathBuf,
    output: PathBuf,
}

impl CliArgs {
    fn parse() -> Result<Self, String> {
        Self::parse_from(env::args().skip(1))
    }

    fn parse_from(arguments: impl IntoIterator<Item = String>) -> Result<Self, String> {
        let arguments = arguments.into_iter().collect::<Vec<_>>();
        if arguments.len() != 6 {
            return Err(
                "usage: m2_benchmark --catalog <sqlite> --config <json> --output <json>".to_owned(),
            );
        }
        let mut catalog = None;
        let mut config = None;
        let mut output = None;
        for pair in arguments.chunks_exact(2) {
            let destination = match pair[0].as_str() {
                "--catalog" => &mut catalog,
                "--config" => &mut config,
                "--output" => &mut output,
                option => return Err(format!("unknown benchmark option: {option}")),
            };
            if destination.replace(PathBuf::from(&pair[1])).is_some() {
                return Err(format!("duplicate benchmark option: {}", pair[0]));
            }
        }
        Ok(Self {
            catalog: catalog.ok_or_else(|| "--catalog is required".to_owned())?,
            config: config.ok_or_else(|| "--config is required".to_owned())?,
            output: output.ok_or_else(|| "--output is required".to_owned())?,
        })
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HardwareFingerprint {
    os: String,
    cpu: String,
    ram_bytes: u64,
    architecture: String,
    disk: DiskFingerprint,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DiskFingerprint {
    model: String,
    media_type: String,
    bus_type: String,
    size_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TimingSummary {
    raw_timings_ms: Vec<f64>,
    p50_ms: f64,
    p95_ms: f64,
    max_ms: f64,
}

impl TimingSummary {
    fn from_samples(samples: Vec<f64>) -> Result<Self, String> {
        if samples.is_empty()
            || samples
                .iter()
                .any(|sample| !sample.is_finite() || *sample < 0.0)
        {
            return Err("timing samples must be non-empty finite values".to_owned());
        }
        let mut sorted = samples.clone();
        sorted.sort_by(f64::total_cmp);
        let p50_ms = percentile(&sorted, 0.50);
        let p95_ms = percentile(&sorted, 0.95);
        let max_ms = *sorted.last().expect("non-empty samples were checked");
        Ok(Self {
            raw_timings_ms: samples,
            p50_ms,
            p95_ms,
            max_ms,
        })
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct QueryReport {
    id: String,
    category: BenchmarkCategory,
    request: SearchQuery,
    first_page_total: Option<u64>,
    first_page_items: usize,
    timings: TimingSummary,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CategoryReport {
    category: BenchmarkCategory,
    query_count: usize,
    timings: TimingSummary,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CursorAudit {
    sort: &'static str,
    elapsed_ms: f64,
    expected_total: u64,
    visited: u64,
    unique: u64,
    pages: u64,
    duplicate_ids: u64,
    passed: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GateReport {
    warm_p95_limit_ms: f64,
    cold_limit_ms: f64,
    worst_query_id: String,
    worst_query_p95_ms: f64,
    cold_first_query_ms: f64,
    warm_passed: bool,
    cold_passed: bool,
    cursor_passed: bool,
    passed: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BenchmarkReport {
    report_schema_version: u32,
    generated_at_unix_ms: u128,
    runner_mode: &'static str,
    ipc_scope: &'static str,
    corpus_version: String,
    corpus_schema_version: u32,
    catalog_version: String,
    catalog_path: String,
    catalog_sha256: String,
    source_commit: String,
    worktree_dirty: bool,
    environment: HardwareFingerprint,
    warmups_per_query: u32,
    samples_per_query: u32,
    cold_first_query: TimingSummary,
    cursor_audit: CursorAudit,
    categories: Vec<CategoryReport>,
    queries: Vec<QueryReport>,
    aggregate_warm_timings: TimingSummary,
    gate: GateReport,
}

pub(super) fn run_cli() -> Result<bool, String> {
    if cfg!(debug_assertions) {
        return Err("the M2 benchmark runner must be compiled with --release".to_owned());
    }

    let arguments = CliArgs::parse()?;
    let config_text = fs::read_to_string(&arguments.config)
        .map_err(|error| format!("could not read benchmark config: {error}"))?;
    let config = BenchmarkConfig::parse(&config_text)?;
    ensure_catalog_file(&arguments.catalog)?;
    ensure_new_output(&arguments.output)?;
    let catalog_path = fs::canonicalize(&arguments.catalog)
        .map_err(|error| format!("could not resolve catalog path: {error}"))?;

    let environment = collect_hardware_fingerprint(&catalog_path)?;
    let (source_commit, worktree_dirty) = collect_git_fingerprint()?;
    let handle = CatalogHandle {
        path: catalog_path.clone(),
        catalog_version: config.catalog_version.clone(),
    };

    let first_case = config
        .cases
        .first()
        .ok_or_else(|| "benchmark corpus is empty".to_owned())?;
    let cold_request = first_case.to_query(config.default_limit);
    let (cold_elapsed, _) = measure_wire_request(&cold_request, &handle)?;
    let cold_first_query = TimingSummary::from_samples(vec![cold_elapsed])?;

    let cursor_audit = audit_cursor(&handle)?;
    let catalog_sha256 = sha256_file(&catalog_path)?;

    let mut query_reports = Vec::with_capacity(config.cases.len());
    let mut aggregate_samples = Vec::with_capacity(
        config.cases.len() * usize::try_from(config.samples).unwrap_or_default(),
    );
    let mut category_samples: BTreeMap<BenchmarkCategory, Vec<f64>> = BTreeMap::new();

    for case in &config.cases {
        let request = case.to_query(config.default_limit);
        for _ in 0..config.warmups {
            dispatch_search_wire(&request, &handle)?;
        }

        let mut samples = Vec::with_capacity(usize::try_from(config.samples).unwrap_or_default());
        let mut response_metadata = None;
        for _ in 0..config.samples {
            let (elapsed, response) = measure_wire_request(&request, &handle)?;
            response_metadata.get_or_insert_with(|| response_page_metadata(&response));
            samples.push(elapsed);
        }
        let (first_page_total, first_page_items) = response_metadata
            .transpose()?
            .ok_or_else(|| format!("benchmark {} produced no samples", case.id))?;
        aggregate_samples.extend(samples.iter().copied());
        category_samples
            .entry(case.category)
            .or_default()
            .extend(samples.iter().copied());
        query_reports.push(QueryReport {
            id: case.id.clone(),
            category: case.category,
            request,
            first_page_total,
            first_page_items,
            timings: TimingSummary::from_samples(samples)?,
        });
        println!("completed {} ({:?})", case.id, case.category);
    }

    let categories = BenchmarkCategory::all()
        .into_iter()
        .map(|category| {
            let samples = category_samples.remove(&category).unwrap_or_default();
            Ok(CategoryReport {
                category,
                query_count: config
                    .cases
                    .iter()
                    .filter(|case| case.category == category)
                    .count(),
                timings: TimingSummary::from_samples(samples)?,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    let aggregate_warm_timings = TimingSummary::from_samples(aggregate_samples)?;
    let worst_query = query_reports
        .iter()
        .max_by(|left, right| left.timings.p95_ms.total_cmp(&right.timings.p95_ms))
        .ok_or_else(|| "benchmark produced no query reports".to_owned())?;
    let warm_passed = worst_query.timings.p95_ms < HARD_WARM_P95_MS;
    let cold_passed = cold_first_query.max_ms < HARD_COLD_MS;
    let gate_passed = warm_passed && cold_passed && cursor_audit.passed;
    let gate = GateReport {
        warm_p95_limit_ms: HARD_WARM_P95_MS,
        cold_limit_ms: HARD_COLD_MS,
        worst_query_id: worst_query.id.clone(),
        worst_query_p95_ms: worst_query.timings.p95_ms,
        cold_first_query_ms: cold_first_query.max_ms,
        warm_passed,
        cold_passed,
        cursor_passed: cursor_audit.passed,
        passed: gate_passed,
    };
    let report = BenchmarkReport {
        report_schema_version: 1,
        generated_at_unix_ms: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "system clock is before Unix epoch".to_owned())?
            .as_millis(),
        runner_mode: "release",
        ipc_scope: "JSON request -> shared Tauri command core -> blocking read-only connection/search -> JSON response",
        corpus_version: config.corpus_version,
        corpus_schema_version: config.schema_version,
        catalog_version: config.catalog_version,
        catalog_path: catalog_path.display().to_string(),
        catalog_sha256,
        source_commit,
        worktree_dirty,
        environment,
        warmups_per_query: config.warmups,
        samples_per_query: config.samples,
        cold_first_query,
        cursor_audit,
        categories,
        queries: query_reports,
        aggregate_warm_timings,
        gate,
    };
    write_report(&arguments.output, &report)?;
    println!("wrote {}", arguments.output.display());
    Ok(gate_passed)
}

fn ensure_catalog_file(path: &Path) -> Result<(), String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("catalog is not readable at {}: {error}", path.display()))?;
    if !metadata.is_file() || metadata.len() == 0 {
        return Err(format!(
            "catalog is not a non-empty file: {}",
            path.display()
        ));
    }
    Ok(())
}

fn ensure_new_output(path: &Path) -> Result<(), String> {
    if path.exists() {
        return Err(format!(
            "benchmark output already exists: {}",
            path.display()
        ));
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("could not create report directory: {error}"))?;
    }
    Ok(())
}

fn collect_hardware_fingerprint(catalog: &Path) -> Result<HardwareFingerprint, String> {
    let script = r#"
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$os = Get-CimInstance Win32_OperatingSystem
$computer = Get-CimInstance Win32_ComputerSystem
$cpu = @(Get-CimInstance Win32_Processor | ForEach-Object { $_.Name.Trim() }) -join '; '
$driveMatch = [regex]::Match($env:GIVEMEJOB_BENCHMARK_CATALOG_PROBE_PATH, '[A-Za-z]:')
if (-not $driveMatch.Success) { throw 'Catalog drive letter was not found' }
$letter = $driveMatch.Value.Substring(0, 1)
$disk = Get-Partition -DriveLetter $letter -ErrorAction Stop | Get-Disk | Select-Object -First 1
$physical = Get-PhysicalDisk | Where-Object { [string]$_.DeviceId -eq [string]$disk.Number } | Select-Object -First 1
$media = if ($null -eq $physical) { 'Unknown' } else { [string]$physical.MediaType }
[pscustomobject]@{
        os = "Windows $($os.Version) build $($os.BuildNumber)"
  cpu = $cpu
  ramBytes = [uint64]$computer.TotalPhysicalMemory
  architecture = $env:PROCESSOR_ARCHITECTURE
  disk = [pscustomobject]@{
    model = [string]$disk.Model
    mediaType = $media
    busType = [string]$disk.BusType
    sizeBytes = [uint64]$disk.Size
  }
} | ConvertTo-Json -Compress -Depth 4
"#;
    let output = Command::new("powershell.exe")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            script,
        ])
        .env("GIVEMEJOB_BENCHMARK_CATALOG_PROBE_PATH", catalog)
        .output()
        .map_err(|error| format!("could not start hardware probe: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "hardware probe failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let fingerprint: HardwareFingerprint = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("hardware probe returned invalid JSON: {error}"))?;
    if fingerprint.os.trim().is_empty()
        || fingerprint.cpu.trim().is_empty()
        || fingerprint.ram_bytes == 0
        || fingerprint.disk.model.trim().is_empty()
        || fingerprint.disk.size_bytes == 0
    {
        return Err("hardware probe returned incomplete data".to_owned());
    }
    Ok(fingerprint)
}

fn collect_git_fingerprint() -> Result<(String, bool), String> {
    let commit = command_stdout("git", &["rev-parse", "HEAD"])?;
    let status = command_stdout("git", &["status", "--porcelain=v1"])?;
    if commit.len() != 40 || !commit.bytes().all(|value| value.is_ascii_hexdigit()) {
        return Err("git returned an invalid HEAD commit".to_owned());
    }
    Ok((commit.to_ascii_lowercase(), !status.is_empty()))
}

fn command_stdout(program: &str, arguments: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .args(arguments)
        .output()
        .map_err(|error| format!("could not run {program}: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "{program} failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    String::from_utf8(output.stdout)
        .map(|value| value.trim().to_owned())
        .map_err(|error| format!("{program} returned non-UTF-8 output: {error}"))
}

fn measure_wire_request(
    request: &SearchQuery,
    handle: &CatalogHandle,
) -> Result<(f64, Vec<u8>), String> {
    let started = Instant::now();
    let response = dispatch_search_wire(request, handle)?;
    Ok((started.elapsed().as_secs_f64() * 1_000.0, response))
}

fn dispatch_search_wire(request: &SearchQuery, handle: &CatalogHandle) -> Result<Vec<u8>, String> {
    let request_bytes = serde_json::to_vec(request)
        .map_err(|error| format!("could not serialize IPC request: {error}"))?;
    let request_value: Value = serde_json::from_slice(&request_bytes)
        .map_err(|error| format!("could not deserialize IPC request: {error}"))?;
    let response =
        tauri::async_runtime::block_on(execute_search_command(request_value, handle.clone()))
            .map_err(|error| format!("IPC search failed: {error:?}"))?;
    serde_json::to_vec(&response)
        .map_err(|error| format!("could not serialize IPC response: {error}"))
}

fn response_page_metadata(response: &[u8]) -> Result<(Option<u64>, usize), String> {
    let response: Value = serde_json::from_slice(response)
        .map_err(|error| format!("IPC response is invalid JSON: {error}"))?;
    let items = response
        .get("items")
        .and_then(Value::as_array)
        .ok_or_else(|| "IPC response has no items array".to_owned())?;
    let total = response.get("total").map(|value| {
        value
            .as_u64()
            .ok_or_else(|| "IPC response total is not an unsigned integer".to_owned())
    });
    Ok((total.transpose()?, items.len()))
}

fn audit_cursor(handle: &CatalogHandle) -> Result<CursorAudit, String> {
    let started = Instant::now();
    let mut request = SearchQuery {
        text: String::new(),
        skills: Vec::new(),
        locations: Vec::new(),
        remote_modes: Vec::new(),
        seniorities: Vec::new(),
        employment_types: Vec::new(),
        salary_min_usd_year: None,
        salary_known_only: false,
        sources: Vec::new(),
        sort: SearchSort::Newest,
        limit: 50,
        cursor: None,
    };
    let mut expected_total = None;
    let mut visited = 0_u64;
    let mut pages = 0_u64;
    let mut duplicate_ids = 0_u64;
    let mut identifiers = HashSet::new();
    let mut seen_cursors = HashSet::new();

    loop {
        let response = dispatch_search_wire(&request, handle)?;
        let response: Value = serde_json::from_slice(&response)
            .map_err(|error| format!("cursor audit response is invalid JSON: {error}"))?;
        let items = response
            .get("items")
            .and_then(Value::as_array)
            .ok_or_else(|| "cursor audit response has no items".to_owned())?;
        if pages == 0 {
            expected_total = response.get("total").and_then(Value::as_u64);
        } else if response.get("total").is_some() {
            return Err("cursor audit received total after the first page".to_owned());
        }
        for item in items {
            let id = item
                .get("id")
                .and_then(Value::as_str)
                .ok_or_else(|| "cursor audit item has no string JobId".to_owned())?;
            visited += 1;
            if !identifiers.insert(id.to_owned()) {
                duplicate_ids += 1;
            }
        }
        pages += 1;
        if pages.is_multiple_of(100) {
            println!("cursor audit: {pages} pages, {visited} jobs");
        }
        let Some(cursor) = response.get("nextCursor").and_then(Value::as_str) else {
            break;
        };
        if !seen_cursors.insert(cursor.to_owned()) {
            return Err("cursor audit detected a cursor loop".to_owned());
        }
        request.cursor = Some(cursor.to_owned());
        if pages > 2_000 {
            return Err("cursor audit exceeded its 2,000-page safety bound".to_owned());
        }
    }
    let expected_total =
        expected_total.ok_or_else(|| "cursor audit first page omitted total".to_owned())?;
    let unique =
        u64::try_from(identifiers.len()).map_err(|_| "cursor count overflow".to_owned())?;
    Ok(CursorAudit {
        sort: "newest",
        elapsed_ms: started.elapsed().as_secs_f64() * 1_000.0,
        expected_total,
        visited,
        unique,
        pages,
        duplicate_ids,
        passed: duplicate_ids == 0 && visited == expected_total && unique == expected_total,
    })
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let file =
        File::open(path).map_err(|error| format!("could not open catalog for SHA-256: {error}"))?;
    let mut reader = BufReader::with_capacity(1024 * 1024, file);
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; 1024 * 1024];
    loop {
        let read = reader
            .read(&mut buffer)
            .map_err(|error| format!("could not read catalog for SHA-256: {error}"))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn percentile(sorted_samples: &[f64], percentile: f64) -> f64 {
    let index = ((sorted_samples.len() as f64 * percentile).ceil() as usize).saturating_sub(1);
    sorted_samples[index]
}

fn write_report(path: &Path, report: &BenchmarkReport) -> Result<(), String> {
    let payload = serde_json::to_vec_pretty(report)
        .map_err(|error| format!("could not serialize benchmark report: {error}"))?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| format!("could not create benchmark report: {error}"))?;
    file.write_all(&payload)
        .and_then(|()| file.write_all(b"\n"))
        .and_then(|()| file.sync_all())
        .map_err(|error| format!("could not persist benchmark report: {error}"))
}

#[cfg(test)]
mod tests {
    use super::{
        percentile, BenchmarkCategory, BenchmarkConfig, CliArgs, TimingSummary, EXPECTED_SAMPLES,
        EXPECTED_WARMUPS,
    };

    const BENCHMARK_CONFIG: &str = include_str!("../../../../config/search/benchmark-v1.json");

    #[test]
    fn versioned_corpus_has_exact_required_categories_and_run_counts() {
        let config = BenchmarkConfig::parse(BENCHMARK_CONFIG).expect("benchmark config");
        assert_eq!(config.warmups, EXPECTED_WARMUPS);
        assert_eq!(config.samples, EXPECTED_SAMPLES);
        assert_eq!(config.cases.len(), 90);
        for category in BenchmarkCategory::all() {
            assert_eq!(
                config
                    .cases
                    .iter()
                    .filter(|case| case.category == category)
                    .count(),
                category.expected_count(),
                "{category:?}"
            );
        }
    }

    #[test]
    fn config_validation_rejects_duplicate_ids_and_changed_sample_contract() {
        let mut config = BenchmarkConfig::parse(BENCHMARK_CONFIG).expect("benchmark config");
        config.cases[1].id = config.cases[0].id.clone();
        assert!(config.validate().is_err());

        let mut config = BenchmarkConfig::parse(BENCHMARK_CONFIG).expect("benchmark config");
        config.samples = 29;
        assert!(config.validate().is_err());
    }

    #[test]
    fn filter_case_maps_to_the_strict_search_contract() {
        let config = BenchmarkConfig::parse(BENCHMARK_CONFIG).expect("benchmark config");
        let case = config
            .cases
            .iter()
            .find(|case| case.id == "filter-01")
            .expect("filter case");
        let query = case.to_query(config.default_limit);
        assert_eq!(query.limit, 40);
        assert_eq!(query.locations, ["US", "CA"]);
        assert!(query.salary_known_only);
        assert_eq!(query.salary_min_usd_year, Some(100_000.0));
    }

    #[test]
    fn timing_summary_uses_nearest_rank_percentiles_and_preserves_raw_order() {
        let raw = (1..=30).rev().map(f64::from).collect::<Vec<_>>();
        let summary = TimingSummary::from_samples(raw.clone()).expect("timing summary");
        assert_eq!(summary.raw_timings_ms, raw);
        assert_eq!(summary.p50_ms, 15.0);
        assert_eq!(summary.p95_ms, 29.0);
        assert_eq!(summary.max_ms, 30.0);
        assert_eq!(percentile(&[1.0, 2.0, 3.0], 0.95), 3.0);
    }

    #[test]
    fn cli_requires_each_path_once() {
        let arguments = [
            "--output",
            "report.json",
            "--catalog",
            "catalog.sqlite",
            "--config",
            "benchmark.json",
        ]
        .map(str::to_owned);
        let parsed = CliArgs::parse_from(arguments).expect("valid CLI");
        assert_eq!(parsed.catalog.to_string_lossy(), "catalog.sqlite");

        let duplicated = [
            "--catalog",
            "a.sqlite",
            "--catalog",
            "b.sqlite",
            "--output",
            "report.json",
        ]
        .map(str::to_owned);
        assert!(CliArgs::parse_from(duplicated).is_err());
    }
}
