use std::{future::Future, pin::Pin, time::SystemTime};

use reqwest::{header::RETRY_AFTER, Client, Response, StatusCode};
use serde::Deserialize;
use serde_json::{json, Value};

use super::contracts::{EmmyProvider, LlmError};

const GROQ_ENDPOINT: &str = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_ENDPOINT: &str = "https://generativelanguage.googleapis.com/v1beta/models";
const OPENROUTER_ENDPOINT: &str = "https://openrouter.ai/api/v1/chat/completions";
const CEREBRAS_ENDPOINT: &str = "https://api.cerebras.ai/v1/chat/completions";
const MAX_PROVIDER_RESPONSE_BYTES: usize = 256 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ModelMessageRole {
    User,
    Assistant,
    Tool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ModelMessage {
    pub(crate) role: ModelMessageRole,
    pub(crate) content: String,
}

#[derive(Debug, Clone)]
pub(crate) struct ProviderRequest {
    pub(crate) provider: EmmyProvider,
    pub(crate) model: &'static str,
    pub(crate) system_prompt: String,
    pub(crate) messages: Vec<ModelMessage>,
    pub(crate) response_schema: Value,
}

pub(crate) type ProviderFuture<'a> =
    Pin<Box<dyn Future<Output = Result<String, LlmError>> + Send + 'a>>;

pub(crate) trait ProviderTransport: Send + Sync {
    fn complete<'a>(&'a self, request: &'a ProviderRequest, api_key: &'a str)
        -> ProviderFuture<'a>;
}

#[derive(Clone)]
pub(crate) struct HttpProviderTransport {
    client: Client,
}

impl HttpProviderTransport {
    pub(crate) fn new() -> Result<Self, LlmError> {
        let client = Client::builder()
            .https_only(true)
            .user_agent("GiveMeJob!/0.1.0")
            .build()
            .map_err(|_| LlmError::Unavailable)?;
        Ok(Self { client })
    }

    async fn openai_compatible(
        &self,
        request: &ProviderRequest,
        api_key: &str,
    ) -> Result<String, LlmError> {
        let endpoint = openai_endpoint(request.provider)?;
        let body = openai_body(request)?;

        let mut builder = self.client.post(endpoint).bearer_auth(api_key).json(&body);
        if request.provider == EmmyProvider::Openrouter {
            builder = builder
                .header("HTTP-Referer", "https://github.com/givemejob-app/givemejob")
                .header("X-Title", "GiveMeJob!");
        }
        let response = builder.send().await.map_err(map_reqwest_error)?;
        let response = checked_response(response).await?;
        let envelope: OpenAiEnvelope =
            serde_json::from_slice(&response).map_err(|_| LlmError::Schema)?;
        envelope
            .choices
            .into_iter()
            .next()
            .and_then(|choice| choice.message.content)
            .filter(|content| !content.trim().is_empty())
            .ok_or(LlmError::Schema)
    }

