use serde::{Deserialize, Deserializer, Serialize};

use crate::ipc::IpcError;

pub(crate) const MAX_JOB_DESCRIPTION_LENGTH: usize = 64_000;

fn deserialize_job_description<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: Deserializer<'de>,
{
    let value = String::deserialize(deserializer)?;
    if value.chars().count() > MAX_JOB_DESCRIPTION_LENGTH {
        return Err(serde::de::Error::custom(
            "job description exceeds IPC limit",
        ));
    }
    Ok(value)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(transparent)]
pub(crate) struct JobId(String);

impl JobId {
    pub(crate) fn from_i64(value: i64) -> Result<Self, IpcError> {
        if value <= 0 {
            return Err(IpcError::Internal);
        }
        Ok(Self(value.to_string()))
    }

    pub(crate) fn parse(value: &str) -> Result<Self, IpcError> {
        if value.is_empty()
            || value.starts_with('0')
            || !value.bytes().all(|byte| byte.is_ascii_digit())
        {
            return Err(IpcError::InvalidQuery);
        }
        let parsed = value.parse::<i64>().map_err(|_| IpcError::InvalidQuery)?;
        if parsed <= 0 {
            return Err(IpcError::InvalidQuery);
        }
        Ok(Self(value.to_owned()))
    }

    pub(crate) fn as_i64(&self) -> Result<i64, IpcError> {
        self.0.parse::<i64>().map_err(|_| IpcError::InvalidQuery)
    }

    #[cfg(test)]
    pub(crate) fn as_str(&self) -> &str {
        &self.0
    }
}

impl<'de> Deserialize<'de> for JobId {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        Self::parse(&value).map_err(|_| serde::de::Error::custom("invalid JobId"))
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum RemoteMode {
    Remote,
    Hybrid,
    Onsite,
}

impl RemoteMode {
    pub(crate) const ALL: [Self; 3] = [Self::Remote, Self::Hybrid, Self::Onsite];

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Remote => "remote",
            Self::Hybrid => "hybrid",
            Self::Onsite => "onsite",
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum Seniority {
    Intern,
    Junior,
    Middle,
    Senior,
    Lead,
    Staff,
    Principal,
    Manager,
    Director,
    Executive,
}

impl Seniority {
    pub(crate) const ALL: [Self; 10] = [
        Self::Intern,
        Self::Junior,
        Self::Middle,
        Self::Senior,
        Self::Lead,
        Self::Staff,
        Self::Principal,
        Self::Manager,
        Self::Director,
        Self::Executive,
    ];

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Intern => "intern",
            Self::Junior => "junior",
            Self::Middle => "middle",
            Self::Senior => "senior",
            Self::Lead => "lead",
            Self::Staff => "staff",
            Self::Principal => "principal",
            Self::Manager => "manager",
            Self::Director => "director",
            Self::Executive => "executive",
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum EmploymentType {
    FullTime,
    Contract,
    PartTime,
    Internship,
    Temporary,
    Volunteer,
    Other,
}

impl EmploymentType {
    pub(crate) const ALL: [Self; 7] = [
        Self::FullTime,
        Self::Contract,
        Self::PartTime,
        Self::Internship,
        Self::Temporary,
        Self::Volunteer,
        Self::Other,
    ];

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::FullTime => "full_time",
            Self::Contract => "contract",
            Self::PartTime => "part_time",
            Self::Internship => "internship",
            Self::Temporary => "temporary",
            Self::Volunteer => "volunteer",
            Self::Other => "other",
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum SearchSort {
    Relevance,
    Newest,
    Salary,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SearchQuery {
    pub(crate) text: String,
    pub(crate) skills: Vec<String>,
    pub(crate) locations: Vec<String>,
    pub(crate) remote_modes: Vec<RemoteMode>,
    pub(crate) seniorities: Vec<Seniority>,
    pub(crate) employment_types: Vec<EmploymentType>,
    pub(crate) salary_min_usd_year: Option<f64>,
    pub(crate) salary_known_only: bool,
    pub(crate) sources: Vec<String>,
    pub(crate) sort: SearchSort,
    pub(crate) limit: u32,
    pub(crate) cursor: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct JobSummary {
    pub(crate) id: JobId,
    pub(crate) title: String,
    pub(crate) company: String,
    pub(crate) location_text: String,
    pub(crate) remote_mode: Option<RemoteMode>,
    pub(crate) seniority: Option<Seniority>,
    pub(crate) salary_min: Option<f64>,
    pub(crate) salary_max: Option<f64>,
    pub(crate) salary_currency: Option<String>,
    pub(crate) salary_period: Option<String>,
    pub(crate) posted_at: Option<String>,
    pub(crate) source: String,
    pub(crate) attribution: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SearchPage<T> {
    pub(crate) items: Vec<T>,
    pub(crate) next_cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) total: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) suggestion: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct JobDetail {
    pub(crate) id: JobId,
    pub(crate) title: String,
    pub(crate) company: String,
    pub(crate) location_text: String,
    pub(crate) remote_mode: Option<RemoteMode>,
    pub(crate) seniority: Option<Seniority>,
    pub(crate) salary_min: Option<f64>,
    pub(crate) salary_max: Option<f64>,
    pub(crate) salary_currency: Option<String>,
    pub(crate) salary_period: Option<String>,
    pub(crate) posted_at: Option<String>,
    pub(crate) source: String,
    pub(crate) attribution: String,
    #[serde(deserialize_with = "deserialize_job_description")]
    pub(crate) description: String,
    pub(crate) skills: Vec<String>,
    pub(crate) employment_type: Option<EmploymentType>,
    pub(crate) salary_usd_year: Option<f64>,
    pub(crate) source_url: String,
    pub(crate) apply_url: Option<String>,
    pub(crate) snapshot_version: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SkillFacet {
    pub(crate) skill: String,
    pub(crate) count: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct LocationFacet {
    pub(crate) location: String,
    pub(crate) count: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SourceFacet {
    pub(crate) source: String,
    pub(crate) count: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct FilterOptions {
    pub(crate) sources: Vec<SourceFacet>,
    pub(crate) remote_modes: Vec<RemoteMode>,
    pub(crate) seniorities: Vec<Seniority>,
    pub(crate) employment_types: Vec<EmploymentType>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AutocompleteRequest {
    pub(crate) query: String,
    pub(crate) limit: u32,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SkillSuggestion {
    pub(crate) label: String,
    pub(crate) canonical_name: String,
    pub(crate) count: u64,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub(crate) enum LocationKind {
    Country,
    City,
    LocationText,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct LocationSuggestion {
    pub(crate) label: String,
    pub(crate) canonical_value: String,
    pub(crate) kind: LocationKind,
    pub(crate) count: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SearchFacets {
    pub(crate) skills: Vec<SkillFacet>,
    pub(crate) locations: Vec<LocationFacet>,
    pub(crate) sources: Vec<SourceFacet>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum EffectiveSort {
    Relevance,
    Newest,
    Salary,
}

pub(super) struct SearchRow {
    pub(super) summary: JobSummary,
    pub(super) bm25_score: Option<f64>,
    pub(super) exact_title: bool,
    pub(super) exact_skill_matches: u32,
    pub(super) sort_number: Option<f64>,
    pub(super) sort_text: Option<String>,
    pub(super) total_count: Option<u64>,
}
