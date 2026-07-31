use std::io;

use rusqlite::{
    params, params_from_iter,
    types::{Type, Value},
    Connection, OptionalExtension,
};
use serde::de::DeserializeOwned;

use crate::ipc::IpcError;

mod aliases;
mod cursor;
pub(crate) mod dto;
mod facets;
mod normalization;
mod query_builder;
mod validation;

use aliases::embedded_alias_maps;
use cursor::{cursor_clause, cursor_for_row, decode_cursor, query_fingerprint};
use dto::{
    EffectiveSort, JobDetail, JobId, JobSummary, LocationFacet, SearchFacets, SearchPage,
    SearchQuery, SearchRow, SkillFacet,
};
use facets::list_sources;
pub(crate) use facets::{autocomplete_locations, autocomplete_skills, get_filter_options};
use query_builder::{build_query_parts, relevance_projection, WEAK_RESULT_MAX_TOTAL};
use validation::validate_and_normalize;

const MAX_FACET_ITEMS: i64 = 100;

fn row_contract_error(index: usize, message: &'static str) -> rusqlite::Error {
    rusqlite::Error::FromSqlConversionFailure(
        index,
        Type::Text,
        Box::new(io::Error::new(io::ErrorKind::InvalidData, message)),
    )
}

fn parse_optional_enum<T>(value: Option<String>, index: usize) -> rusqlite::Result<Option<T>>
where
    T: DeserializeOwned,
{
    value
        .map(|value| {
            serde_json::from_value(serde_json::Value::String(value))
                .map_err(|_| row_contract_error(index, "catalog enum is invalid"))
        })
        .transpose()
}

fn map_search_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<SearchRow> {
    let id = JobId::from_i64(row.get(0)?)
        .map_err(|_| row_contract_error(0, "catalog job ID is invalid"))?;
    let exact_title = row.get::<_, i64>(14)?;
    if !(0..=1).contains(&exact_title) {
        return Err(row_contract_error(14, "exact-title rank is invalid"));
    }
    let exact_skill_matches = u32::try_from(row.get::<_, i64>(15)?)
        .map_err(|_| row_contract_error(15, "exact-skill rank is invalid"))?;
    let total_count = row
        .get::<_, Option<i64>>(18)?
        .map(nonnegative_count)
        .transpose()?;
    Ok(SearchRow {
        summary: JobSummary {
            id,
            title: row.get(1)?,
            company: row.get(2)?,
            location_text: row.get(3)?,
            remote_mode: parse_optional_enum(row.get(4)?, 4)?,
            seniority: parse_optional_enum(row.get(5)?, 5)?,
            salary_min: row.get(6)?,
            salary_max: row.get(7)?,
            salary_currency: row.get(8)?,
            salary_period: row.get(9)?,
            posted_at: row.get(10)?,
            source: row.get(11)?,
            attribution: row.get(12)?,
        },
        bm25_score: row.get(13)?,
        exact_title: exact_title == 1,
        exact_skill_matches,
        sort_number: row.get(16)?,
        sort_text: row.get(17)?,
        total_count,
    })
}

