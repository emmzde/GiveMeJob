use std::{cmp::Reverse, collections::BTreeMap};

use rusqlite::{params, Connection};

use crate::ipc::IpcError;

use super::{
    dto::{
        AutocompleteRequest, EmploymentType, FilterOptions, LocationKind, LocationSuggestion,
        RemoteMode, Seniority, SkillSuggestion, SourceFacet,
    },
    nonnegative_count,
    normalization::normalize_lookup,
    validation::MAX_FILTER_VALUE_LENGTH,
};

struct RankedSkill {
    suggestion: SkillSuggestion,
    match_rank: u8,
}

struct LocationAggregate {
    kind: LocationKind,
    count: u64,
    match_rank: u8,
}

fn match_rank(value: &str, query: &str) -> Option<u8> {
    if query.is_empty() {
        return Some(3);
    }
    let normalized = normalize_lookup(value);
    if normalized == query {
        Some(0)
    } else if normalized.starts_with(query) {
        Some(1)
    } else if normalized.contains(query) {
        Some(2)
    } else {
        None
    }
}

pub(super) fn list_sources(connection: &Connection) -> Result<Vec<SourceFacet>, IpcError> {
    let mut statement = connection
        .prepare(
            "SELECT source, count(*) AS job_count
             FROM jobs
             GROUP BY source
             ORDER BY job_count DESC, source",
        )
        .map_err(|_| IpcError::Internal)?;
    let sources = statement
        .query_map([], |row| {
            Ok(SourceFacet {
                source: row.get(0)?,
                count: nonnegative_count(row.get(1)?)?,
            })
        })
        .map_err(|_| IpcError::Internal)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| IpcError::CatalogCorrupt)?;
    Ok(sources)
}

pub(crate) fn get_filter_options(connection: &Connection) -> Result<FilterOptions, IpcError> {
    Ok(FilterOptions {
        sources: list_sources(connection)?,
        remote_modes: RemoteMode::ALL.to_vec(),
        seniorities: Seniority::ALL.to_vec(),
        employment_types: EmploymentType::ALL.to_vec(),
    })
}

pub(crate) fn autocomplete_skills(
    connection: &Connection,
    request: &AutocompleteRequest,
) -> Result<Vec<SkillSuggestion>, IpcError> {
    let request = request.validate_and_normalize()?;
    let mut statement = connection
        .prepare(
            "SELECT skill.canonical_name, skill.aliases_json, count(job_skill.job_id)
             FROM skills AS skill
             LEFT JOIN job_skills AS job_skill ON job_skill.skill_id = skill.id
             GROUP BY skill.id
             ORDER BY skill.canonical_name",
        )
        .map_err(|_| IpcError::Internal)?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })
        .map_err(|_| IpcError::Internal)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| IpcError::CatalogCorrupt)?;

    let mut ranked = Vec::new();
    for (canonical_name, aliases_json, count) in rows {
        if canonical_name.chars().count() > MAX_FILTER_VALUE_LENGTH {
            continue;
        }
        let aliases: Vec<String> =
            serde_json::from_str(&aliases_json).map_err(|_| IpcError::CatalogCorrupt)?;
        let (label, rank) = if request.query.is_empty() {
            (canonical_name.clone(), 3)
        } else {
            let labels =
                std::iter::once(canonical_name.as_str()).chain(aliases.iter().map(String::as_str));
            let Some((rank, _, _, label)) = labels
                .filter(|label| label.chars().count() <= MAX_FILTER_VALUE_LENGTH)
                .filter_map(|label| {
                    match_rank(label, &request.query).map(|rank| {
                        (
                            rank,
                            label.chars().count(),
                            normalize_lookup(label),
                            label.to_owned(),
                        )
                    })
                })
                .min()
            else {
                continue;
            };
            (label, rank)
        };
        ranked.push(RankedSkill {
            suggestion: SkillSuggestion {
                label,
                canonical_name,
                count: nonnegative_count(count).map_err(|_| IpcError::CatalogCorrupt)?,
            },
            match_rank: rank,
        });
    }
    ranked.sort_by(|left, right| {
        (
            left.match_rank,
            Reverse(left.suggestion.count),
            normalize_lookup(&left.suggestion.label),
            &left.suggestion.canonical_name,
        )
            .cmp(&(
                right.match_rank,
                Reverse(right.suggestion.count),
                normalize_lookup(&right.suggestion.label),
                &right.suggestion.canonical_name,
            ))
    });
    ranked.truncate(request.limit as usize);
    Ok(ranked.into_iter().map(|item| item.suggestion).collect())
}

fn add_location(
    locations: &mut BTreeMap<String, LocationAggregate>,
    value: Option<String>,
    kind: LocationKind,
    query: &str,
    seen_for_job: &mut Vec<String>,
) -> Result<(), IpcError> {
    let Some(value) = value.filter(|value| !value.trim().is_empty()) else {
        return Ok(());
    };
    if value.chars().count() > MAX_FILTER_VALUE_LENGTH {
        return Ok(());
    }
    let Some(rank) = match_rank(&value, query) else {
        return Ok(());
    };
    if let Some(existing) = locations.get_mut(&value) {
        existing.kind = existing.kind.min(kind);
        existing.match_rank = existing.match_rank.min(rank);
        if !seen_for_job.contains(&value) {
            existing.count = existing
                .count
                .checked_add(1)
                .ok_or(IpcError::CatalogCorrupt)?;
        }
    } else {
        locations.insert(
            value.clone(),
            LocationAggregate {
                kind,
                count: 1,
                match_rank: rank,
            },
        );
    }
    if !seen_for_job.contains(&value) {
        seen_for_job.push(value);
    }
    Ok(())
}

pub(crate) fn autocomplete_locations(
    connection: &Connection,
    request: &AutocompleteRequest,
) -> Result<Vec<LocationSuggestion>, IpcError> {
    let request = request.validate_and_normalize()?;
    let mut statement = connection
        .prepare("SELECT country, city, location_text FROM jobs ORDER BY id")
        .map_err(|_| IpcError::Internal)?;
    let rows = statement
        .query_map(params![], |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|_| IpcError::Internal)?;
    let mut locations = BTreeMap::new();
    for row in rows {
        let (country, city, location_text) = row.map_err(|_| IpcError::CatalogCorrupt)?;
        let mut seen_for_job = Vec::with_capacity(3);
        add_location(
            &mut locations,
            country,
            LocationKind::Country,
            &request.query,
            &mut seen_for_job,
        )?;
        add_location(
            &mut locations,
            city,
            LocationKind::City,
            &request.query,
            &mut seen_for_job,
        )?;
        add_location(
            &mut locations,
            Some(location_text),
            LocationKind::LocationText,
            &request.query,
            &mut seen_for_job,
        )?;
    }

    let mut suggestions = locations
        .into_iter()
        .map(|(canonical_value, aggregate)| {
            (
                aggregate.match_rank,
                LocationSuggestion {
                    label: canonical_value.clone(),
                    canonical_value,
                    kind: aggregate.kind,
                    count: aggregate.count,
                },
            )
        })
        .collect::<Vec<_>>();
    suggestions.sort_by(|(left_rank, left), (right_rank, right)| {
        (
            left_rank,
            Reverse(left.count),
            normalize_lookup(&left.label),
            &left.canonical_value,
        )
            .cmp(&(
                right_rank,
                Reverse(right.count),
                normalize_lookup(&right.label),
                &right.canonical_value,
            ))
    });
    suggestions.truncate(request.limit as usize);
    Ok(suggestions
        .into_iter()
        .map(|(_, suggestion)| suggestion)
        .collect())
}
