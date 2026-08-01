use std::collections::BTreeSet;

use rusqlite::types::Value;

use super::{
    aliases::{AliasMaps, ResolvedQuery},
    dto::{EffectiveSort, EmploymentType, RemoteMode, SearchQuery, SearchSort, Seniority},
    normalization::{fts_exact_literal, fts_literal},
};

pub(super) const BM25_TITLE_WEIGHT: f64 = 8.0;
pub(super) const BM25_SKILLS_WEIGHT: f64 = 6.0;
pub(super) const BM25_COMPANY_WEIGHT: f64 = 3.0;
pub(super) const BM25_LOCATION_WEIGHT: f64 = 2.0;
pub(super) const BM25_DESCRIPTION_WEIGHT: f64 = 1.0;
pub(super) const BM25_SEARCH_ALIASES_WEIGHT: f64 = 1.0;
pub(super) const WEAK_RESULT_MAX_TOTAL: u64 = 3;

pub(super) struct QueryParts {
    pub(super) from: &'static str,
    pub(super) where_clause: String,
    pub(super) where_parameters: Vec<Value>,
    pub(super) effective_sort: EffectiveSort,
    pub(super) resolved_query: Option<ResolvedQuery>,
}

pub(super) struct RelevanceProjection {
    pub(super) bm25_sql: String,
    pub(super) exact_title_sql: String,
    pub(super) exact_skill_sql: String,
    pub(super) parameters: Vec<Value>,
}

pub(super) fn build_query_parts(request: &SearchQuery, aliases: &AliasMaps) -> QueryParts {
    let resolved_query = (!request.text.is_empty()).then(|| aliases.resolve(&request.text));
    let fts_query = resolved_query.as_ref().map(build_fts_expression);
    let has_filters = !request.skills.is_empty()
        || !request.locations.is_empty()
        || !request.remote_modes.is_empty()
        || !request.seniorities.is_empty()
        || !request.employment_types.is_empty()
        || request.salary_min_usd_year.is_some()
        || request.salary_known_only
        || !request.sources.is_empty();
    let mut predicates = Vec::new();
    let mut parameters = Vec::new();
    let from = if let Some(fts_query) = fts_query.as_ref() {
        predicates.push("jobs_fts MATCH ?".to_owned());
        parameters.push(Value::Text(fts_query.clone()));
        if has_filters {
            "FROM jobs_fts CROSS JOIN jobs AS job ON job.id = jobs_fts.rowid"
        } else {
            "FROM jobs_fts JOIN jobs AS job ON job.id = jobs_fts.rowid"
        }
    } else {
        "FROM jobs AS job"
    };

    push_skill_filter(&request.skills, &mut predicates, &mut parameters);
    push_location_filter(&request.locations, &mut predicates, &mut parameters);
    push_enum_in_filter(
        "job.remote_mode",
        request.remote_modes.iter().copied().map(RemoteMode::as_str),
        &mut predicates,
        &mut parameters,
    );
    push_enum_in_filter(
        "job.seniority",
        request.seniorities.iter().copied().map(Seniority::as_str),
        &mut predicates,
        &mut parameters,
    );
    push_enum_in_filter(
        "job.employment_type",
        request
            .employment_types
            .iter()
            .copied()
            .map(EmploymentType::as_str),
        &mut predicates,
        &mut parameters,
    );
    push_text_in_filter(
        "job.source",
        &request.sources,
        &mut predicates,
        &mut parameters,
    );
    if request.salary_known_only || request.salary_min_usd_year.is_some() {
        predicates.push("job.salary_usd_year IS NOT NULL".to_owned());
    }
    if let Some(salary) = request.salary_min_usd_year {
        predicates.push(
            "job.id IN (
              SELECT salary_candidate.id
              FROM jobs AS salary_candidate INDEXED BY jobs_salary_idx
              WHERE salary_candidate.salary_usd_year >= ?
            )"
            .to_owned(),
        );
        parameters.push(Value::Real(salary));
        predicates.push("job.salary_usd_year >= ?".to_owned());
        parameters.push(Value::Real(salary));
    }

    let where_clause = if predicates.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", predicates.join(" AND "))
    };
    let effective_sort = match request.sort {
        SearchSort::Relevance if fts_query.is_some() => EffectiveSort::Relevance,
        SearchSort::Relevance | SearchSort::Newest => EffectiveSort::Newest,
        SearchSort::Salary => EffectiveSort::Salary,
    };
    QueryParts {
        from,
        where_clause,
        where_parameters: parameters,
        effective_sort,
        resolved_query,
    }
}