pub(crate) fn search_catalog(
    connection: &Connection,
    request: &SearchQuery,
    catalog_version: &str,
) -> Result<SearchPage<JobSummary>, IpcError> {
    let request = validate_and_normalize(request)?;
    let aliases = embedded_alias_maps()?;
    let parts = build_query_parts(&request, aliases);
    let fingerprint = query_fingerprint(&request)?;
    let position = request
        .cursor
        .as_deref()
        .map(|cursor| decode_cursor(cursor, catalog_version, &fingerprint, parts.effective_sort))
        .transpose()?;

    let count_in_page = request.cursor.is_none()
        && (!request.locations.is_empty() || request.salary_min_usd_year.is_some())
        && parts.effective_sort != EffectiveSort::Relevance;
    let mut total = if request.cursor.is_none() && !count_in_page {
        let count_sql = format!("SELECT count(*) {} {}", parts.from, parts.where_clause);
        let count: i64 = connection
            .query_row(
                &count_sql,
                params_from_iter(parts.where_parameters.iter()),
                |row| row.get(0),
            )
            .map_err(|_| IpcError::Internal)?;
        Some(u64::try_from(count).map_err(|_| IpcError::CatalogCorrupt)?)
    } else {
        None
    };

    let (
        bm25_sql,
        exact_title_sql,
        exact_skill_sql,
        sort_number,
        sort_text,
        order_by,
        rank_parameters,
    ) = match parts.effective_sort {
        EffectiveSort::Relevance => {
            let projection = relevance_projection(&parts);
            (
                    projection.bm25_sql,
                    projection.exact_title_sql,
                    projection.exact_skill_sql,
                    "NULL",
                    "NULL",
                    "ORDER BY page.exact_title DESC, page.exact_skill_matches DESC, page.bm25_score, page.id",
                    projection.parameters,
                )
        }
        EffectiveSort::Newest => (
            "NULL".to_owned(),
            "0".to_owned(),
            "0".to_owned(),
            "NULL",
            "job.posted_at",
            "ORDER BY page.sort_text DESC, page.id",
            Vec::new(),
        ),
        EffectiveSort::Salary => (
            "NULL".to_owned(),
            "0".to_owned(),
            "0".to_owned(),
            "job.salary_usd_year",
            "NULL",
            "ORDER BY page.sort_number IS NULL, page.sort_number DESC, page.id",
            Vec::new(),
        ),
    };
    let mut parameters = rank_parameters;
    parameters.extend(parts.where_parameters.iter().cloned());
    let cursor_where = cursor_clause(position.as_ref(), &mut parameters)?;
    parameters.push(Value::Integer(i64::from(request.limit) + 1));
    let sql = if count_in_page {
        let selected_order = order_by.replace("page.", "selected.");
        format!(
            "WITH page AS MATERIALIZED (
              SELECT
                job.id, {bm25_sql} AS bm25_score,
                {exact_title_sql} AS exact_title,
                {exact_skill_sql} AS exact_skill_matches,
                {sort_number} AS sort_number, {sort_text} AS sort_text,
                count(*) OVER () AS total_count
              {} {}
            ),
            selected AS (
              SELECT * FROM page
              {order_by}
              LIMIT ?
            )
            SELECT
              selected.id, result_job.title, result_job.company,
              result_job.location_text, result_job.remote_mode,
              result_job.seniority, result_job.salary_min, result_job.salary_max,
              result_job.salary_currency, result_job.salary_period,
              result_job.posted_at, result_job.source, result_job.attribution,
              selected.bm25_score, selected.exact_title,
              selected.exact_skill_matches, selected.sort_number,
              selected.sort_text, selected.total_count
            FROM selected
            JOIN jobs AS result_job ON result_job.id = selected.id
            {selected_order}",
            parts.from, parts.where_clause
        )
    } else {
        format!(
            "SELECT
              page.id, page.title, page.company, page.location_text, page.remote_mode,
              page.seniority, page.salary_min, page.salary_max, page.salary_currency,
              page.salary_period, page.posted_at, page.source, page.attribution,
              page.bm25_score, page.exact_title, page.exact_skill_matches,
              page.sort_number, page.sort_text, NULL
            FROM (
              SELECT
                job.id, job.title, job.company, job.location_text, job.remote_mode,
                job.seniority, job.salary_min, job.salary_max, job.salary_currency,
                job.salary_period, job.posted_at, job.source, job.attribution,
                {bm25_sql} AS bm25_score,
                {exact_title_sql} AS exact_title,
                {exact_skill_sql} AS exact_skill_matches,
                {sort_number} AS sort_number, {sort_text} AS sort_text
              {} {}
            ) AS page
            {cursor_where}
            {order_by}
            LIMIT ?",
            parts.from, parts.where_clause
        )
    };
    let mut statement = connection.prepare(&sql).map_err(|_| IpcError::Internal)?;
    let mut rows = statement
        .query_map(params_from_iter(parameters.iter()), map_search_row)
        .map_err(|_| IpcError::Internal)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| IpcError::CatalogCorrupt)?;
    if count_in_page {
        total = Some(rows.first().and_then(|row| row.total_count).unwrap_or(0));
    }
    let has_next_page = rows.len() > request.limit as usize;
    if has_next_page {
        rows.truncate(request.limit as usize);
    }
    let next_cursor = if has_next_page {
        rows.last()
            .map(|row| cursor_for_row(row, parts.effective_sort, catalog_version, &fingerprint))
            .transpose()?
    } else {
        None
    };
    let suggestion = total
        .filter(|count| *count <= WEAK_RESULT_MAX_TOTAL)
        .and_then(|_| aliases.suggestion(&request.text));
    Ok(SearchPage {
        items: rows.into_iter().map(|row| row.summary).collect(),
        next_cursor,
        total,
        suggestion,
    })
}

