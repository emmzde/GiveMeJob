use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rusqlite::types::Value;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::ipc::IpcError;

use super::{
    dto::{EffectiveSort, JobId, SearchQuery, SearchRow},
    normalization::{normalize_filter_values, normalize_search_text},
    validation::MAX_CURSOR_LENGTH,
};

const CURSOR_VERSION: u8 = 2;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CursorEnvelope {
    version: u8,
    catalog_version: String,
    fingerprint: String,
    position: CursorPosition,
}

#[derive(Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "sort", rename_all = "snake_case", deny_unknown_fields)]
pub(super) enum CursorPosition {
    Relevance {
        exact_title: bool,
        exact_skill_matches: u32,
        bm25_score: f64,
        job_id: JobId,
    },
    Newest {
        posted_at: Option<String>,
        job_id: JobId,
    },
    Salary {
        salary_usd_year: Option<f64>,
        job_id: JobId,
    },
}

pub(super) fn query_fingerprint(request: &SearchQuery) -> Result<String, IpcError> {
    let canonical = serde_json::json!({
        "text": normalize_search_text(&request.text),
        "skills": normalize_filter_values(&request.skills),
        "locations": normalize_filter_values(&request.locations),
        "remoteModes": normalized_names(request.remote_modes.iter().map(|value| value.as_str())),
        "seniorities": normalized_names(request.seniorities.iter().map(|value| value.as_str())),
        "employmentTypes": normalized_names(request.employment_types.iter().map(|value| value.as_str())),
        "salaryMinUsdYear": request.salary_min_usd_year,
        "salaryKnownOnly": request.salary_known_only,
        "sources": normalize_filter_values(&request.sources),
        "sort": request.sort,
    });
    let bytes = serde_json::to_vec(&canonical).map_err(|_| IpcError::Internal)?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

fn normalized_names<'a>(values: impl Iterator<Item = &'a str>) -> Vec<&'a str> {
    let mut normalized = values.collect::<Vec<_>>();
    normalized.sort_unstable();
    normalized.dedup();
    normalized
}

pub(super) fn decode_cursor(
    encoded: &str,
    catalog_version: &str,
    fingerprint: &str,
    effective_sort: EffectiveSort,
) -> Result<CursorPosition, IpcError> {
    if encoded.is_empty() || encoded.len() > MAX_CURSOR_LENGTH {
        return Err(IpcError::InvalidQuery);
    }
    let bytes = URL_SAFE_NO_PAD
        .decode(encoded)
        .map_err(|_| IpcError::InvalidQuery)?;
    let envelope: CursorEnvelope =
        serde_json::from_slice(&bytes).map_err(|_| IpcError::InvalidQuery)?;
    if envelope.version != CURSOR_VERSION
        || envelope.catalog_version != catalog_version
        || envelope.fingerprint != fingerprint
    {
        return Err(IpcError::InvalidQuery);
    }
    let sort_matches = matches!(
        (&envelope.position, effective_sort),
        (CursorPosition::Relevance { .. }, EffectiveSort::Relevance)
            | (CursorPosition::Newest { .. }, EffectiveSort::Newest)
            | (CursorPosition::Salary { .. }, EffectiveSort::Salary)
    );
    if !sort_matches {
        return Err(IpcError::InvalidQuery);
    }
    match &envelope.position {
        CursorPosition::Relevance {
            exact_skill_matches,
            bm25_score,
            ..
        } if *exact_skill_matches > 12 || !bm25_score.is_finite() => Err(IpcError::InvalidQuery),
        CursorPosition::Salary {
            salary_usd_year: Some(salary),
            ..
        } if !salary.is_finite() || *salary < 0.0 => Err(IpcError::InvalidQuery),
        _ => Ok(envelope.position),
    }
}