pub(super) fn relevance_projection(parts: &QueryParts) -> RelevanceProjection {
    let bm25_sql = format!(
        "bm25(jobs_fts, {BM25_TITLE_WEIGHT}, {BM25_SKILLS_WEIGHT}, \
         {BM25_COMPANY_WEIGHT}, {BM25_LOCATION_WEIGHT}, {BM25_DESCRIPTION_WEIGHT}, \
         {BM25_SEARCH_ALIASES_WEIGHT})"
    );
    let Some(resolved) = parts.resolved_query.as_ref() else {
        return RelevanceProjection {
            bm25_sql: "NULL".to_owned(),
            exact_title_sql: "0".to_owned(),
            exact_skill_sql: "0".to_owned(),
            parameters: Vec::new(),
        };
    };

    let mut parameters = vec![Value::Text(resolved.exact_text.clone())];
    let exact_title_sql = "CASE WHEN job.title_normalized = ? THEN 1 ELSE 0 END".to_owned();
    let canonical_skills = resolved
        .concepts
        .iter()
        .flat_map(|concept| concept.canonical_skills.iter().cloned())
        .collect::<BTreeSet<_>>();
    let exact_skill_sql = if canonical_skills.is_empty() {
        "0".to_owned()
    } else {
        parameters.extend(canonical_skills.iter().cloned().map(Value::Text));
        format!(
            "(SELECT count(*)
              FROM job_skills AS ranked_job_skill
              JOIN skills AS ranked_skill ON ranked_skill.id = ranked_job_skill.skill_id
              WHERE ranked_job_skill.job_id = job.id
                AND ranked_skill.canonical_name IN ({}))",
            placeholders(canonical_skills.len())
        )
    };
    RelevanceProjection {
        bm25_sql,
        exact_title_sql,
        exact_skill_sql,
        parameters,
    }
}

fn build_fts_expression(query: &ResolvedQuery) -> String {
    let groups = query
        .concepts
        .iter()
        .map(|concept| {
            let mut variants = concept
                .variants
                .iter()
                .filter_map(|variant| fts_literal(variant, concept.quoted))
                .collect::<Vec<_>>();
            variants.sort_unstable();
            variants.dedup();
            if variants.is_empty() {
                "\"__gmj_no_token__\"".to_owned()
            } else {
                format!("({})", variants.join(" OR "))
            }
        })
        .collect::<Vec<_>>();
    if groups.is_empty() {
        "\"__gmj_no_token__\"".to_owned()
    } else {
        groups.join(" AND ")
    }
}

pub(super) fn placeholders(count: usize) -> String {
    std::iter::repeat_n("?", count)
        .collect::<Vec<_>>()
        .join(", ")
}

fn push_text_in_filter(
    column: &str,
    values: &[String],
    predicates: &mut Vec<String>,
    parameters: &mut Vec<Value>,
) {
    if values.is_empty() {
        return;
    }
    predicates.push(format!("{column} IN ({})", placeholders(values.len())));
    parameters.extend(values.iter().cloned().map(Value::Text));
}

fn push_enum_in_filter<'a>(
    column: &str,
    values: impl Iterator<Item = &'a str>,
    predicates: &mut Vec<String>,
    parameters: &mut Vec<Value>,
) {
    let values = values.collect::<Vec<_>>();
    if values.is_empty() {
        return;
    }
    predicates.push(format!("{column} IN ({})", placeholders(values.len())));
    parameters.extend(
        values
            .into_iter()
            .map(|value| Value::Text(value.to_owned())),
    );
}

