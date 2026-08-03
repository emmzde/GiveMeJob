use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};
use zeroize::Zeroizing;

#[cfg(feature = "m2-benchmark")]
mod benchmark;
mod catalog;
mod emmy;
mod ipc;
mod match_score;
mod original;
mod search;
mod support;
mod user;

use catalog::{readonly_connection, CatalogHandle, CatalogManager, CatalogStatus};
use emmy::{
    confirm_shortlist as confirm_emmy_shortlist, load_conversation as load_emmy_conversation,
    run_turn as run_emmy_turn, ClearProviderKeyRequest, CredentialManager, EmmyConfiguration,
    EmmyConfirmationRequest, EmmyConversation, EmmyConversationRequest, EmmyConversationSummary,
    EmmySendRequest, EmmyTurnResult, LlmError, LlmRouter, SetProviderKeyRequest,
};
use ipc::IpcError;
use match_score::{compute_match, JobMatch, MatchBatchRequest, MatchBreakdown};
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
use support::{open_support_with, SupportLink};
use user::{
    ProfileInput, SetShortlistInput, ShortlistRecord, ShortlistState, UserProfile, UserStore,
};

struct EmmyRouterState {
    router: Option<LlmRouter>,
}

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

#[tauri::command]
fn open_support_link(link: SupportLink) -> Result<(), IpcError> {
    open_support_with(link, |url| tauri_plugin_opener::open_url(url, None::<&str>))
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

#[tauri::command]
async fn get_profile(state: State<'_, UserStore>) -> Result<Option<UserProfile>, IpcError> {
    let store = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || store.get_profile())
        .await
        .map_err(|_| IpcError::Internal)?
}

#[tauri::command]
async fn save_profile(
    request: Value,
    state: State<'_, UserStore>,
) -> Result<UserProfile, IpcError> {
    let input: ProfileInput =
        serde_json::from_value(request).map_err(|_| IpcError::InvalidQuery)?;
    let store = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || store.save_profile(input))
        .await
        .map_err(|_| IpcError::Internal)?
}

#[tauri::command]
async fn list_shortlist(state: State<'_, UserStore>) -> Result<Vec<ShortlistRecord>, IpcError> {
    let store = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || store.list_shortlist())
        .await
        .map_err(|_| IpcError::Internal)?
}

#[tauri::command]
async fn is_shortlisted(
    job_id: Value,
    catalog_state: State<'_, CatalogManager>,
    user_state: State<'_, UserStore>,
) -> Result<bool, IpcError> {
    let job_id = parse_job_id(job_id)?;
    let catalog_version = catalog_state.inner().available_catalog()?.catalog_version;
    let store = user_state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || store.is_shortlisted(&job_id, &catalog_version))
        .await
        .map_err(|_| IpcError::Internal)?
}

#[tauri::command]
async fn set_shortlist(
    request: Value,
    catalog_state: State<'_, CatalogManager>,
    user_state: State<'_, UserStore>,
) -> Result<ShortlistState, IpcError> {
    let input: SetShortlistInput =
        serde_json::from_value(request).map_err(|_| IpcError::InvalidQuery)?;
    let catalog = catalog_state.inner().available_catalog()?;
    let store = user_state.inner().clone();
    run_catalog_handle_query(catalog, move |connection, catalog_version| {
        let exists: bool = connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM jobs WHERE id = ?1)",
                [input.job_id.as_i64()?],
                |row| row.get(0),
            )
            .map_err(|_| IpcError::CatalogCorrupt)?;
        if !exists {
            return Err(IpcError::NotFound);
        }
        store.set_shortlist(input, catalog_version)
    })
    .await
}

#[tauri::command]
async fn get_match_breakdown(
    job_id: Value,
    catalog_state: State<'_, CatalogManager>,
    user_state: State<'_, UserStore>,
) -> Result<Option<MatchBreakdown>, IpcError> {
    let job_id = parse_job_id(job_id)?;
    let store = user_state.inner().clone();
    run_catalog_query(catalog_state.inner().clone(), move |connection, _| {
        let Some(profile) = store.get_profile()? else {
            return Ok(None);
        };
        let job = get_job_detail(connection, &job_id)?;
        compute_match(&profile, &job).map(Some)
    })
    .await
}

#[tauri::command]
async fn get_match_breakdowns(
    request: Value,
    catalog_state: State<'_, CatalogManager>,
    user_state: State<'_, UserStore>,
) -> Result<Vec<JobMatch>, IpcError> {
    let request: MatchBatchRequest =
        serde_json::from_value(request).map_err(|_| IpcError::InvalidQuery)?;
    request.validate()?;
    let store = user_state.inner().clone();
    run_catalog_query(catalog_state.inner().clone(), move |connection, _| {
        let Some(profile) = store.get_profile()? else {
            return Ok(Vec::new());
        };
        request
            .job_ids
            .into_iter()
            .map(|job_id| {
                let job = get_job_detail(connection, &job_id)?;
                let breakdown = compute_match(&profile, &job)?;
                Ok(JobMatch { job_id, breakdown })
            })
            .collect()
    })
    .await
}