pub(crate) fn get_job_detail(
    connection: &Connection,
    job_id: &JobId,
) -> Result<JobDetail, IpcError> {
    let id = job_id.as_i64()?;
    let mut detail = connection
        .query_row(
            "SELECT
              id, title, company, location_text, remote_mode, seniority,
              salary_min, salary_max, salary_currency, salary_period, posted_at,
              source, attribution, description_text, employment_type,
              salary_usd_year, source_url, apply_url, snapshot_version
             FROM jobs
             WHERE id = ?",
            params![id],
            |row| {
                Ok(JobDetail {
                    id: JobId::from_i64(row.get(0)?)
                        .map_err(|_| row_contract_error(0, "catalog job ID is invalid"))?,
                    title: row.get(1)?,
                    company: row.get(2)?,
                    location_text: row.get(3)?,
                    remote_mode: parse_optional_enum(row.get(4)?, 4)?,
                    seniority: parse_optional_enum(row.get(5)?, 5)?,
                    salary_min: row.get(6)?,
                    salary_max: row.get(7)?,
                    salary_currency: row.get(8)?,
                    salary_period: row.get(9)?,
                    posted_at: row.get(10)?,
                    source: row.get(11)?,
                    attribution: row.get(12)?,
                    description: row.get(13)?,
                    skills: Vec::new(),
                    employment_type: parse_optional_enum(row.get(14)?, 14)?,
                    salary_usd_year: row.get(15)?,
                    source_url: row.get(16)?,
                    apply_url: row.get(17)?,
                    snapshot_version: row.get(18)?,
                })
            },
        )
        .optional()
        .map_err(|_| IpcError::CatalogCorrupt)?
        .ok_or(IpcError::NotFound)?;
    let mut statement = connection
        .prepare(
            "SELECT skill.canonical_name
             FROM skills AS skill
             JOIN job_skills AS job_skill ON job_skill.skill_id = skill.id
             WHERE job_skill.job_id = ?
             ORDER BY skill.canonical_name",
        )
        .map_err(|_| IpcError::Internal)?;
    detail.skills = statement
        .query_map(params![id], |row| row.get(0))
        .map_err(|_| IpcError::Internal)?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|_| IpcError::CatalogCorrupt)?;
    Ok(detail)
}

fn nonnegative_count(value: i64) -> rusqlite::Result<u64> {
    u64::try_from(value).map_err(|_| row_contract_error(1, "facet count is invalid"))
}

pub(crate) fn get_facets(connection: &Connection) -> Result<SearchFacets, IpcError> {
    let mut skills_statement = connection
        .prepare(
            "SELECT skill.canonical_name, count(*) AS job_count
             FROM skills AS skill
             JOIN job_skills AS job_skill ON job_skill.skill_id = skill.id
             GROUP BY skill.id
             ORDER BY job_count DESC, skill.canonical_name
             LIMIT ?",
        )
        .map_err(|_| IpcError::Internal)?;
    let skills = skills_statement
        .query_map(params![MAX_FACET_ITEMS], |row| {
            Ok(SkillFacet {
                skill: row.get(0)?,
                count: nonnegative_count(row.get(1)?)?,
            })
        })
        .map_err(|_| IpcError::Internal)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| IpcError::CatalogCorrupt)?;

    let mut locations_statement = connection
        .prepare(
            "SELECT location_text, count(*) AS job_count
             FROM jobs
             WHERE trim(location_text) <> ''
             GROUP BY location_text
             ORDER BY job_count DESC, location_text
             LIMIT ?",
        )
        .map_err(|_| IpcError::Internal)?;
    let locations = locations_statement
        .query_map(params![MAX_FACET_ITEMS], |row| {
            Ok(LocationFacet {
                location: row.get(0)?,
                count: nonnegative_count(row.get(1)?)?,
            })
        })
        .map_err(|_| IpcError::Internal)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| IpcError::CatalogCorrupt)?;

    let sources = list_sources(connection)?;

    Ok(SearchFacets {
        skills,
        locations,
        sources,
    })
}

#[cfg(test)]
mod tests;
