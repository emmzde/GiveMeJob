use std::collections::BTreeSet;

use reqwest::Url;
use schemars::JsonSchema;
use serde::{de::Error as _, Deserialize, Deserializer, Serialize};

use crate::{
    ipc::IpcError,
    match_score::MatchBreakdown,
    search::dto::{EmploymentType, JobId, JobSummary, SearchQuery},
};

pub(crate) const MAX_CONTEXT_MESSAGES: usize = 12;
pub(crate) const MAX_TOOL_STEPS: usize = 4;
pub(crate) const MAX_CHAT_TEXT_LENGTH: usize = 4_000;
pub(crate) const MAX_CONVERSATION_MEMORY_LENGTH: usize = 4_000;
pub(crate) const MAX_JOB_CARDS: usize = 8;
pub(crate) const MAX_QUICK_REPLIES: usize = 4;
pub(crate) const MAX_CONVERSATION_MESSAGES: usize = 500;
pub(crate) const RECENT_CONVERSATION_LIMIT: usize = 8;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub(crate) enum EmmyState {
    Idle,
    Listening,
    Thinking,
    Searching,
    Success,
    Empty,
    Error,
    Offline,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub(crate) enum EmmyProvider {
    Groq,
    Gemini,
    Openrouter,
    Cerebras,
    Custom,
}

impl EmmyProvider {
    pub(crate) const ALL: [Self; 4] = [Self::Groq, Self::Gemini, Self::Openrouter, Self::Cerebras];

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Groq => "groq",
            Self::Gemini => "gemini",
            Self::Openrouter => "openrouter",
            Self::Cerebras => "cerebras",
            Self::Custom => "custom",
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub(crate) enum EmmyMessageRole {
    User,
    Assistant,
    Tool,
}

impl EmmyMessageRole {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::User => "user",
            Self::Assistant => "assistant",
            Self::Tool => "tool",
        }
    }

    pub(crate) fn parse(value: &str) -> Result<Self, IpcError> {
        match value {
            "user" => Ok(Self::User),
            "assistant" => Ok(Self::Assistant),
            "tool" => Ok(Self::Tool),
            _ => Err(IpcError::UserDataUnavailable),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EmmyJobSnapshot {
    pub(crate) summary: JobSummary,
    pub(crate) employment_type: Option<EmploymentType>,
    pub(crate) salary_usd_year: Option<f64>,
    pub(crate) skills: Vec<String>,
    pub(crate) description_excerpt: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EmmyComparisonRow {
    pub(crate) job: EmmyJobSnapshot,
    pub(crate) match_breakdown: Option<MatchBreakdown>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EmmyComparison {
    pub(crate) rows: Vec<EmmyComparisonRow>,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ShortlistConfirmationStatus {
    Pending,
    Confirmed,
    Cancelled,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ShortlistPreview {
    pub(crate) confirmation_id: String,
    pub(crate) job: JobSummary,
    pub(crate) saved: bool,
    pub(crate) status: ShortlistConfirmationStatus,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct JobToolArgs {
    pub(crate) job_id: JobId,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CompareJobsArgs {
    pub(crate) job_ids: Vec<JobId>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SetShortlistArgs {
    pub(crate) job_id: JobId,
    pub(crate) saved: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, JsonSchema)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum EmmyToolResult {
    SearchJobs {
        items: Vec<JobSummary>,
        total: Option<u64>,
    },
    GetJob {
        job: EmmyJobSnapshot,
    },
    CompareJobs {
        comparison: EmmyComparison,
    },
    GetMatchBreakdown {
        job_id: JobId,
        breakdown: Option<MatchBreakdown>,
    },
    SetShortlist {
        preview: ShortlistPreview,
    },
}

impl EmmyToolResult {
    pub(crate) fn job_cards(&self) -> Vec<JobSummary> {
        match self {
            Self::SearchJobs { items, .. } => items.clone(),
            Self::GetJob { job } => vec![job.summary.clone()],
            Self::CompareJobs { comparison } => comparison
                .rows
                .iter()
                .map(|row| row.job.summary.clone())
                .collect(),
            Self::GetMatchBreakdown { .. } => Vec::new(),
            Self::SetShortlist { preview } => vec![preview.job.clone()],
        }
    }

    pub(crate) fn comparison(&self) -> Option<EmmyComparison> {
        match self {
            Self::CompareJobs { comparison } => Some(comparison.clone()),
            _ => None,
        }
    }

    pub(crate) fn is_empty_search(&self) -> bool {
        matches!(self, Self::SearchJobs { items, .. } if items.is_empty())
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, JsonSchema)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum EmmyMessageContent {
    User {
        text: String,
    },
    Assistant {
        text: String,
        job_cards: Vec<JobSummary>,
        quick_replies: Vec<String>,
        comparison: Option<EmmyComparison>,
    },
    Notice {
        error: LlmError,
    },
    Tool {
        call: Box<EmmyToolCall>,
        result: Box<EmmyToolResult>,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EmmyMessage {
    pub(crate) id: String,
    pub(crate) conversation_id: String,
    pub(crate) role: EmmyMessageRole,
    pub(crate) content: EmmyMessageContent,
    pub(crate) created_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EmmyConversationSummary {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EmmyConversation {
    pub(crate) conversation: EmmyConversationSummary,
    pub(crate) messages: Vec<EmmyMessage>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EmmyResponse {
    pub(crate) message: String,
    pub(crate) job_cards: Vec<JobId>,
    pub(crate) quick_replies: Vec<String>,
    pub(crate) mascot_state: EmmyState,
    pub(crate) conversation_memory: String,
}

impl EmmyResponse {
    pub(crate) fn validate(&self) -> Result<(), LlmError> {
        let message_length = self.message.trim().chars().count();
        let memory_length = self.conversation_memory.trim().chars().count();
        if message_length == 0
            || message_length > MAX_CHAT_TEXT_LENGTH
            || memory_length == 0
            || memory_length > MAX_CONVERSATION_MEMORY_LENGTH
            || self.job_cards.len() > MAX_JOB_CARDS
            || self.quick_replies.len() > MAX_QUICK_REPLIES
            || self.quick_replies.iter().any(|reply| {
                let length = reply.trim().chars().count();
                length == 0 || length > 100
            })
        {
            return Err(LlmError::Schema);
        }
        let unique_cards = self
            .job_cards
            .iter()
            .map(JobId::as_str)
            .collect::<BTreeSet<_>>();
        if unique_cards.len() != self.job_cards.len()
            || matches!(
                self.mascot_state,
                EmmyState::Listening | EmmyState::Thinking | EmmyState::Searching
            )
        {
            return Err(LlmError::Schema);
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, JsonSchema)]
#[serde(
    tag = "name",
    content = "args",
    rename_all = "snake_case",
    deny_unknown_fields
)]
pub(crate) enum EmmyToolCall {
    SearchJobs(SearchQuery),
    GetJob(JobToolArgs),
    CompareJobs(CompareJobsArgs),
    GetMatchBreakdown(JobToolArgs),
    SetShortlist(SetShortlistArgs),
}

impl EmmyToolCall {
    pub(crate) fn name(&self) -> &'static str {
        match self {
            Self::SearchJobs(_) => "search_jobs",
            Self::GetJob(_) => "get_job",
            Self::CompareJobs(_) => "compare_jobs",
            Self::GetMatchBreakdown(_) => "get_match_breakdown",
            Self::SetShortlist(_) => "set_shortlist",
        }
    }

    pub(crate) fn validate(&self) -> Result<(), LlmError> {
        match self {
            Self::SearchJobs(query) => query.validate().map_err(|_| LlmError::Schema),
            Self::GetJob(_) | Self::GetMatchBreakdown(_) | Self::SetShortlist(_) => Ok(()),
            Self::CompareJobs(args) => {
                let unique = args
                    .job_ids
                    .iter()
                    .map(JobId::as_str)
                    .collect::<BTreeSet<_>>();
                if (2..=4).contains(&args.job_ids.len()) && unique.len() == args.job_ids.len() {
                    Ok(())
                } else {
                    Err(LlmError::Schema)
                }
            }
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, JsonSchema)]
#[serde(
    tag = "type",
    content = "payload",
    rename_all = "snake_case",
    deny_unknown_fields
)]
pub(crate) enum EmmyModelOutput {
    Response(EmmyResponse),
    ToolCall(EmmyToolCall),
}

impl EmmyModelOutput {
    pub(crate) fn validate(&self) -> Result<(), LlmError> {
        match self {
            Self::Response(response) => response.validate(),
            Self::ToolCall(call) => call.validate(),
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq, JsonSchema)]
#[serde(
    tag = "code",
    rename_all = "snake_case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum LlmError {
    RateLimit { retry_after_seconds: Option<u64> },
    Timeout,
    Transport,
    Schema,
    Unavailable,
    ToolLimit,
    InvalidRequest,
    Local,
}

impl<'de> Deserialize<'de> for LlmError {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = serde_json::Value::deserialize(deserializer)?;
        let object = value
            .as_object()
            .ok_or_else(|| D::Error::custom("LLM error must be an object"))?;
        let code = object
            .get("code")
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| D::Error::custom("LLM error code is required"))?;
        if code == "rate_limit" {
            if object.len() != 2 || !object.contains_key("retryAfterSeconds") {
                return Err(D::Error::custom("rate_limit fields are invalid"));
            }
            let retry_after_seconds = match object.get("retryAfterSeconds") {
                Some(serde_json::Value::Null) => None,
                Some(serde_json::Value::Number(number)) => number
                    .as_u64()
                    .map(Some)
                    .ok_or_else(|| D::Error::custom("retryAfterSeconds must be unsigned"))?,
                _ => return Err(D::Error::custom("retryAfterSeconds is invalid")),
            };
            return Ok(Self::RateLimit {
                retry_after_seconds,
            });
        }
        if object.len() != 1 {
            return Err(D::Error::custom("LLM error has unknown fields"));
        }
        match code {
            "timeout" => Ok(Self::Timeout),
            "transport" => Ok(Self::Transport),
            "schema" => Ok(Self::Schema),
            "unavailable" => Ok(Self::Unavailable),
            "tool_limit" => Ok(Self::ToolLimit),
            "invalid_request" => Ok(Self::InvalidRequest),
            "local" => Ok(Self::Local),
            _ => Err(D::Error::custom("unknown LLM error code")),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EmmyTurnResult {
    pub(crate) conversation_id: String,
    pub(crate) messages: Vec<EmmyMessage>,
    pub(crate) state: EmmyState,
    pub(crate) provider: Option<EmmyProvider>,
    pub(crate) error: Option<LlmError>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EmmySendRequest {
    pub(crate) conversation_id: Option<String>,
    pub(crate) text: String,
}

impl EmmySendRequest {
    pub(crate) fn validate_and_normalize(mut self) -> Result<Self, LlmError> {
        self.text = self.text.trim().to_owned();
        if self.text.is_empty() || self.text.chars().count() > MAX_CHAT_TEXT_LENGTH {
            return Err(LlmError::InvalidRequest);
        }
        if self
            .conversation_id
            .as_deref()
            .is_some_and(|id| !valid_local_id(id))
        {
            return Err(LlmError::InvalidRequest);
        }
        Ok(self)
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EmmyConversationRequest {
    pub(crate) conversation_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EmmyConfirmationRequest {
    pub(crate) conversation_id: String,
    pub(crate) confirmation_id: String,
    pub(crate) confirmed: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EmmyProviderConfiguration {
    pub(crate) provider: EmmyProvider,
    pub(crate) configured: bool,
    pub(crate) byok_configured: bool,
    pub(crate) demo_available: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EmmyConfiguration {
    pub(crate) available: bool,
    pub(crate) providers: Vec<EmmyProviderConfiguration>,
    pub(crate) custom_api: Option<CustomApiConfiguration>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CustomApiConfiguration {
    pub(crate) base_url: String,
    pub(crate) model: String,
    pub(crate) key_configured: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SetCustomApiRequest {
    pub(crate) base_url: String,
    pub(crate) model: String,
    pub(crate) key: String,
    pub(crate) replace_key: bool,
}

impl SetCustomApiRequest {
    pub(crate) fn validate(&self) -> Result<(), LlmError> {
        let base_url = self.base_url.trim();
        let model = self.model.trim();
        let key = self.key.trim();
        let url = Url::parse(base_url).map_err(|_| LlmError::InvalidRequest)?;
        let valid_url = matches!(url.scheme(), "http" | "https")
            && url.host_str().is_some()
            && url.username().is_empty()
            && url.password().is_none()
            && base_url.chars().count() <= 2_048;
        let valid_model = (1..=200).contains(&model.chars().count());
        let valid_key = key.chars().count() <= 512;
        if valid_url && valid_model && valid_key {
            Ok(())
        } else {
            Err(LlmError::InvalidRequest)
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SetProviderKeyRequest {
    pub(crate) provider: EmmyProvider,
    pub(crate) key: String,
}

impl SetProviderKeyRequest {
    pub(crate) fn validate(&self) -> Result<(), LlmError> {
        let length = self.key.trim().chars().count();
        if (8..=512).contains(&length) {
            Ok(())
        } else {
            Err(LlmError::InvalidRequest)
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ClearProviderKeyRequest {
    pub(crate) provider: EmmyProvider,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EmmyStateEvent {
    pub(crate) state: EmmyState,
    pub(crate) tool: Option<String>,
    pub(crate) step: u8,
}

pub(crate) fn valid_local_id(value: &str) -> bool {
    value.len() == 32 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{EmmyModelOutput, EmmyProvider, EmmyToolCall, LlmError};

    #[test]
    fn strict_model_output_accepts_only_closed_response_shape() {
        let value = json!({
            "type": "response",
            "payload": {
                "message": "Нашла три вакансии.",
                "jobCards": ["1", "2"],
                "quickReplies": ["Сравни их"],
                "mascotState": "success",
                "conversationMemory": "Пользователь ищет Rust-вакансии."
            }
        });
        let output: EmmyModelOutput =
            serde_json::from_value(value.clone()).expect("valid output should deserialize");
        output
            .validate()
            .expect("valid output should pass semantic validation");

        let mut unknown = value;
        unknown["payload"]["rawProviderData"] = json!(true);
        assert!(serde_json::from_value::<EmmyModelOutput>(unknown).is_err());
    }

    #[test]
    fn tool_contract_contains_exactly_five_names_and_rejects_extra_fields() {
        let fixtures = [
            json!({
                "name": "search_jobs",
                "args": {
                    "text": "Rust",
                    "skills": [],
                    "locations": [],
                    "remoteModes": [],
                    "seniorities": [],
                    "employmentTypes": [],
                    "salaryMinUsdYear": null,
                    "salaryKnownOnly": false,
                    "sources": [],
                    "sort": "relevance",
                    "limit": 8
                }
            }),
            json!({ "name": "get_job", "args": { "jobId": "1" } }),
            json!({ "name": "compare_jobs", "args": { "jobIds": ["1", "2"] } }),
            json!({ "name": "get_match_breakdown", "args": { "jobId": "1" } }),
            json!({ "name": "set_shortlist", "args": { "jobId": "1", "saved": true } }),
        ];
        let names = fixtures
            .into_iter()
            .map(|value| {
                let call: EmmyToolCall =
                    serde_json::from_value(value).expect("closed tool should deserialize");
                call.validate().expect("closed tool should validate");
                call.name()
            })
            .collect::<Vec<_>>();
        assert_eq!(
            names,
            vec![
                "search_jobs",
                "get_job",
                "compare_jobs",
                "get_match_breakdown",
                "set_shortlist"
            ]
        );
        assert!(serde_json::from_value::<EmmyToolCall>(json!({
            "name": "get_job",
            "args": { "jobId": "1", "url": "https://example.com" }
        }))
        .is_err());
        assert!(serde_json::from_value::<EmmyToolCall>(json!({
            "name": "browse_web",
            "args": {}
        }))
        .is_err());
    }

    #[test]
    fn provider_and_error_enums_are_closed_and_include_cerebras() {
        assert_eq!(EmmyProvider::ALL.len(), 4);
        assert_eq!(EmmyProvider::ALL[3], EmmyProvider::Cerebras);
        assert!(serde_json::from_value::<LlmError>(json!({
            "code": "timeout",
            "providerMessage": "secret raw response"
        }))
        .is_err());
        assert!(serde_json::from_value::<LlmError>(json!({ "code": "unknown" })).is_err());
    }
}