    async fn gemini(&self, request: &ProviderRequest, api_key: &str) -> Result<String, LlmError> {
        let endpoint = format!("{GEMINI_ENDPOINT}/{}:generateContent", request.model);
        let body = gemini_body(request);
        let response = self
            .client
            .post(endpoint)
            .header("x-goog-api-key", api_key)
            .json(&body)
            .send()
            .await
            .map_err(map_reqwest_error)?;
        let response = checked_response(response).await?;
        let envelope: GeminiEnvelope =
            serde_json::from_slice(&response).map_err(|_| LlmError::Schema)?;
        envelope
            .candidates
            .into_iter()
            .next()
            .and_then(|candidate| candidate.content)
            .and_then(|content| content.parts.into_iter().find_map(|part| part.text))
            .filter(|content| !content.trim().is_empty())
            .ok_or(LlmError::Schema)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OpenAiOutputMode {
    JsonObject,
    StrictJsonSchema,
}

fn openai_output_mode(provider: EmmyProvider, model: &str) -> Result<OpenAiOutputMode, LlmError> {
    match provider {
        EmmyProvider::Groq if matches!(model, "openai/gpt-oss-20b" | "openai/gpt-oss-120b") => {
            Ok(OpenAiOutputMode::StrictJsonSchema)
        }
        EmmyProvider::Groq => Ok(OpenAiOutputMode::JsonObject),
        EmmyProvider::Openrouter | EmmyProvider::Cerebras => Ok(OpenAiOutputMode::StrictJsonSchema),
        EmmyProvider::Gemini => Err(LlmError::Unavailable),
    }
}

fn openai_body(request: &ProviderRequest) -> Result<Value, LlmError> {
    let output_mode = openai_output_mode(request.provider, request.model)?;
    let system_prompt = if output_mode == OpenAiOutputMode::JsonObject {
        let schema =
            serde_json::to_string(&request.response_schema).map_err(|_| LlmError::Schema)?;
        format!(
            "{}\n\nReturn one JSON object matching this exact JSON Schema:\n{schema}",
            request.system_prompt
        )
    } else {
        request.system_prompt.clone()
    };
    let mut messages = vec![json!({
        "role": "system",
        "content": system_prompt,
    })];
    messages.extend(request.messages.iter().map(|message| {
        json!({
            "role": match message.role {
                ModelMessageRole::User => "user",
                ModelMessageRole::Assistant => "assistant",
                ModelMessageRole::Tool => "user",
            },
            "content": message.content,
        })
    }));
    let response_format = match output_mode {
        OpenAiOutputMode::JsonObject => json!({ "type": "json_object" }),
        OpenAiOutputMode::StrictJsonSchema => json!({
            "type": "json_schema",
            "json_schema": {
                "name": "emmy_model_output",
                "strict": true,
                "schema": request.response_schema,
            }
        }),
    };
    let mut body = json!({
        "model": request.model,
        "messages": messages,
        "temperature": 0.2,
        "max_completion_tokens": 1200,
        "stream": false,
        "response_format": response_format,
    });
    if request.provider == EmmyProvider::Openrouter {
        body["provider"] = json!({ "require_parameters": true });
    }
    Ok(body)
}

fn gemini_body(request: &ProviderRequest) -> Value {
    let contents = request
        .messages
        .iter()
        .map(|message| {
            json!({
                "role": if message.role == ModelMessageRole::Assistant { "model" } else { "user" },
                "parts": [{ "text": message.content }]
            })
        })
        .collect::<Vec<_>>();
    json!({
        "systemInstruction": {
            "parts": [{ "text": request.system_prompt }]
        },
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": 1200,
            "responseMimeType": "application/json",
            "responseJsonSchema": request.response_schema,
        }
    })
}

fn openai_endpoint(provider: EmmyProvider) -> Result<&'static str, LlmError> {
    match provider {
        EmmyProvider::Groq => Ok(GROQ_ENDPOINT),
        EmmyProvider::Openrouter => Ok(OPENROUTER_ENDPOINT),
        EmmyProvider::Cerebras => Ok(CEREBRAS_ENDPOINT),
        EmmyProvider::Gemini => Err(LlmError::Unavailable),
    }
}

impl ProviderTransport for HttpProviderTransport {
    fn complete<'a>(
        &'a self,
        request: &'a ProviderRequest,
        api_key: &'a str,
    ) -> ProviderFuture<'a> {
        Box::pin(async move {
            match request.provider {
                EmmyProvider::Groq | EmmyProvider::Openrouter | EmmyProvider::Cerebras => {
                    self.openai_compatible(request, api_key).await
                }
                EmmyProvider::Gemini => self.gemini(request, api_key).await,
            }
        })
    }
}

fn map_reqwest_error(error: reqwest::Error) -> LlmError {
    if error.is_timeout() {
        LlmError::Timeout
    } else {
        LlmError::Transport
    }
}

async fn checked_response(response: Response) -> Result<Vec<u8>, LlmError> {
    let status = response.status();
    if let Some(error) = status_error(status, retry_after_seconds(&response)) {
        return Err(error);
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_PROVIDER_RESPONSE_BYTES as u64)
    {
        return Err(LlmError::Schema);
    }
    let bytes = response.bytes().await.map_err(map_reqwest_error)?;
    if bytes.len() > MAX_PROVIDER_RESPONSE_BYTES {
        return Err(LlmError::Schema);
    }
    Ok(bytes.to_vec())
}

fn status_error(status: StatusCode, retry_after_seconds: Option<u64>) -> Option<LlmError> {
    if status.is_success() {
        return None;
    }
    Some(match status {
        StatusCode::TOO_MANY_REQUESTS => LlmError::RateLimit {
            retry_after_seconds,
        },
        StatusCode::REQUEST_TIMEOUT | StatusCode::GATEWAY_TIMEOUT => LlmError::Timeout,
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => LlmError::Unavailable,
        StatusCode::BAD_REQUEST | StatusCode::UNPROCESSABLE_ENTITY => LlmError::Schema,
        _ => LlmError::Transport,
    })
}

fn retry_after_seconds(response: &Response) -> Option<u64> {
    let raw = response.headers().get(RETRY_AFTER)?.to_str().ok()?;
    parse_retry_after(raw, SystemTime::now())
}

fn parse_retry_after(raw: &str, now: SystemTime) -> Option<u64> {
    if let Ok(seconds) = raw.parse::<u64>() {
        return Some(seconds);
    }
    let date = httpdate::parse_http_date(raw).ok()?;
    date.duration_since(now)
        .ok()
        .map(|duration| duration.as_secs())
}

#[derive(Deserialize)]
struct OpenAiEnvelope {
    #[serde(default)]
    choices: Vec<OpenAiChoice>,
}

#[derive(Deserialize)]
struct OpenAiChoice {
    message: OpenAiResponseMessage,
}

#[derive(Deserialize)]
struct OpenAiResponseMessage {
    content: Option<String>,
}

#[derive(Deserialize)]
struct GeminiEnvelope {
    #[serde(default)]
    candidates: Vec<GeminiCandidate>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiContent>,
}