#[tauri::command]
fn emmy_configuration(
    credentials_state: State<'_, CredentialManager>,
    router_state: State<'_, EmmyRouterState>,
) -> Result<EmmyConfiguration, LlmError> {
    let mut configuration = credentials_state.configuration()?;
    if router_state.router.is_none() {
        configuration.available = false;
    }
    Ok(configuration)
}

#[tauri::command]
fn emmy_set_provider_key(
    request: Value,
    credentials_state: State<'_, CredentialManager>,
    router_state: State<'_, EmmyRouterState>,
) -> Result<EmmyConfiguration, LlmError> {
    let request: SetProviderKeyRequest =
        serde_json::from_value(request).map_err(|_| LlmError::InvalidRequest)?;
    request.validate()?;
    let SetProviderKeyRequest { provider, key } = request;
    let key = Zeroizing::new(key);
    credentials_state.set_byok(provider, key.trim())?;
    emmy_configuration(credentials_state, router_state)
}

#[tauri::command]
fn emmy_clear_provider_key(
    request: Value,
    credentials_state: State<'_, CredentialManager>,
    router_state: State<'_, EmmyRouterState>,
) -> Result<EmmyConfiguration, LlmError> {
    let request: ClearProviderKeyRequest =
        serde_json::from_value(request).map_err(|_| LlmError::InvalidRequest)?;
    credentials_state.clear_byok(request.provider)?;
    emmy_configuration(credentials_state, router_state)
}

#[tauri::command]
async fn emmy_list_conversations(
    state: State<'_, UserStore>,
) -> Result<Vec<EmmyConversationSummary>, LlmError> {
    let store = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || store.list_conversations())
        .await
        .map_err(|_| LlmError::Local)?
        .map_err(|_| LlmError::Local)
}

#[tauri::command]
async fn emmy_create_conversation(
    state: State<'_, UserStore>,
) -> Result<EmmyConversation, LlmError> {
    let store = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || store.create_conversation())
        .await
        .map_err(|_| LlmError::Local)?
        .map_err(|_| LlmError::Local)
}

#[tauri::command]
async fn emmy_load_conversation(
    request: Value,
    state: State<'_, UserStore>,
) -> Result<EmmyConversation, LlmError> {
    let request: EmmyConversationRequest =
        serde_json::from_value(request).map_err(|_| LlmError::InvalidRequest)?;
    load_emmy_conversation(request.conversation_id, state.inner().clone()).await
}

#[tauri::command]
async fn emmy_send_message(
    request: Value,
    app: AppHandle,
    catalog_state: State<'_, CatalogManager>,
    user_state: State<'_, UserStore>,
    router_state: State<'_, EmmyRouterState>,
) -> Result<EmmyTurnResult, LlmError> {
    let request: EmmySendRequest =
        serde_json::from_value(request).map_err(|_| LlmError::InvalidRequest)?;
    let catalog = catalog_state
        .inner()
        .available_catalog()
        .map_err(|_| LlmError::Local)?;
    let router = router_state
        .inner()
        .router
        .as_ref()
        .ok_or(LlmError::Unavailable)?;
    run_emmy_turn(
        request,
        catalog,
        user_state.inner().clone(),
        router,
        move |event| {
            let _ = app.emit("emmy://state", event);
        },
    )
    .await
}

#[tauri::command]
async fn emmy_confirm_shortlist(
    request: Value,
    app: AppHandle,
    catalog_state: State<'_, CatalogManager>,
    user_state: State<'_, UserStore>,
) -> Result<EmmyTurnResult, LlmError> {
    let request: EmmyConfirmationRequest =
        serde_json::from_value(request).map_err(|_| LlmError::InvalidRequest)?;
    let catalog = catalog_state
        .inner()
        .available_catalog()
        .map_err(|_| LlmError::Local)?;
    confirm_emmy_shortlist(request, catalog, user_state.inner().clone(), move |event| {
        let _ = app.emit("emmy://state", event);
    })
    .await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let manager = CatalogManager::from_app(app);
            let user_store = UserStore::from_app(app);
            let credentials = CredentialManager;
            let router = LlmRouter::new(std::sync::Arc::new(credentials.clone())).ok();
            app.manage(manager.clone());
            app.manage(user_store);
            app.manage(credentials);
            app.manage(EmmyRouterState { router });
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
            open_support_link,
            get_search_facets,
            get_filter_options,
            autocomplete_skills,
            autocomplete_locations,
            get_profile,
            save_profile,
            list_shortlist,
            is_shortlisted,
            set_shortlist,
            get_match_breakdown,
            get_match_breakdowns,
            emmy_configuration,
            emmy_set_provider_key,
            emmy_clear_provider_key,
            emmy_list_conversations,
            emmy_create_conversation,
            emmy_load_conversation,
            emmy_send_message,
            emmy_confirm_shortlist
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