fn push_location_filter(
    locations: &[String],
    predicates: &mut Vec<String>,
    parameters: &mut Vec<Value>,
) {
    if locations.is_empty() {
        return;
    }
    let value_placeholders = placeholders(locations.len());
    let mut candidate_queries = vec![
        format!(
            "SELECT country_candidate.id
             FROM jobs AS country_candidate INDEXED BY jobs_location_idx
             WHERE country_candidate.country IN ({value_placeholders})"
        ),
        format!(
            "SELECT city_candidate.id
             FROM jobs AS city_candidate INDEXED BY jobs_location_idx
             WHERE city_candidate.city IN ({value_placeholders})"
        ),
    ];
    parameters.extend(locations.iter().cloned().map(Value::Text));
    parameters.extend(locations.iter().cloned().map(Value::Text));

    let mut tokenized_locations = Vec::new();
    let mut fallback_locations = Vec::new();
    for location in locations {
        if let Some(expression) = fts_exact_literal(location) {
            tokenized_locations.push(expression);
        } else {
            fallback_locations.push(location.clone());
        }
    }
    if !tokenized_locations.is_empty() {
        candidate_queries.push(
            "SELECT rowid
             FROM jobs_fts
             WHERE jobs_fts MATCH ?"
                .to_owned(),
        );
        parameters.push(Value::Text(format!(
            "location_text : ({})",
            tokenized_locations.join(" OR ")
        )));
    }
    if !fallback_locations.is_empty() {
        candidate_queries.push(format!(
            "SELECT text_candidate.id
             FROM jobs AS text_candidate
             WHERE text_candidate.location_text IN ({})",
            placeholders(fallback_locations.len())
        ));
        parameters.extend(fallback_locations.into_iter().map(Value::Text));
    }

    predicates.push(format!(
        "job.id IN ({})",
        candidate_queries.join(" UNION ALL ")
    ));
    predicates.push(format!(
        "(job.country IN ({value_placeholders}) OR job.city IN ({value_placeholders}) OR job.location_text IN ({value_placeholders}))"
    ));
    for _ in 0..3 {
        parameters.extend(locations.iter().cloned().map(Value::Text));
    }
}

fn push_skill_filter(skills: &[String], predicates: &mut Vec<String>, parameters: &mut Vec<Value>) {
    if skills.is_empty() {
        return;
    }
    predicates.push(format!(
        "job.id IN (
          SELECT filtered_job_skill.job_id
          FROM skills AS filtered_skill
          JOIN job_skills AS filtered_job_skill
            ON filtered_job_skill.skill_id = filtered_skill.id
          WHERE filtered_skill.canonical_name IN ({})
        )",
        placeholders(skills.len())
    ));
    parameters.extend(skills.iter().cloned().map(Value::Text));
}

#[cfg(test)]
mod tests {
    use super::{build_fts_expression, placeholders};
    use crate::search::aliases::{ResolvedConcept, ResolvedQuery};

    #[test]
    fn fts_joins_concepts_with_and_and_aliases_with_or() {
        let query = ResolvedQuery {
            exact_text: "python разработчик".to_owned(),
            concepts: vec![
                ResolvedConcept {
                    variants: vec!["python".to_owned(), "питон".to_owned()],
                    canonical_skills: vec!["Python".to_owned()],
                    quoted: false,
                },
                ResolvedConcept {
                    variants: vec!["developer".to_owned(), "разработчик".to_owned()],
                    canonical_skills: Vec::new(),
                    quoted: false,
                },
            ],
        };
        let expression = build_fts_expression(&query);
        assert!(expression.contains(" OR "));
        assert!(expression.contains(") AND ("));
        assert_eq!(placeholders(3), "?, ?, ?");
    }

    #[test]
    fn fts_operators_and_parentheses_are_always_quoted_data() {
        let query = ResolvedQuery {
            exact_text: "and or near".to_owned(),
            concepts: ["AND", "OR", "NEAR", "(rust)"]
                .into_iter()
                .map(|value| ResolvedConcept {
                    variants: vec![value.to_owned()],
                    canonical_skills: Vec::new(),
                    quoted: false,
                })
                .collect(),
        };
        assert_eq!(
            build_fts_expression(&query),
            "(\"AND\"*) AND (\"OR\") AND (\"NEAR\"*) AND (\"rust\"*)"
        );
    }

    #[test]
    fn quoted_alias_variants_keep_phrase_grouping() {
        let query = ResolvedQuery {
            exact_text: "data scientist".to_owned(),
            concepts: vec![ResolvedConcept {
                variants: vec!["data science".to_owned(), "data scientist".to_owned()],
                canonical_skills: vec!["data science".to_owned()],
                quoted: true,
            }],
        };
        assert_eq!(
            build_fts_expression(&query),
            "(\"data science\"* OR \"data scientist\"*)"
        );
    }
}