#[derive(Deserialize)]
struct GeminiContent {
    #[serde(default)]
    parts: Vec<GeminiPart>,
}

#[derive(Deserialize)]
struct GeminiPart {
    text: Option<String>,
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, UNIX_EPOCH};

    use serde_json::json;

    use super::{
        gemini_body, openai_body, openai_endpoint, parse_retry_after, status_error, EmmyProvider,
        LlmError, ModelMessage, ModelMessageRole, ProviderRequest, StatusCode, CEREBRAS_ENDPOINT,
    };

    fn request(provider: EmmyProvider, model: &'static str) -> ProviderRequest {
        ProviderRequest {
            provider,
            model,
            system_prompt: "system".to_owned(),
            messages: vec![ModelMessage {
                role: ModelMessageRole::User,
                content: "hello".to_owned(),
            }],
            response_schema: json!({
                "type": "object",
                "properties": { "answer": { "type": "string" } },
                "required": ["answer"],
                "additionalProperties": false
            }),
        }
    }

    #[test]
    fn cerebras_uses_its_openai_compatible_https_endpoint() {
        assert_eq!(
            openai_endpoint(EmmyProvider::Cerebras),
            Ok(CEREBRAS_ENDPOINT)
        );
        assert!(CEREBRAS_ENDPOINT.starts_with("https://api.cerebras.ai/"));
    }

    #[test]
    fn provider_specific_structured_output_modes_match_supported_apis() {
        let groq = openai_body(&request(EmmyProvider::Groq, "qwen/qwen3.6-27b"))
            .expect("Groq body should build");
        assert_eq!(groq["response_format"]["type"], "json_object");
        assert_eq!(groq["max_completion_tokens"], 1200);
        assert!(groq.get("max_tokens").is_none());
        assert!(groq["messages"][0]["content"]
            .as_str()
            .is_some_and(|prompt| prompt.contains("JSON Schema")));

        for (provider, model) in [
            (EmmyProvider::Openrouter, "openrouter/free"),
            (EmmyProvider::Cerebras, "gpt-oss-120b"),
        ] {
            let body = openai_body(&request(provider, model)).expect("strict body should build");
            assert_eq!(body["response_format"]["type"], "json_schema");
            assert_eq!(body["response_format"]["json_schema"]["strict"], true);
        }
    }

    #[test]
    fn gemini_uses_structured_schema_without_deprecated_sampling_parameters() {
        let body = gemini_body(&request(EmmyProvider::Gemini, "gemini-3.5-flash-lite"));
        assert!(body["generationConfig"].get("responseJsonSchema").is_some());
        assert!(body["generationConfig"].get("temperature").is_none());
        assert!(body["generationConfig"].get("topP").is_none());
        assert!(body["generationConfig"].get("topK").is_none());
    }

    #[test]
    fn retry_after_and_http_statuses_map_to_closed_errors() {
        assert_eq!(parse_retry_after("42", UNIX_EPOCH), Some(42));
        let date = httpdate::fmt_http_date(UNIX_EPOCH + Duration::from_secs(120));
        assert_eq!(parse_retry_after(&date, UNIX_EPOCH), Some(120));
        assert_eq!(
            status_error(StatusCode::TOO_MANY_REQUESTS, Some(42)),
            Some(LlmError::RateLimit {
                retry_after_seconds: Some(42)
            })
        );
        assert_eq!(
            status_error(StatusCode::GATEWAY_TIMEOUT, None),
            Some(LlmError::Timeout)
        );
        assert_eq!(status_error(StatusCode::OK, None), None);
    }
}

#[cfg(test)]
pub(crate) mod tests_support {
    use std::{collections::VecDeque, sync::Mutex};

    use super::{LlmError, ProviderFuture, ProviderRequest, ProviderTransport};

    pub(crate) struct FakeProviderTransport {
        replies: Mutex<VecDeque<Result<String, LlmError>>>,
        requests: Mutex<Vec<ProviderRequest>>,
    }

    impl FakeProviderTransport {
        pub(crate) fn new(replies: Vec<Result<String, LlmError>>) -> Self {
            Self {
                replies: Mutex::new(replies.into()),
                requests: Mutex::new(Vec::new()),
            }
        }

        pub(crate) fn requests(&self) -> Vec<ProviderRequest> {
            self.requests
                .lock()
                .expect("fake request lock should remain available")
                .clone()
        }
    }

    impl ProviderTransport for FakeProviderTransport {
        fn complete<'a>(
            &'a self,
            request: &'a ProviderRequest,
            _api_key: &'a str,
        ) -> ProviderFuture<'a> {
            Box::pin(async move {
                self.requests
                    .lock()
                    .map_err(|_| LlmError::Local)?
                    .push(request.clone());
                self.replies
                    .lock()
                    .map_err(|_| LlmError::Local)?
                    .pop_front()
                    .unwrap_or(Err(LlmError::Unavailable))
            })
        }
    }
}
