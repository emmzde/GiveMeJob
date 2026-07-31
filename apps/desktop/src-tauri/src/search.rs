use rusqlite::{params_from_iter, types::Value, Connection};
use serde::{Deserialize, Serialize};

const MAX_QUERY_LENGTH: usize = 200;
const MAX_SKILL_FILTERS: usize = 50;
const MAX_LOCATION_FILTERS: usize = 20;
const MAX_SOURCE_FILTERS: usize = 20;
const MAX_FILTER_VALUE_LENGTH: usize = 100;
const MAX_SALARY_USD_YEAR: f64 = 10_000_000.0;

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum RemoteMode {
    Remote,
    Hybrid,
    Onsite,
}

impl RemoteMode {
    fn as_str(self) -> &'static str {
        match self {
            Self::Remote => "remote",
            Self::Hybrid => "hybrid",
            Self::Onsite => "onsite",
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
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
    fn as_str(self) -> &'static str {
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

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
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
    fn as_str(self) -> &'static str {
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

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum SearchSort {
    Relevance,
    Newest,
    Salary,
}

#[derive(Debug, Clone, Deserialize)]
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
}

impl SearchQuery {
    fn validate(&self) -> Result<(), String> {
        if self.text.chars().count() > MAX_QUERY_LENGTH {
            return Err(format!(
                "search text must not exceed {MAX_QUERY_LENGTH} characters"
            ));
        }
        validate_text_filters(&self.skills, "skills", MAX_SKILL_FILTERS)?;
        validate_text_filters(&self.locations, "locations", MAX_LOCATION_FILTERS)?;
        validate_text_filters(&self.sources, "sources", MAX_SOURCE_FILTERS)?;
        if self.remote_modes.len() > 3 {
            return Err("remoteModes must not contain more than 3 values".to_owned());
        }
        if self.seniorities.len() > 10 {
            return Err("seniorities must not contain more than 10 values".to_owned());
        }
        if self.employment_types.len() > 7 {
            return Err("employmentTypes must not contain more than 7 values".to_owned());
        }
        if let Some(salary) = self.salary_min_usd_year {
            if !salary.is_finite() || !(0.0..=MAX_SALARY_USD_YEAR).contains(&salary) {
                return Err(format!(
                    "salaryMinUsdYear must be between 0 and {MAX_SALARY_USD_YEAR}"
                ));
            }
        }
        if !(1..=50).contains(&self.limit) {
            return Err("limit must be between 1 and 50".to_owned());
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct JobSummary {
    pub(crate) id: i64,
    pub(crate) title: String,
    pub(crate) company: String,
    pub(crate) location_text: String,
    pub(crate) remote_mode: Option<String>,
    pub(crate) seniority: Option<String>,
    pub(crate) salary_min: Option<f64>,
    pub(crate) salary_max: Option<f64>,
    pub(crate) salary_currency: Option<String>,
    pub(crate) salary_period: Option<String>,
    pub(crate) posted_at: Option<String>,
    pub(crate) source: String,
    pub(crate) attribution: String,
}

fn validate_text_filters(values: &[String], field: &str, max_items: usize) -> Result<(), String> {
    if values.len() > max_items {
        return Err(format!(
            "{field} must not contain more than {max_items} values"
        ));
    }
    if values.iter().any(|value| {
        value.trim().is_empty()
            || value.trim() != value
            || value.chars().count() > MAX_FILTER_VALUE_LENGTH
    }) {
        return Err(format!(
            "{field} values must be trimmed and contain 1 to {MAX_FILTER_VALUE_LENGTH} characters"
        ));
    }
    Ok(())
}

fn safe_fts_query(query: &str) -> Option<String> {
    let tokens: Vec<String> = query
        .split(|character: char| !(character.is_alphanumeric() || character == '_'))
        .filter(|token| !token.is_empty())
        .take(12)
        .map(|token| format!("\"{}\"*", token.replace('"', "\"\"")))
        .collect();
    if tokens.is_empty() {
        None
    } else {
        Some(tokens.join(" AND "))
    }
}

fn placeholders(count: usize) -> String {
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
    let values: Vec<&str> = values.collect();
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
    let placeholders = placeholders(locations.len());
    predicates.push(format!(
        "(job.country IN ({placeholders}) OR job.city IN ({placeholders}) OR job.location_text IN ({placeholders}))"
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

fn map_job_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<JobSummary> {
    Ok(JobSummary {
        id: row.get(0)?,
        title: row.get(1)?,
        company: row.get(2)?,
        location_text: row.get(3)?,
        remote_mode: row.get(4)?,
        seniority: row.get(5)?,
        salary_min: row.get(6)?,
        salary_max: row.get(7)?,
        salary_currency: row.get(8)?,
        salary_period: row.get(9)?,
        posted_at: row.get(10)?,
        source: row.get(11)?,
        attribution: row.get(12)?,
    })
}

pub(crate) fn search_catalog(
    connection: &Connection,
    request: &SearchQuery,
) -> Result<Vec<JobSummary>, String> {
    request.validate()?;

    let fts_query = safe_fts_query(&request.text);
    let mut predicates = Vec::new();
    let mut parameters = Vec::new();
    let from = if let Some(fts_query) = fts_query.as_ref() {
        predicates.push("jobs_fts MATCH ?".to_owned());
        parameters.push(Value::Text(fts_query.clone()));
        "FROM jobs_fts JOIN jobs AS job ON job.id = jobs_fts.rowid"
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
        predicates.push("job.salary_usd_year >= ?".to_owned());
        parameters.push(Value::Real(salary));
    }

    let where_clause = if predicates.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", predicates.join(" AND "))
    };
    let order_by = match request.sort {
        SearchSort::Relevance if fts_query.is_some() => {
            "ORDER BY bm25(jobs_fts, 8.0, 6.0, 3.0, 2.0, 1.0, 1.0), job.posted_at DESC, job.id"
        }
        SearchSort::Relevance | SearchSort::Newest => "ORDER BY job.posted_at DESC, job.id",
        SearchSort::Salary => "ORDER BY job.salary_usd_year DESC, job.id",
    };
    parameters.push(Value::Integer(i64::from(request.limit)));

    let sql = format!(
        "SELECT
          job.id, job.title, job.company, job.location_text, job.remote_mode,
          job.seniority, job.salary_min, job.salary_max, job.salary_currency,
          job.salary_period, job.posted_at, job.source, job.attribution
        {from}
        {where_clause}
        {order_by}
        LIMIT ?"
    );
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| format!("local search cannot be prepared: {error}"))?;
    let jobs = statement
        .query_map(params_from_iter(parameters.iter()), map_job_row)
        .map_err(|error| format!("local search failed: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("local search result is invalid: {error}"))?;
    Ok(jobs)
}

#[cfg(test)]
mod tests {
    use rusqlite::{params, Connection};

    use super::{
        placeholders, safe_fts_query, search_catalog, EmploymentType, RemoteMode, SearchQuery,
        SearchSort, Seniority,
    };

    fn search_query() -> SearchQuery {
        SearchQuery {
            text: String::new(),
            skills: Vec::new(),
            locations: Vec::new(),
            remote_modes: Vec::new(),
            seniorities: Vec::new(),
            employment_types: Vec::new(),
            salary_min_usd_year: None,
            salary_known_only: false,
            sources: Vec::new(),
            sort: SearchSort::Relevance,
            limit: 50,
        }
    }

    fn fixture_catalog() -> Connection {
        let connection = Connection::open_in_memory().expect("fixture catalog should open");
        connection
            .execute_batch(
                r#"
                CREATE TABLE jobs (
                  id INTEGER PRIMARY KEY,
                  title TEXT NOT NULL,
                  skills_text TEXT NOT NULL,
                  company TEXT NOT NULL,
                  location_text TEXT NOT NULL,
                  description_text TEXT NOT NULL,
                  search_aliases TEXT NOT NULL,
                  remote_mode TEXT,
                  seniority TEXT,
                  employment_type TEXT,
                  country TEXT,
                  city TEXT,
                  salary_min REAL,
                  salary_max REAL,
                  salary_currency TEXT,
                  salary_period TEXT,
                  salary_usd_year REAL,
                  posted_at TEXT,
                  source TEXT NOT NULL,
                  attribution TEXT NOT NULL
                );
                CREATE TABLE skills (
                  id INTEGER PRIMARY KEY,
                  canonical_name TEXT NOT NULL UNIQUE
                );
                CREATE TABLE job_skills (
                  job_id INTEGER NOT NULL,
                  skill_id INTEGER NOT NULL,
                  PRIMARY KEY (job_id, skill_id)
                );
                CREATE VIRTUAL TABLE jobs_fts USING fts5(
                  title, skills_text, company, location_text, description_text,
                  search_aliases, content = 'jobs', content_rowid = 'id'
                );

                INSERT INTO skills (id, canonical_name) VALUES (1, 'Python'), (2, 'Rust');
                "#,
            )
            .expect("fixture schema should be valid");
        let jobs = [
            (
                1,
                "Python Backend Engineer",
                "Python SQL",
                "Acme",
                "New York, US",
                "Backend services",
                "py",
                "remote",
                "senior",
                "full_time",
                "US",
                "New York",
                Some(130_000.0),
                Some(150_000.0),
                Some(140_000.0),
                "2026-01-03T00:00:00Z",
                "greenhouse",
            ),
            (
                2,
                "Rust Developer",
                "Rust",
                "Ferris",
                "Berlin, DE",
                "Systems programming",
                "rustlang",
                "hybrid",
                "middle",
                "contract",
                "DE",
                "Berlin",
                Some(110_000.0),
                Some(130_000.0),
                Some(120_000.0),
                "2026-01-04T00:00:00Z",
                "lever",
            ),
            (
                3,
                "Python Data Analyst",
                "Python",
                "Data Co",
                "London, GB",
                "Reports and data",
                "аналитик",
                "onsite",
                "junior",
                "part_time",
                "GB",
                "London",
                None,
                None,
                None,
                "2026-01-05T00:00:00Z",
                "himalayas",
            ),
            (
                4,
                "Python Intern",
                "Python",
                "Starter",
                "Austin, US",
                "Learning backend development",
                "стажер",
                "remote",
                "intern",
                "internship",
                "US",
                "Austin",
                Some(50_000.0),
                Some(70_000.0),
                Some(60_000.0),
                "2026-01-06T00:00:00Z",
                "arbeitnow",
            ),
        ];
        for job in jobs {
            connection
                .execute(
                    "INSERT INTO jobs (
                      id, title, skills_text, company, location_text, description_text,
                      search_aliases, remote_mode, seniority, employment_type, country,
                      city, salary_min, salary_max, salary_currency, salary_period,
                      salary_usd_year, posted_at, source, attribution
                    ) VALUES (
                      ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
                      ?14, 'USD', 'year', ?15, ?16, ?17, ?17
                    )",
                    params![
                        job.0, job.1, job.2, job.3, job.4, job.5, job.6, job.7, job.8, job.9,
                        job.10, job.11, job.12, job.13, job.14, job.15, job.16,
                    ],
                )
                .expect("fixture job should insert");
        }
        connection
            .execute_batch(
                r#"
                INSERT INTO job_skills (job_id, skill_id)
                VALUES (1, 1), (2, 2), (3, 1), (4, 1);
                INSERT INTO jobs_fts(
                  rowid, title, skills_text, company, location_text,
                  description_text, search_aliases
                )
                SELECT
                  id, title, skills_text, company, location_text,
                  description_text, search_aliases
                FROM jobs;
                "#,
            )
            .expect("fixture FTS index should build");
        connection
    }

    #[test]
    fn fts_query_accepts_words_without_exposing_fts_syntax() {
        assert_eq!(
            safe_fts_query("Python OR (Rust)"),
            Some("\"Python\"* AND \"OR\"* AND \"Rust\"*".to_owned())
        );
        assert_eq!(safe_fts_query("  ---  "), None);
    }

    #[test]
    fn placeholder_list_contains_only_parameter_markers() {
        assert_eq!(placeholders(3), "?, ?, ?");
        assert_eq!(placeholders(0), "");
    }

    #[test]
    fn query_validation_rejects_invalid_ranges_and_untrimmed_filters() {
        let mut query = search_query();
        query.limit = 0;
        assert_eq!(
            query.validate(),
            Err("limit must be between 1 and 50".to_owned())
        );

        let mut query = search_query();
        query.salary_min_usd_year = Some(-1.0);
        assert!(query.validate().is_err());

        let mut query = search_query();
        query.sources = vec![" greenhouse ".to_owned()];
        assert!(query.validate().is_err());
    }

    #[test]
    fn serde_rejects_unknown_fields_and_enum_values() {
        let unknown_field = r#"{
          "text":"","skills":[],"locations":[],"remoteModes":[],
          "seniorities":[],"employmentTypes":[],"salaryKnownOnly":false,
          "sources":[],"sort":"newest","limit":50,"sql":"DROP TABLE jobs"
        }"#;
        assert!(serde_json::from_str::<SearchQuery>(unknown_field).is_err());

        let unknown_remote = r#"{
          "text":"","skills":[],"locations":[],"remoteModes":["anywhere"],
          "seniorities":[],"employmentTypes":[],"salaryKnownOnly":false,
          "sources":[],"sort":"newest","limit":50
        }"#;
        assert!(serde_json::from_str::<SearchQuery>(unknown_remote).is_err());
    }

    #[test]
    fn search_combines_all_filter_categories_with_parameters() {
        let connection = fixture_catalog();
        let mut query = search_query();
        query.text = "Python".to_owned();
        query.skills = vec!["Python".to_owned()];
        query.locations = vec!["US".to_owned()];
        query.remote_modes = vec![RemoteMode::Remote];
        query.seniorities = vec![Seniority::Senior];
        query.employment_types = vec![EmploymentType::FullTime];
        query.salary_min_usd_year = Some(100_000.0);
        query.salary_known_only = true;
        query.sources = vec!["greenhouse".to_owned()];

        let jobs = search_catalog(&connection, &query).expect("filtered search should succeed");
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0].id, 1);
    }

    #[test]
    fn every_supported_filter_changes_the_result_set() {
        let connection = fixture_catalog();
        let job_ids = |query: &SearchQuery| {
            search_catalog(&connection, query)
                .expect("filtered search should succeed")
                .into_iter()
                .map(|job| job.id)
                .collect::<Vec<_>>()
        };

        let mut skills = search_query();
        skills.skills = vec!["Rust".to_owned()];
        assert_eq!(job_ids(&skills), vec![2]);

        let mut locations = search_query();
        locations.locations = vec!["Berlin".to_owned()];
        assert_eq!(job_ids(&locations), vec![2]);

        let mut remote_modes = search_query();
        remote_modes.remote_modes = vec![RemoteMode::Hybrid];
        assert_eq!(job_ids(&remote_modes), vec![2]);

        let mut seniorities = search_query();
        seniorities.seniorities = vec![Seniority::Middle];
        assert_eq!(job_ids(&seniorities), vec![2]);

        let mut employment_types = search_query();
        employment_types.employment_types = vec![EmploymentType::Contract];
        assert_eq!(job_ids(&employment_types), vec![2]);

        let mut salary_known = search_query();
        salary_known.salary_known_only = true;
        assert_eq!(job_ids(&salary_known), vec![4, 2, 1]);

        let mut salary_minimum = search_query();
        salary_minimum.salary_min_usd_year = Some(130_000.0);
        assert_eq!(job_ids(&salary_minimum), vec![1]);

        let mut sources = search_query();
        sources.sources = vec!["lever".to_owned()];
        assert_eq!(job_ids(&sources), vec![2]);
    }

    #[test]
    fn search_uses_or_within_a_filter_and_and_between_filters() {
        let connection = fixture_catalog();
        let mut query = search_query();
        query.locations = vec!["US".to_owned(), "Berlin".to_owned()];
        query.remote_modes = vec![RemoteMode::Remote, RemoteMode::Hybrid];
        query.sort = SearchSort::Newest;

        let jobs = search_catalog(&connection, &query).expect("multi-value search should succeed");
        let ids: Vec<i64> = jobs.into_iter().map(|job| job.id).collect();
        assert_eq!(ids, vec![4, 2, 1]);
    }

    #[test]
    fn search_supports_relevance_newest_and_salary_sorting() {
        let connection = fixture_catalog();

        let mut relevance = search_query();
        relevance.text = "Rust".to_owned();
        assert_eq!(
            search_catalog(&connection, &relevance).expect("relevance search should succeed")[0].id,
            2
        );

        let mut newest = search_query();
        newest.sort = SearchSort::Newest;
        let newest_ids: Vec<i64> = search_catalog(&connection, &newest)
            .expect("newest search should succeed")
            .into_iter()
            .map(|job| job.id)
            .collect();
        assert_eq!(newest_ids, vec![4, 3, 2, 1]);

        let mut salary = search_query();
        salary.sort = SearchSort::Salary;
        let salary_ids: Vec<i64> = search_catalog(&connection, &salary)
            .expect("salary search should succeed")
            .into_iter()
            .map(|job| job.id)
            .collect();
        assert_eq!(salary_ids, vec![1, 2, 4, 3]);
    }

    #[test]
    fn source_filter_treats_sql_syntax_as_data() {
        let connection = fixture_catalog();
        let mut query = search_query();
        query.sources = vec!["greenhouse') OR 1=1 --".to_owned()];

        let jobs =
            search_catalog(&connection, &query).expect("parameterized search should succeed");
        assert!(jobs.is_empty());
        let job_count: i64 = connection
            .query_row("SELECT count(*) FROM jobs", [], |row| row.get(0))
            .expect("fixture jobs should remain available");
        assert_eq!(job_count, 4);
    }
}
