use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};
use unicode_normalization::UnicodeNormalization;

use crate::{
    ipc::IpcError,
    search::{
        canonical_role_concepts,
        dto::{JobDetail, JobId, RemoteMode, Seniority},
    },
    user::UserProfile,
};

const MAX_MATCH_BATCH_SIZE: usize = 200;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MatchBatchRequest {
    pub(crate) job_ids: Vec<JobId>,
}

impl MatchBatchRequest {
    pub(crate) fn validate(&self) -> Result<(), IpcError> {
        if self.job_ids.is_empty() || self.job_ids.len() > MAX_MATCH_BATCH_SIZE {
            return Err(IpcError::InvalidQuery);
        }
        let mut ids = BTreeSet::new();
        for job_id in &self.job_ids {
            if !ids.insert(job_id.as_i64()?) {
                return Err(IpcError::InvalidQuery);
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum MatchComponentName {
    Skills,
    Role,
    Seniority,
    Location,
    Salary,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum MatchReasonCode {
    SkillsOverlap,
    SkillsMissing,
    RoleAligned,
    RoleMismatch,
    SeniorityAligned,
    SeniorityMismatch,
    LocationAligned,
    LocationMismatch,
    SalaryMeets,
    SalaryBelow,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MatchReason {
    pub(crate) component: MatchComponentName,
    pub(crate) code: MatchReasonCode,
    pub(crate) values: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MatchComponents {
    pub(crate) skills: Option<u8>,
    pub(crate) role: Option<u8>,
    pub(crate) seniority: Option<u8>,
    pub(crate) location: Option<u8>,
    pub(crate) salary: Option<u8>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MatchBreakdown {
    pub(crate) score: u8,
    pub(crate) components: MatchComponents,
    pub(crate) strengths: Vec<MatchReason>,
    pub(crate) gaps: Vec<MatchReason>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct JobMatch {
    pub(crate) job_id: JobId,
    pub(crate) breakdown: MatchBreakdown,
}

pub(crate) fn compute_match(
    profile: &UserProfile,
    job: &JobDetail,
) -> Result<MatchBreakdown, IpcError> {
    let skills = score_skills(profile, job);
    let role = score_role(profile, job)?;
    let seniority = score_seniority(profile, job);
    let location = score_location(profile, job);
    let salary = score_salary(profile, job);
    let components = MatchComponents {
        skills: skills.as_ref().map(|component| component.score),
        role: role.as_ref().map(|component| component.score),
        seniority: seniority.as_ref().map(|component| component.score),
        location: location.as_ref().map(|component| component.score),
        salary: salary.as_ref().map(|component| component.score),
    };
    let scored = [
        (skills, 40_u32),
        (role, 20_u32),
        (seniority, 15_u32),
        (location, 15_u32),
        (salary, 10_u32),
    ];
    let total_weight = scored
        .iter()
        .filter_map(|(component, weight)| component.as_ref().map(|_| *weight))
        .sum::<u32>();
    let weighted_score = scored
        .iter()
        .filter_map(|(component, weight)| {
            component
                .as_ref()
                .map(|component| u32::from(component.score) * *weight)
        })
        .sum::<u32>();
    let normalized_score = (weighted_score + total_weight / 2)
        .checked_div(total_weight)
        .unwrap_or(0);
    let score = u8::try_from(normalized_score).map_err(|_| IpcError::Internal)?;
    let mut strengths = Vec::new();
    let mut gaps = Vec::new();
    for (component, _) in scored {
        let Some(component) = component else {
            continue;
        };
        if component.score >= 70 {
            strengths.push(component.strength);
        } else {
            gaps.push(component.gap);
        }
    }
    Ok(MatchBreakdown {
        score,
        components,
        strengths,
        gaps,
    })
}

struct ScoredComponent {
    score: u8,
    strength: MatchReason,
    gap: MatchReason,
}

fn score_skills(profile: &UserProfile, job: &JobDetail) -> Option<ScoredComponent> {
    if profile.skills.is_empty() || job.skills.is_empty() {
        return None;
    }
    let preferred = profile
        .skills
        .iter()
        .map(|skill| normalize(skill))
        .collect::<BTreeSet<_>>();
    let mut matched = Vec::new();
    let mut missing = Vec::new();
    for skill in &job.skills {
        if preferred.contains(&normalize(skill)) {
            matched.push(skill.clone());
        } else {
            missing.push(skill.clone());
        }
    }
    let score = percentage(matched.len(), job.skills.len());
    Some(ScoredComponent {
        score,
        strength: reason(
            MatchComponentName::Skills,
            MatchReasonCode::SkillsOverlap,
            matched,
        ),
        gap: reason(
            MatchComponentName::Skills,
            MatchReasonCode::SkillsMissing,
            missing,
        ),
    })
}

fn score_role(profile: &UserProfile, job: &JobDetail) -> Result<Option<ScoredComponent>, IpcError> {
    if profile.preferred_roles.is_empty() {
        return Ok(None);
    }
    let title = filtered_role_concepts(&job.title)?;
    if title.is_empty() {
        return Ok(None);
    }
    let mut best_score = 0;
    let mut best_role = profile.preferred_roles[0].clone();
    for preferred_role in &profile.preferred_roles {
        let role = filtered_role_concepts(preferred_role)?;
        if role.is_empty() {
            continue;
        }
        let overlap = role.intersection(&title).count();
        let current = percentage(overlap, role.len());
        if current > best_score {
            best_score = current;
            best_role = preferred_role.clone();
        }
    }
    Ok(Some(ScoredComponent {
        score: best_score,
        strength: reason(
            MatchComponentName::Role,
            MatchReasonCode::RoleAligned,
            vec![best_role.clone(), job.title.clone()],
        ),
        gap: reason(
            MatchComponentName::Role,
            MatchReasonCode::RoleMismatch,
            vec![best_role, job.title.clone()],
        ),
    }))
}

fn score_seniority(profile: &UserProfile, job: &JobDetail) -> Option<ScoredComponent> {
    let expected = profile.seniority?;
    let actual = job.seniority?;
    let distance = seniority_rank(expected).abs_diff(seniority_rank(actual));
    let score = match distance {
        0 => 100,
        1 => 70,
        2 => 35,
        _ => 0,
    };
    let values = vec![expected.as_str().to_owned(), actual.as_str().to_owned()];
    Some(ScoredComponent {
        score,
        strength: reason(
            MatchComponentName::Seniority,
            MatchReasonCode::SeniorityAligned,
            values.clone(),
        ),
        gap: reason(
            MatchComponentName::Seniority,
            MatchReasonCode::SeniorityMismatch,
            values,
        ),
    })
}

fn score_location(profile: &UserProfile, job: &JobDetail) -> Option<ScoredComponent> {
    let mode_score = if profile.remote_modes.is_empty() {
        None
    } else {
        job.remote_mode
            .map(|mode| u8::from(profile.remote_modes.contains(&mode)) * 100)
    };
    let profile_locations = [profile.city.as_deref(), profile.country.as_deref()]
        .into_iter()
        .flatten()
        .map(normalize)
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    let normalized_job_location = normalize(&job.location_text);
    let geography_score = if profile_locations.is_empty() || normalized_job_location.is_empty() {
        None
    } else {
        Some(
            u8::from(
                profile_locations
                    .iter()
                    .any(|location| normalized_job_location.contains(location)),
            ) * 100,
        )
    };
    let score = if job.remote_mode == Some(RemoteMode::Remote) && mode_score == Some(100) {
        100
    } else {
        average_known(mode_score, geography_score)?
    };
    let mut values = Vec::new();
    if let Some(mode) = job.remote_mode {
        values.push(mode.as_str().to_owned());
    }
    if !job.location_text.trim().is_empty() {
        values.push(job.location_text.clone());
    }
    Some(ScoredComponent {
        score,
        strength: reason(
            MatchComponentName::Location,
            MatchReasonCode::LocationAligned,
            values.clone(),
        ),
        gap: reason(
            MatchComponentName::Location,
            MatchReasonCode::LocationMismatch,
            values,
        ),
    })
}

fn score_salary(profile: &UserProfile, job: &JobDetail) -> Option<ScoredComponent> {
    let expected = profile.salary_min_usd_year?;
    let actual = job.salary_usd_year?;
    let score = if expected <= 0.0 || actual >= expected {
        100
    } else {
        (actual / expected * 100.0).round().clamp(0.0, 100.0) as u8
    };
    let values = vec![format!("{actual:.0}"), format!("{expected:.0}")];
    Some(ScoredComponent {
        score,
        strength: reason(
            MatchComponentName::Salary,
            MatchReasonCode::SalaryMeets,
            values.clone(),
        ),
        gap: reason(
            MatchComponentName::Salary,
            MatchReasonCode::SalaryBelow,
            values,
        ),
    })
}

fn filtered_role_concepts(value: &str) -> Result<BTreeSet<String>, IpcError> {
    let mut concepts = canonical_role_concepts(value)?;
    if concepts.len() > 1 {
        concepts.retain(|concept| !is_seniority_concept(concept));
    }
    Ok(concepts.into_iter().collect())
}

fn is_seniority_concept(value: &str) -> bool {
    matches!(
        value,
        "intern"
            | "internship"
            | "junior"
            | "jr"
            | "middle"
            | "mid"
            | "senior"
            | "sr"
            | "lead"
            | "staff"
            | "principal"
            | "стажер"
            | "стажёр"
            | "младший"
            | "средний"
            | "старший"
            | "ведущий"
    )
}

fn seniority_rank(value: Seniority) -> u8 {
    match value {
        Seniority::Intern => 0,
        Seniority::Junior => 1,
        Seniority::Middle => 2,
        Seniority::Senior => 3,
        Seniority::Lead | Seniority::Staff | Seniority::Manager => 4,
        Seniority::Principal | Seniority::Director => 5,
        Seniority::Executive => 6,
    }
}

fn percentage(numerator: usize, denominator: usize) -> u8 {
    if denominator == 0 {
        return 0;
    }
    u8::try_from((numerator * 100 + denominator / 2) / denominator).unwrap_or(100)
}

fn average_known(first: Option<u8>, second: Option<u8>) -> Option<u8> {
    match (first, second) {
        (Some(first), Some(second)) => Some((first + second) / 2),
        (Some(score), None) | (None, Some(score)) => Some(score),
        (None, None) => None,
    }
}

fn normalize(value: &str) -> String {
    value
        .nfkc()
        .collect::<String>()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn reason(
    component: MatchComponentName,
    code: MatchReasonCode,
    values: Vec<String>,
) -> MatchReason {
    MatchReason {
        component,
        code,
        values: values.into_iter().take(5).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::{compute_match, MatchBatchRequest};
    use crate::{
        search::dto::{EmploymentType, JobDetail, JobId, RemoteMode, Seniority},
        user::UserProfile,
    };

    fn profile() -> UserProfile {
        UserProfile {
            preferred_roles: vec!["Backend Engineer".to_owned()],
            seniority: Some(Seniority::Senior),
            skills: vec!["Rust".to_owned(), "SQLite".to_owned()],
            country: Some("Azerbaijan".to_owned()),
            city: Some("Baku".to_owned()),
            remote_modes: vec![RemoteMode::Remote, RemoteMode::Hybrid],
            salary_min_usd_year: Some(100_000.0),
            version: 1,
            created_at: "2026-08-01T12:00:00.000Z".to_owned(),
            updated_at: "2026-08-01T12:00:00.000Z".to_owned(),
        }
    }

    fn job() -> JobDetail {
        JobDetail {
            id: JobId::parse("42").expect("fixture ID should be valid"),
            title: "Senior Backend Engineer".to_owned(),
            company: "Example".to_owned(),
            location_text: "Baku, Azerbaijan".to_owned(),
            remote_mode: Some(RemoteMode::Remote),
            seniority: Some(Seniority::Senior),
            salary_min: Some(120_000.0),
            salary_max: Some(140_000.0),
            salary_currency: Some("USD".to_owned()),
            salary_period: Some("year".to_owned()),
            posted_at: Some("2026-07-01T00:00:00Z".to_owned()),
            source: "fixture".to_owned(),
            attribution: "Fixture".to_owned(),
            description: "Fixture description".to_owned(),
            skills: vec!["Rust".to_owned(), "SQLite".to_owned()],
            employment_type: Some(EmploymentType::FullTime),
            salary_usd_year: Some(120_000.0),
            source_url: "https://example.com/jobs/42".to_owned(),
            apply_url: None,
            snapshot_version: "1".to_owned(),
        }
    }

    #[test]
    fn full_overlap_scores_one_hundred_for_all_components() {
        let breakdown = compute_match(&profile(), &job()).expect("match should compute");
        assert_eq!(breakdown.score, 100);
        assert_eq!(breakdown.components.skills, Some(100));
        assert_eq!(breakdown.components.role, Some(100));
        assert_eq!(breakdown.components.seniority, Some(100));
        assert_eq!(breakdown.components.location, Some(100));
        assert_eq!(breakdown.components.salary, Some(100));
        assert!(breakdown.gaps.is_empty());
    }

    #[test]
    fn unknown_job_components_are_excluded_and_known_weights_are_redistributed() {
        let mut job = job();
        job.seniority = None;
        job.remote_mode = None;
        job.location_text.clear();
        job.salary_usd_year = None;
        let breakdown = compute_match(&profile(), &job).expect("match should compute");
        assert_eq!(breakdown.score, 100);
        assert_eq!(breakdown.components.seniority, None);
        assert_eq!(breakdown.components.location, None);
        assert_eq!(breakdown.components.salary, None);
    }

    #[test]
    fn profile_without_match_preferences_returns_an_empty_zero_breakdown() {
        let mut profile = profile();
        profile.preferred_roles.clear();
        profile.skills.clear();
        profile.seniority = None;
        profile.country = None;
        profile.city = None;
        profile.remote_modes.clear();
        profile.salary_min_usd_year = None;

        let breakdown = compute_match(&profile, &job()).expect("empty match should compute");
        assert_eq!(breakdown.score, 0);
        assert_eq!(
            breakdown.components,
            super::MatchComponents {
                skills: None,
                role: None,
                seniority: None,
                location: None,
                salary: None,
            }
        );
        assert!(breakdown.strengths.is_empty());
        assert!(breakdown.gaps.is_empty());
    }

    #[test]
    fn conflicts_produce_bounded_deterministic_gaps() {
        let mut job = job();
        job.skills = vec!["Python".to_owned()];
        job.title = "Product Designer".to_owned();
        job.seniority = Some(Seniority::Intern);
        job.remote_mode = Some(RemoteMode::Onsite);
        job.location_text = "Tokyo, Japan".to_owned();
        job.salary_usd_year = Some(25_000.0);
        let first = compute_match(&profile(), &job).expect("match should compute");
        let second = compute_match(&profile(), &job).expect("match should repeat");
        assert_eq!(first, second);
        assert!(first.score <= 100);
        assert_eq!(first.components.skills, Some(0));
        assert_eq!(first.components.seniority, Some(0));
        assert_eq!(first.components.location, Some(0));
        assert!(!first.gaps.is_empty());
        assert_eq!(
            serde_json::to_vec(&first).expect("breakdown should serialize"),
            serde_json::to_vec(&second).expect("breakdown should serialize identically")
        );
    }

    #[test]
    fn match_batch_rejects_empty_duplicate_and_oversized_requests() {
        let id = JobId::parse("42").expect("fixture ID should be valid");
        assert!(MatchBatchRequest { job_ids: vec![] }.validate().is_err());
        assert!(MatchBatchRequest {
            job_ids: vec![id.clone(), id]
        }
        .validate()
        .is_err());
        let oversized = (1..=201)
            .map(|value| {
                JobId::parse(&value.to_string()).expect("generated fixture ID should be valid")
            })
            .collect();
        assert!(MatchBatchRequest { job_ids: oversized }.validate().is_err());
    }
}