fn encode_cursor(
    catalog_version: &str,
    fingerprint: &str,
    position: CursorPosition,
) -> Result<String, IpcError> {
    let envelope = CursorEnvelope {
        version: CURSOR_VERSION,
        catalog_version: catalog_version.to_owned(),
        fingerprint: fingerprint.to_owned(),
        position,
    };
    let bytes = serde_json::to_vec(&envelope).map_err(|_| IpcError::Internal)?;
    let encoded = URL_SAFE_NO_PAD.encode(bytes);
    if encoded.len() > MAX_CURSOR_LENGTH {
        return Err(IpcError::Internal);
    }
    Ok(encoded)
}

pub(super) fn cursor_clause(
    position: Option<&CursorPosition>,
    parameters: &mut Vec<Value>,
) -> Result<String, IpcError> {
    let Some(position) = position else {
        return Ok(String::new());
    };
    match position {
        CursorPosition::Relevance {
            exact_title,
            exact_skill_matches,
            bm25_score,
            job_id,
        } => {
            let exact_title = i64::from(*exact_title);
            let exact_skills = i64::from(*exact_skill_matches);
            parameters.extend([
                Value::Integer(exact_title),
                Value::Integer(exact_title),
                Value::Integer(exact_skills),
                Value::Integer(exact_title),
                Value::Integer(exact_skills),
                Value::Real(*bm25_score),
                Value::Integer(exact_title),
                Value::Integer(exact_skills),
                Value::Real(*bm25_score),
                Value::Integer(job_id.as_i64()?),
            ]);
            Ok("WHERE (
              page.exact_title < ?
              OR (page.exact_title = ? AND page.exact_skill_matches < ?)
              OR (page.exact_title = ? AND page.exact_skill_matches = ? AND page.bm25_score > ?)
              OR (page.exact_title = ? AND page.exact_skill_matches = ? AND page.bm25_score = ? AND page.id > ?)
            )"
                .to_owned())
        }
        CursorPosition::Newest {
            posted_at: Some(posted_at),
            job_id,
        } => {
            parameters.push(Value::Text(posted_at.clone()));
            parameters.push(Value::Text(posted_at.clone()));
            parameters.push(Value::Integer(job_id.as_i64()?));
            Ok("WHERE (page.sort_text < ? OR page.sort_text IS NULL OR (page.sort_text = ? AND page.id > ?))".to_owned())
        }
        CursorPosition::Newest {
            posted_at: None,
            job_id,
        } => {
            parameters.push(Value::Integer(job_id.as_i64()?));
            Ok("WHERE page.sort_text IS NULL AND page.id > ?".to_owned())
        }
        CursorPosition::Salary {
            salary_usd_year: Some(salary),
            job_id,
        } => {
            parameters.push(Value::Real(*salary));
            parameters.push(Value::Real(*salary));
            parameters.push(Value::Integer(job_id.as_i64()?));
            Ok("WHERE (page.sort_number < ? OR page.sort_number IS NULL OR (page.sort_number = ? AND page.id > ?))".to_owned())
        }
        CursorPosition::Salary {
            salary_usd_year: None,
            job_id,
        } => {
            parameters.push(Value::Integer(job_id.as_i64()?));
            Ok("WHERE page.sort_number IS NULL AND page.id > ?".to_owned())
        }
    }
}

pub(super) fn cursor_for_row(
    row: &SearchRow,
    effective_sort: EffectiveSort,
    catalog_version: &str,
    fingerprint: &str,
) -> Result<String, IpcError> {
    let job_id = row.summary.id.clone();
    let position = match effective_sort {
        EffectiveSort::Relevance => CursorPosition::Relevance {
            exact_title: row.exact_title,
            exact_skill_matches: row.exact_skill_matches,
            bm25_score: row.bm25_score.ok_or(IpcError::CatalogCorrupt)?,
            job_id,
        },
        EffectiveSort::Newest => CursorPosition::Newest {
            posted_at: row.sort_text.clone(),
            job_id,
        },
        EffectiveSort::Salary => CursorPosition::Salary {
            salary_usd_year: row.sort_number,
            job_id,
        },
    };
    encode_cursor(catalog_version, fingerprint, position)
}

#[cfg(test)]
pub(super) const TEST_CURSOR_VERSION: u8 = CURSOR_VERSION;
