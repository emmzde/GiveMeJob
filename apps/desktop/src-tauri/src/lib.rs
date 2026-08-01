use serde_json::Value;
use tauri::{Manager, State};

#[cfg(feature = "m2-benchmark")]
mod benchmark;
mod catalog;
mod ipc;
mod original;
mod search;

use catalog::{readonly_connection, CatalogHandle, CatalogManager, CatalogStatus};
use ipc::IpcError;
use original::open_original_with;
use search::dto::{
    AutocompleteRequest, FilterOptions, JobDetail, JobId, JobSummary, LocationSuggestion,
    SearchFacets, SearchPage, SearchQuery, SkillSuggestion,
};
use search::{
    autocomplete_locations as search_location_suggestions,
    autocomplete_skills as search_skill_suggestions, get_facets,
    get_filter_options as load_filter_options, get_job_detail, search_catalog,
};

async fn run_catalog_query<T, F>(manager: CatalogManager, operation: F) -> Result<T, IpcError>
where
    T: Send + 'static,
    F: FnOnce(&rusqlite::Connection, &str) -> Result<T, IpcError> + Send + 'static,
{
    let catalog = manager.available_catalog()?;
    run_catalog_handle_query(catalog, operation).await
}

async fn run_catalog_handle_query<T, F>(catalog: CatalogHandle, operation: F) -> Result<T, IpcError>
where
    T: Send + 'static,
    F: FnOnce(&rusqlite::Connection, &str) -> Result<T, IpcError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || {
        let connection = readonly_connection(&catalog.path)?;
        operation(&connection, &catalog.catalog_version)
    })
    .await
    .map_err(|_| IpcError::Internal)?
}

#[tauri::command]
fn catalog_status(state: State<'_, CatalogManager>) -> CatalogStatus {
    state.status()
}

#[tauri::command]
async fn recover_catalog(state: State<'_, CatalogManager>) -> Result<CatalogStatus, IpcError> {
    state.inner().recover().await
}

#[tauri::command]
async fn search_jobs(
    request: Value,
    state: State<'_, CatalogManager>,
) -> Result<SearchPage<JobSummary>, IpcError> {
    let catalog = state.inner().available_catalog()?;
    execute_search_command(request, catalog).await
}

async fn execute_search_command(
    request: Value,
    catalog: CatalogHandle,
) -> Result<SearchPage<JobSummary>, IpcError> {
    let request: SearchQuery =
        serde_json::from_value(request).map_err(|_| IpcError::InvalidQuery)?;
    request.validate()?;
    run_catalog_handle_query(catalog, move |connection, catalog_version| {
        search_catalog(connection, &request, catalog_version)
    })
    .await
}

#[cfg(feature = "m2-benchmark")]
pub fn run_m2_benchmark_cli() -> Result<bool, String> {
    benchmark::run_cli()
}

#[tauri::command]
async fn get_job(id: Value, state: State<'_, CatalogManager>) -> Result<JobDetail, IpcError> {
    let id = parse_job_id(id)?;
    run_catalog_query(state.inner().clone(), move |connection, _| {
        get_job_detail(connection, &id)
    })
    .await
}

#[tauri::command]
async fn open_original(job_id: Value, state: State<'_, CatalogManager>) -> Result<(), IpcError> {
    let id = parse_job_id(job_id)?;
    run_catalog_query(state.inner().clone(), move |connection, _| {
        open_original_with(connection, &id, |url| {
            tauri_plugin_opener::open_url(url, None::<&str>)
        })
    })
    .await
}

fn parse_job_id(id: Value) -> Result<JobId, IpcError> {
    serde_json::from_value(id).map_err(|_| IpcError::InvalidQuery)
}

#[tauri::command]
async fn get_search_facets(state: State<'_, CatalogManager>) -> Result<SearchFacets, IpcError> {
    run_catalog_query(state.inner().clone(), move |connection, _| {
        get_facets(connection)
    })
    .await
}

#[tauri::command]
async fn get_filter_options(state: State<'_, CatalogManager>) -> Result<FilterOptions, IpcError> {
    run_catalog_query(state.inner().clone(), move |connection, _| {
        load_filter_options(connection)
    })
    .await
}

#[tauri::command]
async fn autocomplete_skills(
    request: Value,
    state: State<'_, CatalogManager>,
) -> Result<Vec<SkillSuggestion>, IpcError> {
    let request: AutocompleteRequest =
        serde_json::from_value(request).map_err(|_| IpcError::InvalidQuery)?;
    request.validate_and_normalize()?;
    run_catalog_query(state.inner().clone(), move |connection, _| {
        search_skill_suggestions(connection, &request)
    })
    .await
}

#[tauri::command]
async fn autocomplete_locations(
    request: Value,
    state: State<'_, CatalogManager>,
) -> Result<Vec<LocationSuggestion>, IpcError> {
    let request: AutocompleteRequest =
        serde_json::from_value(request).map_err(|_| IpcError::InvalidQuery)?;
    request.validate_and_normalize()?;
    run_catalog_query(state.inner().clone(), move |connection, _| {
        search_location_suggestions(connection, &request)
    })
    .await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let manager = CatalogManager::from_app(app);
            app.manage(manager.clone());
            if let Some(window) = app.get_webview_window("main") {
                window.show()?;
            }
            manager.initialize_background();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            catalog_status,
            recover_catalog,
            search_jobs,
            get_job,
            open_original,
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

    use super::parse_job_id;
    use crate::ipc::IpcError;

    #[test]
    fn job_id_is_validated_before_commands_can_reach_sql() {
        for invalid in [json!(1), json!("01"), json!("+1"), json!("1 OR 1=1")] {
            assert_eq!(parse_job_id(invalid), Err(IpcError::InvalidQuery));
        }
        assert_eq!(
            parse_job_id(json!("42"))
                .expect("positive decimal ID should be valid")
                .as_str(),
            "42"
        );
    }
}
