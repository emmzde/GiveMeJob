use std::{env, path::PathBuf, time::Instant};

use base64::Engine as _;
use rusqlite::{params_from_iter, Connection, OpenFlags};
use serde::Deserialize;

use crate::ipc::IpcError;

use super::{
    aliases::embedded_alias_maps,
    cursor::{decode_cursor, query_fingerprint, TEST_CURSOR_VERSION},
    dto::{
        AutocompleteRequest, EffectiveSort, EmploymentType, LocationKind, RemoteMode, SearchQuery,
        SearchSort, Seniority,
    },
    get_facets, get_filter_options, get_job_detail,
    query_builder::{build_query_parts, placeholders},
    search_catalog,
    validation::validate_and_normalize,
    {autocomplete_locations, autocomplete_skills},
};

const GOLDEN_FIXTURES: &str = include_str!("../../../../../tests/fixtures/m2_search_golden.json");

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct GoldenFile {
    schema_version: u8,
    cases: Vec<GoldenCase>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct GoldenCase {
    name: String,
    query: String,
    expected_title: Option<String>,
    suggestion: Option<String>,
}

pub(super) fn search_query() -> SearchQuery {
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
        limit: 2,
        cursor: None,
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
              title_normalized TEXT NOT NULL,
              company TEXT NOT NULL,
              location_text TEXT NOT NULL,
              description_text TEXT NOT NULL,
              skills_text TEXT NOT NULL,
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
              attribution TEXT NOT NULL,
              source_url TEXT NOT NULL,
              apply_url TEXT,
              snapshot_version TEXT NOT NULL
            );
            CREATE TABLE skills (
              id INTEGER PRIMARY KEY,
              canonical_name TEXT NOT NULL UNIQUE,
              aliases_json TEXT NOT NULL DEFAULT '[]'
            );
            CREATE TABLE job_skills (
              job_id INTEGER NOT NULL,
              skill_id INTEGER NOT NULL,
              PRIMARY KEY (job_id, skill_id)
            );
            CREATE VIRTUAL TABLE jobs_fts USING fts5(
              title, skills_text, company, location_text, description_text,
              search_aliases, content = 'jobs', content_rowid = 'id',
              tokenize = 'unicode61 remove_diacritics 2', prefix = '2 3 4'
            );
            CREATE INDEX jobs_location_idx ON jobs(country, city, remote_mode, id);
            CREATE INDEX jobs_salary_idx ON jobs(salary_usd_year, id);

            INSERT INTO skills (id, canonical_name, aliases_json) VALUES
              (1, 'Python (computer programming)', '["Python"]');
            INSERT INTO skills (id, canonical_name) VALUES
              (2, 'Rust'), (3, 'C++'), (4, 'C Sharp'),
              (5, '.NET'), (6, 'Node.js'), (7, 'Playwright'), (8, 'Selenium'),
              (9, 'data science');

            INSERT INTO jobs (
              id, title, title_normalized, company, location_text,
              description_text, skills_text, search_aliases, remote_mode,
              seniority, employment_type, country, city, salary_min, salary_max,
              salary_currency, salary_period, salary_usd_year, posted_at, source,
              attribution, source_url, apply_url, snapshot_version
            ) VALUES
              (1, 'Python Developer', 'python developer', 'Acme', 'Remote',
               'Build APIs and reliable services.', 'Python', '', 'remote', 'senior',
               'full_time', 'US', 'New York', 130000, 150000, 'USD', 'year', 140000,
               '2026-01-03T00:00:00Z', 'greenhouse', 'Greenhouse', 'https://example.test/1', NULL, '1'),
              (2, 'Backend Engineer', 'backend engineer', 'Words', 'Berlin',
               'A Python developer is mentioned only in this description.', 'Rust', '', 'hybrid',
               'middle', 'contract', 'DE', 'Berlin', 110000, 130000, 'USD', 'year',
               120000, '2026-01-04T00:00:00Z', 'lever', 'Lever', 'https://example.test/2', NULL, '1'),
              (3, 'Backend Developer', 'backend developer', 'Server', 'Remote',
               'Серверная разработка.', 'Rust', '', 'remote', 'middle', 'full_time',
               'AZ', 'Baku', NULL, NULL, NULL, NULL, NULL, '2026-01-05T00:00:00Z',
               'himalayas', 'Himalayas', 'https://example.test/3', NULL, '1'),
              (4, 'Data Scientist', 'data scientist', 'Data', 'London',
               'Machine learning research.', 'data science', '', 'onsite', 'senior',
               'full_time', 'GB', 'London', 100000, 120000, 'USD', 'year', 110000,
               '2026-01-06T00:00:00Z', 'arbeitnow', 'Arbeitnow', 'https://example.test/4', NULL, '1'),
              (5, 'C++ Developer', 'c++ developer', 'Native', 'Remote',
               'Systems programming.', 'C++', '', 'remote', 'senior', 'full_time',
               'US', 'Austin', 150000, 170000, 'USD', 'year', 160000,
               '2026-01-07T00:00:00Z', 'greenhouse', 'Greenhouse', 'https://example.test/5', NULL, '1'),
              (6, 'C# Developer', 'c# developer', 'Dot', 'Remote',
               'Enterprise services.', 'C Sharp', '', 'remote', 'middle', 'full_time',
               'US', 'Seattle', 120000, 140000, 'USD', 'year', 130000,
               '2026-01-08T00:00:00Z', 'greenhouse', 'Greenhouse', 'https://example.test/6', NULL, '1'),
              (7, '.NET Developer', '.net developer', 'Framework', 'Remote',
               'Web services.', '.NET', '', 'remote', 'middle', 'full_time',
               'CA', 'Toronto', 100000, 120000, 'USD', 'year', 110000,
               '2026-01-09T00:00:00Z', 'lever', 'Lever', 'https://example.test/7', NULL, '1'),
              (8, 'Node.js Developer', 'node.js developer', 'JS', 'Remote',
               'Event-driven services.', 'Node.js', '', 'remote', 'middle', 'full_time',
               'GB', 'London', 100000, 120000, 'USD', 'year', 110000,
               '2026-01-10T00:00:00Z', 'lever', 'Lever', 'https://example.test/8', NULL, '1'),
              (9, 'Playwright QA', 'playwright qa', 'Browser', 'Remote',
               'Browser automation.', 'Playwright', '', 'remote', 'middle', 'full_time',
               'PL', 'Warsaw', 80000, 100000, 'USD', 'year', 90000,
               '2026-01-11T00:00:00Z', 'lever', 'Lever', 'https://example.test/9', NULL, '1'),
              (10, 'Selenium QA', 'selenium qa', 'Legacy', 'Remote',
               'Webdriver automation.', 'Selenium', '', 'remote', 'middle', 'full_time',
               'PL', 'Warsaw', 70000, 90000, 'USD', 'year', 80000,
               '2026-01-12T00:00:00Z', 'lever', 'Lever', 'https://example.test/10', NULL, '1'),
              (11, 'Rust Developer', 'rust developer', 'Ferris', 'Berlin',
               'Memory-safe systems.', 'Rust', '', 'hybrid', 'middle', 'contract',
               'DE', 'Berlin', 115000, 125000, 'USD', 'year', 120000,
               '2026-01-13T00:00:00Z', 'lever', 'Lever', 'https://example.test/11', NULL, '1');

            INSERT INTO job_skills (job_id, skill_id) VALUES
              (1, 1), (2, 2), (3, 2), (4, 9), (5, 3), (6, 4), (7, 5),
              (8, 6), (9, 7), (10, 8), (11, 2);
            INSERT INTO jobs_fts(
              rowid, title, skills_text, company, location_text,
              description_text, search_aliases
            )
            SELECT id, title, skills_text, company, location_text,
                   description_text, search_aliases
            FROM jobs;
            "#,
        )
        .expect("fixture schema should be valid");
    connection
}

fn collect_all_ids(connection: &Connection, mut query: SearchQuery) -> Vec<String> {
    let mut ids = Vec::new();
    loop {
        let page = search_catalog(connection, &query, "catalog-v1")
            .expect("paginated search should succeed");
        ids.extend(page.items.iter().map(|job| job.id.as_str().to_owned()));
        let Some(cursor) = page.next_cursor else {
            break;
        };
        query.cursor = Some(cursor);
    }
    ids
}

fn local_artifact_path() -> Option<PathBuf> {
    env::var_os("GIVEMEJOB_CATALOG_PATH")
        .map(PathBuf::from)
        .or_else(|| {
            let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../../../.artifacts/catalog/catalog-v1.sqlite");
            path.exists().then_some(path)
        })
}

fn artifact_connection() -> Option<Connection> {
    let path = local_artifact_path()?;
    let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .expect("local frozen catalog should open read-only");
    connection
        .execute_batch("PRAGMA query_only = ON; PRAGMA temp_store = MEMORY;")
        .expect("artifact harness pragmas should apply");
    Some(connection)
}

fn filtered_ids(connection: &Connection, query: &SearchQuery) -> Vec<i64> {
    let query = validate_and_normalize(query).expect("filter query should normalize");
    let aliases = embedded_alias_maps().expect("embedded aliases should load");
    let parts = build_query_parts(&query, aliases);
    let sql = format!(
        "SELECT job.id {} {} ORDER BY job.id",
        parts.from, parts.where_clause
    );
    let mut statement = connection
        .prepare(&sql)
        .expect("filtered ID SQL should prepare");
    statement
        .query_map(params_from_iter(parts.where_parameters.iter()), |row| {
            row.get(0)
        })
        .expect("filtered ID SQL should execute")
        .collect::<Result<Vec<_>, _>>()
        .expect("filtered IDs should decode")
}

fn query_plan(connection: &Connection, query: &SearchQuery) -> Vec<String> {
    let query = validate_and_normalize(query).expect("plan query should normalize");
    let aliases = embedded_alias_maps().expect("embedded aliases should load");
    let parts = build_query_parts(&query, aliases);
    let sql = format!(
        "EXPLAIN QUERY PLAN SELECT job.id {} {}",
        parts.from, parts.where_clause
    );
    let mut statement = connection
        .prepare(&sql)
        .expect("query plan SQL should prepare");
    statement
        .query_map(params_from_iter(parts.where_parameters.iter()), |row| {
            row.get(3)
        })
        .expect("query plan SQL should execute")
        .collect::<Result<Vec<_>, _>>()
        .expect("query plan should decode")
}

#[test]
fn golden_ru_en_mixed_phrase_alias_and_typo_cases() {
    let golden: GoldenFile =
        serde_json::from_str(GOLDEN_FIXTURES).expect("golden fixtures should deserialize");
    assert_eq!(golden.schema_version, 1);
    let connection = fixture_catalog();
    for case in golden.cases {
        let mut query = search_query();
        query.limit = 50;
        query.text = case.query;
        let page = search_catalog(&connection, &query, "catalog-v1")
            .unwrap_or_else(|error| panic!("golden case {} failed: {error:?}", case.name));
        assert_eq!(
            page.items.first().map(|job| job.title.as_str()),
            case.expected_title.as_deref(),
            "golden case: {}",
            case.name
        );
        assert_eq!(
            page.suggestion, case.suggestion,
            "golden case: {}",
            case.name
        );
    }
}

#[test]
fn exact_title_ranks_above_description_only_match() {
    let connection = fixture_catalog();
    let mut query = search_query();
    query.limit = 50;
    query.text = "python developer".to_owned();
    let page = search_catalog(&connection, &query, "catalog-v1").expect("search should work");
    assert_eq!(page.items[0].title, "Python Developer");
    assert_eq!(page.items[1].title, "Backend Engineer");
}

#[test]
fn exact_canonical_skill_ranks_above_description_only_mention() {
    let connection = fixture_catalog();
    let mut query = search_query();
    query.limit = 50;
    query.text = "python".to_owned();
    let page = search_catalog(&connection, &query, "catalog-v1").expect("search should work");
    assert_eq!(page.items[0].title, "Python Developer");
    assert_eq!(page.items[1].title, "Backend Engineer");
}

#[test]
fn selenium_and_playwright_resolve_to_distinct_canonical_skills() {
    let connection = fixture_catalog();
    let mut query = search_query();
    query.limit = 50;
    query.text = "playwright".to_owned();
    let page = search_catalog(&connection, &query, "catalog-v1").expect("search should work");
    assert_eq!(page.items[0].title, "Playwright QA");
    assert!(page.items.iter().all(|job| job.title != "Selenium QA"));
}

#[test]
fn search_filters_are_or_within_categories_and_and_between_them() {
    let connection = fixture_catalog();
    let mut query = search_query();
    query.limit = 50;
    query.locations = vec!["US".to_owned(), "Berlin".to_owned(), "US".to_owned()];
    query.remote_modes = vec![RemoteMode::Remote, RemoteMode::Hybrid];
    query.employment_types = vec![EmploymentType::FullTime, EmploymentType::Contract];
    query.seniorities = vec![Seniority::Senior, Seniority::Middle];
    let page = search_catalog(&connection, &query, "catalog-v1").expect("search should work");
    assert_eq!(
        page.items
            .iter()
            .map(|job| job.id.as_str())
            .collect::<Vec<_>>(),
        vec!["11", "6", "5", "2", "1"]
    );
}

#[test]
fn every_filter_has_an_exact_fixture_backed_case() {
    let connection = fixture_catalog();
    let cases = [
        {
            let mut query = search_query();
            query.skills = vec!["Python (computer programming)".to_owned()];
            ("skill", query, vec!["1"])
        },
        {
            let mut query = search_query();
            query.locations = vec!["Berlin".to_owned()];
            ("location", query, vec!["11", "2"])
        },
        {
            let mut query = search_query();
            query.remote_modes = vec![RemoteMode::Onsite];
            ("remote", query, vec!["4"])
        },
        {
            let mut query = search_query();
            query.seniorities = vec![Seniority::Senior];
            ("seniority", query, vec!["5", "4", "1"])
        },
        {
            let mut query = search_query();
            query.employment_types = vec![EmploymentType::Contract];
            ("employment", query, vec!["11", "2"])
        },
        {
            let mut query = search_query();
            query.salary_min_usd_year = Some(150_000.0);
            ("salary", query, vec!["5"])
        },
        {
            let mut query = search_query();
            query.sources = vec!["arbeitnow".to_owned()];
            ("source", query, vec!["4"])
        },
    ];
    for (name, mut query, expected_ids) in cases {
        query.limit = 50;
        let page = search_catalog(&connection, &query, "catalog-v1")
            .unwrap_or_else(|error| panic!("{name} filter failed: {error:?}"));
        assert_eq!(
            page.items
                .iter()
                .map(|job| job.id.as_str())
                .collect::<Vec<_>>(),
            expected_ids,
            "filter: {name}"
        );
    }
}

#[test]
fn skills_and_locations_are_or_while_filter_categories_are_and() {
    let connection = fixture_catalog();

    let mut skills = search_query();
    skills.limit = 50;
    skills.skills = vec![
        "Python (computer programming)".to_owned(),
        "Rust".to_owned(),
    ];
    let skill_page = search_catalog(&connection, &skills, "catalog-v1").expect("skill OR");
    assert_eq!(skill_page.total, Some(4));

    let mut locations = search_query();
    locations.limit = 50;
    locations.locations = vec!["Berlin".to_owned(), "New York".to_owned()];
    let location_page = search_catalog(&connection, &locations, "catalog-v1").expect("location OR");
    assert_eq!(location_page.total, Some(3));

    let mut combined = search_query();
    combined.limit = 50;
    combined.skills = vec!["Python (computer programming)".to_owned()];
    combined.locations = vec!["US".to_owned()];
    combined.remote_modes = vec![RemoteMode::Remote];
    combined.salary_min_usd_year = Some(130_000.0);
    combined.sources = vec!["greenhouse".to_owned()];
    let combined_page = search_catalog(&connection, &combined, "catalog-v1").expect("category AND");
    assert_eq!(
        combined_page
            .items
            .iter()
            .map(|job| job.id.as_str())
            .collect::<Vec<_>>(),
        vec!["1"]
    );
}

#[test]
fn salary_threshold_boundary_fixtures_are_exact() {
    let connection = fixture_catalog();
    for (name, threshold, expected_total) in [
        ("zero", 0.0, 10),
        ("ordinary", 120_000.0, 5),
        ("maximum", 10_000_000.0, 0),
        ("absent result", 200_000.0, 0),
    ] {
        let mut query = search_query();
        query.limit = 50;
        query.salary_min_usd_year = Some(threshold);
        let page = search_catalog(&connection, &query, "catalog-v1")
            .unwrap_or_else(|error| panic!("salary fixture {name} failed: {error:?}"));
        assert_eq!(page.total, Some(expected_total), "salary fixture: {name}");
        assert!(page.items.iter().all(|job| {
            job.salary_min.is_some() || job.salary_max.is_some() || expected_total == 0
        }));
    }

    let mut salary_sort = search_query();
    salary_sort.limit = 50;
    salary_sort.salary_min_usd_year = Some(120_000.0);
    salary_sort.sort = SearchSort::Salary;
    let page = search_catalog(&connection, &salary_sort, "catalog-v1")
        .expect("salary threshold and salary sort should compose");
    assert_eq!(page.total, Some(5));
    assert_eq!(
        page.items
            .iter()
            .map(|job| job.id.as_str())
            .collect::<Vec<_>>(),
        vec!["5", "1", "6", "2", "11"]
    );
    salary_sort.limit = 2;
    assert_eq!(
        collect_all_ids(&connection, salary_sort),
        vec!["5", "1", "6", "2", "11"]
    );
}

#[test]
fn relevance_with_location_preselection_keeps_bm25_and_exact_total() {
    let connection = fixture_catalog();
    let mut query = search_query();
    query.limit = 50;
    query.text = "python".to_owned();
    query.locations = vec!["Berlin".to_owned()];
    let page = search_catalog(&connection, &query, "catalog-v1")
        .expect("FTS and location preselection should compose");
    assert_eq!(page.total, Some(1));
    assert_eq!(page.items[0].id.as_str(), "2");
}

#[test]
fn filter_options_and_autocomplete_use_catalog_values() {
    let connection = fixture_catalog();
    let options = get_filter_options(&connection).expect("filter options should load");
    assert_eq!(options.remote_modes, RemoteMode::ALL);
    assert_eq!(options.seniorities, Seniority::ALL);
    assert_eq!(options.employment_types, EmploymentType::ALL);
    assert!(options
        .sources
        .iter()
        .any(|source| source.source == "lever" && source.count == 6));

    let skills = autocomplete_skills(
        &connection,
        &AutocompleteRequest {
            query: "Python".to_owned(),
            limit: 10,
        },
    )
    .expect("skill autocomplete should work");
    assert_eq!(skills[0].label, "Python");
    assert_eq!(skills[0].canonical_name, "Python (computer programming)");
    assert_eq!(skills[0].count, 1);

    let locations = autocomplete_locations(
        &connection,
        &AutocompleteRequest {
            query: "Berlin".to_owned(),
            limit: 10,
        },
    )
    .expect("location autocomplete should work");
    assert_eq!(locations[0].canonical_value, "Berlin");
    assert_eq!(locations[0].kind, LocationKind::City);
    assert_eq!(locations[0].count, 2);

    let too_long = "x".repeat(101);
    connection
        .execute("UPDATE jobs SET city = ? WHERE id = 3", [too_long])
        .expect("fixture location should update");
    let bounded = autocomplete_locations(
        &connection,
        &AutocompleteRequest {
            query: "xxx".to_owned(),
            limit: 10,
        },
    )
    .expect("bounded location autocomplete should work");
    assert!(bounded.is_empty());
}

#[test]
fn candidate_preselection_keeps_legacy_location_ids() {
    let connection = fixture_catalog();
    for locations in [
        vec!["Berlin".to_owned()],
        vec!["New York".to_owned()],
        vec!["US".to_owned()],
        vec!["Berlin".to_owned(), "New York".to_owned()],
        vec!["__gmj_missing_location__".to_owned()],
    ] {
        let mut query = search_query();
        query.locations = locations.clone();
        let actual = filtered_ids(&connection, &query);
        let value_placeholders = placeholders(locations.len());
        let legacy_sql = format!(
            "SELECT id FROM jobs
             WHERE country IN ({value_placeholders})
                OR city IN ({value_placeholders})
                OR location_text IN ({value_placeholders})
             ORDER BY id"
        );
        let parameters = locations.iter().cycle().take(locations.len() * 3);
        let expected = connection
            .prepare(&legacy_sql)
            .expect("legacy location SQL should prepare")
            .query_map(params_from_iter(parameters), |row| row.get(0))
            .expect("legacy location SQL should execute")
            .collect::<Result<Vec<i64>, _>>()
            .expect("legacy IDs should decode");
        assert_eq!(actual, expected, "locations: {locations:?}");
    }
}

#[test]
fn candidate_query_plans_use_existing_location_and_salary_indexes() {
    let connection = fixture_catalog();
    for location in ["Berlin", "__gmj_missing_location__"] {
        let mut query = search_query();
        query.locations = vec![location.to_owned()];
        let plan = query_plan(&connection, &query).join("\n");
        assert!(plan.contains("jobs_location_idx"), "{plan}");
        assert!(plan.contains("jobs_fts"), "{plan}");
    }
    for threshold in [0.0, 10_000_000.0] {
        let mut query = search_query();
        query.salary_min_usd_year = Some(threshold);
        let plan = query_plan(&connection, &query).join("\n");
        assert!(plan.contains("jobs_salary_idx"), "{plan}");
    }
}

#[test]
fn pagination_is_stable_for_all_sorts_and_null_values() {
    let connection = fixture_catalog();
    let newest = collect_all_ids(&connection, search_query());
    assert_eq!(newest.len(), 11);
    assert_eq!(newest[0], "11");

    let mut salary = search_query();
    salary.sort = SearchSort::Salary;
    let salary_ids = collect_all_ids(&connection, salary);
    assert_eq!(salary_ids.len(), 11);
    assert_eq!(salary_ids[0], "5");
    assert_eq!(salary_ids.last().map(String::as_str), Some("3"));

    let mut relevance = search_query();
    relevance.text = "python".to_owned();
    assert_eq!(collect_all_ids(&connection, relevance), vec!["1", "2"]);
}

#[test]
fn suggestion_is_not_applied_and_only_appears_for_weak_first_page() {
    let connection = fixture_catalog();
    let mut typo = search_query();
    typo.limit = 50;
    typo.text = "pyhton developer".to_owned();
    let typo_page = search_catalog(&connection, &typo, "catalog-v1").expect("search should work");
    assert!(typo_page.items.is_empty());
    assert_eq!(typo_page.suggestion.as_deref(), Some("python developer"));

    let mut strong = search_query();
    strong.limit = 50;
    strong.text = "developer".to_owned();
    let strong_page =
        search_catalog(&connection, &strong, "catalog-v1").expect("search should work");
    assert!(strong_page.total.expect("first page total") > 3);
    assert_eq!(strong_page.suggestion, None);
}

#[test]
fn only_first_page_contains_exact_total() {
    let connection = fixture_catalog();
    let query = search_query();
    let first = search_catalog(&connection, &query, "catalog-v1").expect("first page");
    assert_eq!(first.total, Some(11));
    let mut second_query = query;
    second_query.cursor = first.next_cursor;
    let second = search_catalog(&connection, &second_query, "catalog-v1").expect("second page");
    assert_eq!(second.total, None);
    assert_eq!(second.suggestion, None);
}

#[test]
fn query_fingerprint_normalizes_unicode_filter_order_and_duplicates() {
    let mut first = search_query();
    first.text = "Café".to_owned();
    first.skills = vec!["Python".to_owned(), "SQL".to_owned()];
    first.remote_modes = vec![RemoteMode::Remote, RemoteMode::Hybrid];
    first.sources = vec!["lever".to_owned(), "greenhouse".to_owned()];

    let mut equivalent = first.clone();
    equivalent.text = "  Cafe\u{301}  ".to_owned();
    equivalent.skills = vec!["SQL".to_owned(), "Python".to_owned(), "SQL".to_owned()];
    equivalent.remote_modes.reverse();
    equivalent.sources.reverse();

    assert_eq!(
        query_fingerprint(&first).expect("fingerprint should work"),
        query_fingerprint(&equivalent).expect("fingerprint should work")
    );
}

#[test]
fn cursor_rejects_other_query_catalog_and_envelope_version() {
    let connection = fixture_catalog();
    let query = search_query();
    let page = search_catalog(&connection, &query, "catalog-v1").expect("first page");
    let cursor = page.next_cursor.expect("fixture should have another page");

    let mut changed_query = query.clone();
    changed_query.text = "Python".to_owned();
    changed_query.cursor = Some(cursor.clone());
    assert_eq!(
        search_catalog(&connection, &changed_query, "catalog-v1"),
        Err(IpcError::InvalidQuery)
    );

    let fingerprint = query_fingerprint(&query).expect("fingerprint should work");
    assert_eq!(
        decode_cursor(&cursor, "catalog-v2", &fingerprint, EffectiveSort::Newest),
        Err(IpcError::InvalidQuery)
    );

    let decoded = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(&cursor)
        .expect("cursor should decode");
    let mut envelope: serde_json::Value =
        serde_json::from_slice(&decoded).expect("cursor JSON should parse");
    envelope["version"] = serde_json::json!(TEST_CURSOR_VERSION + 1);
    let wrong_version = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .encode(serde_json::to_vec(&envelope).expect("cursor JSON should serialize"));
    assert_eq!(
        decode_cursor(
            &wrong_version,
            "catalog-v1",
            &fingerprint,
            EffectiveSort::Newest
        ),
        Err(IpcError::InvalidQuery)
    );
}

#[test]
fn source_filter_treats_sql_syntax_as_data() {
    let connection = fixture_catalog();
    let mut query = search_query();
    query.sources = vec!["lever') OR 1=1 --".to_owned()];
    let page = search_catalog(&connection, &query, "catalog-v1").expect("search should work");
    assert!(page.items.is_empty());
}

#[test]
fn job_detail_facets_and_not_found_follow_the_contract() {
    let connection = fixture_catalog();
    let job_id = super::dto::JobId::parse("1").expect("job ID should parse");
    let detail = get_job_detail(&connection, &job_id).expect("job should exist");
    assert_eq!(detail.skills, vec!["Python (computer programming)"]);
    assert_eq!(detail.source_url, "https://example.test/1");

    let facets = get_facets(&connection).expect("facets should load");
    assert!(facets.skills.iter().any(|facet| facet.skill == "Rust"));
    assert!(facets
        .locations
        .iter()
        .any(|facet| facet.location == "Remote"));
    assert!(facets.sources.iter().any(|facet| facet.source == "lever"));

    let missing = super::dto::JobId::parse("999").expect("job ID should parse");
    assert_eq!(
        get_job_detail(&connection, &missing),
        Err(IpcError::NotFound)
    );
}

#[test]
fn frozen_catalog_contract_smoke_when_local_artifact_is_available() {
    let Some(connection) = artifact_connection() else {
        return;
    };
    for text in [
        "python",
        "разработчик",
        "python разработчик",
        "\"data scientist\"",
        "cpp",
        "c#",
        ".net",
        "node.js",
        "playwright",
    ] {
        let mut query = search_query();
        query.text = text.to_owned();
        query.limit = 20;
        let page = search_catalog(&connection, &query, "1")
            .unwrap_or_else(|error| panic!("frozen search `{text}` failed: {error:?}"));
        assert!(!page.items.is_empty(), "frozen search `{text}` was empty");
    }

    let mut typo = search_query();
    typo.text = "pyhton".to_owned();
    let page = search_catalog(&connection, &typo, "1").expect("frozen typo search should work");
    assert_eq!(page.suggestion.as_deref(), Some("python"));
}

#[test]
fn frozen_artifact_filters_cover_each_closed_contract_category() {
    let Some(connection) = artifact_connection() else {
        return;
    };
    let cases = [
        {
            let mut query = search_query();
            query.skills = vec!["Python (computer programming)".to_owned()];
            ("skill", query, 9_302)
        },
        {
            let mut query = search_query();
            query.locations = vec!["Berlin".to_owned()];
            ("location", query, 16)
        },
        {
            let mut query = search_query();
            query.remote_modes = vec![RemoteMode::Remote];
            ("remote", query, 69_131)
        },
        {
            let mut query = search_query();
            query.seniorities = vec![Seniority::Senior];
            ("seniority", query, 27_609)
        },
        {
            let mut query = search_query();
            query.employment_types = vec![EmploymentType::FullTime];
            ("employment", query, 58_131)
        },
        {
            let mut query = search_query();
            query.salary_min_usd_year = Some(100_000.0);
            ("salary", query, 13_925)
        },
        {
            let mut query = search_query();
            query.sources = vec!["arbeitnow".to_owned()];
            ("source", query, 5)
        },
    ];
    for (name, mut query, expected_total) in cases {
        query.limit = 50;
        let page = search_catalog(&connection, &query, "1")
            .unwrap_or_else(|error| panic!("artifact {name} filter failed: {error:?}"));
        assert_eq!(page.total, Some(expected_total), "filter: {name}");
        assert!(!page.items.is_empty(), "filter: {name}");
    }
}

#[test]
fn frozen_artifact_or_and_filter_regressions_match_expected_counts() {
    let Some(connection) = artifact_connection() else {
        return;
    };

    let mut skill_or = search_query();
    skill_or.limit = 50;
    skill_or.skills = vec!["Python (computer programming)".to_owned(), "SQL".to_owned()];
    assert_eq!(
        search_catalog(&connection, &skill_or, "1")
            .expect("artifact skill OR")
            .total,
        Some(13_282)
    );

    let mut location_or = search_query();
    location_or.limit = 50;
    location_or.locations = vec!["Berlin".to_owned(), "New York".to_owned()];
    assert_eq!(
        search_catalog(&connection, &location_or, "1")
            .expect("artifact location OR")
            .total,
        Some(253)
    );

    let mut combined = search_query();
    combined.limit = 50;
    combined.skills = vec!["Python (computer programming)".to_owned()];
    combined.locations = vec!["US".to_owned()];
    combined.remote_modes = vec![RemoteMode::Remote];
    combined.salary_min_usd_year = Some(100_000.0);
    combined.sources = vec!["himalayas".to_owned()];
    assert_eq!(
        search_catalog(&connection, &combined, "1")
            .expect("artifact category AND")
            .total,
        Some(1_830)
    );
}

#[test]
fn frozen_artifact_filter_options_and_autocomplete_use_real_values() {
    let Some(connection) = artifact_connection() else {
        return;
    };
    let options = get_filter_options(&connection).expect("artifact filter options");
    assert_eq!(options.remote_modes, RemoteMode::ALL);
    assert_eq!(options.seniorities, Seniority::ALL);
    assert_eq!(options.employment_types, EmploymentType::ALL);
    assert_eq!(
        options
            .sources
            .iter()
            .map(|source| (source.source.as_str(), source.count))
            .collect::<Vec<_>>(),
        vec![
            ("himalayas", 68_356),
            ("greenhouse", 7_918),
            ("lever", 2_440),
            ("arbeitnow", 5),
        ]
    );

    let skills = autocomplete_skills(
        &connection,
        &AutocompleteRequest {
            query: "Python".to_owned(),
            limit: 10,
        },
    )
    .expect("artifact skill autocomplete");
    assert_eq!(skills[0].label, "Python");
    assert_eq!(skills[0].canonical_name, "Python (computer programming)");
    assert_eq!(skills[0].count, 9_302);

    for (query, kind, count) in [
        ("Berlin", LocationKind::City, 16),
        ("New York", LocationKind::City, 237),
        ("US", LocationKind::Country, 41_506),
    ] {
        let locations = autocomplete_locations(
            &connection,
            &AutocompleteRequest {
                query: query.to_owned(),
                limit: 10,
            },
        )
        .expect("artifact location autocomplete");
        let exact = locations
            .iter()
            .find(|location| location.canonical_value == query)
            .expect("exact location suggestion should exist");
        assert_eq!(exact.kind, kind, "location: {query}");
        assert_eq!(exact.count, count, "location: {query}");
    }
}

#[test]
fn frozen_artifact_new_location_pipeline_matches_legacy_ids() {
    let Some(connection) = artifact_connection() else {
        return;
    };
    for locations in [
        vec!["Berlin".to_owned()],
        vec!["New York".to_owned()],
        vec!["US".to_owned()],
        vec!["DE".to_owned()],
        vec!["Berlin".to_owned(), "New York".to_owned()],
        vec!["__gmj_missing_location__".to_owned()],
    ] {
        let mut query = search_query();
        query.locations = locations.clone();
        let actual = filtered_ids(&connection, &query);
        let value_placeholders = placeholders(locations.len());
        let legacy_sql = format!(
            "SELECT id FROM jobs
             WHERE country IN ({value_placeholders})
                OR city IN ({value_placeholders})
                OR location_text IN ({value_placeholders})
             ORDER BY id"
        );
        let parameters = locations.iter().cycle().take(locations.len() * 3);
        let mut statement = connection
            .prepare(&legacy_sql)
            .expect("legacy artifact SQL should prepare");
        let expected = statement
            .query_map(params_from_iter(parameters), |row| row.get(0))
            .expect("legacy artifact SQL should execute")
            .collect::<Result<Vec<i64>, _>>()
            .expect("legacy artifact IDs should decode");
        assert_eq!(actual, expected, "locations: {locations:?}");
    }
}

#[test]
fn frozen_artifact_sparse_query_plans_keep_preselectors() {
    let Some(connection) = artifact_connection() else {
        return;
    };
    for location in ["Berlin", "New York", "__gmj_missing_location__"] {
        let mut query = search_query();
        query.locations = vec![location.to_owned()];
        let plan = query_plan(&connection, &query).join("\n");
        assert!(plan.contains("jobs_location_idx"), "{location}: {plan}");
        assert!(plan.contains("jobs_fts"), "{location}: {plan}");
    }
    for threshold in [0.0, 100_000.0, 10_000_000.0] {
        let mut query = search_query();
        query.salary_min_usd_year = Some(threshold);
        let plan = query_plan(&connection, &query).join("\n");
        assert!(plan.contains("jobs_salary_idx"), "{threshold}: {plan}");
    }
}

fn p95_milliseconds(mut samples: Vec<f64>) -> f64 {
    samples.sort_by(f64::total_cmp);
    let index = ((samples.len() as f64 * 0.95).ceil() as usize).saturating_sub(1);
    samples[index]
}

#[test]
#[ignore = "full-corpus benchmark: 5 warm-ups and 30 measured runs per case"]
fn frozen_artifact_location_and_salary_benchmark() {
    let connection = artifact_connection().expect("full-corpus artifact is required");
    let mut scenarios = Vec::new();
    for (name, location) in [
        ("Berlin", "Berlin"),
        ("New York", "New York"),
        ("US", "US"),
        ("country-only DE", "DE"),
        ("zero location", "__gmj_missing_location__"),
    ] {
        let mut query = search_query();
        query.limit = 40;
        query.locations = vec![location.to_owned()];
        scenarios.push((name, query));
    }
    for (name, threshold) in [
        ("salary 0", 0.0),
        ("salary ordinary", 100_000.0),
        ("salary 10m", 10_000_000.0),
    ] {
        let mut query = search_query();
        query.limit = 40;
        query.salary_min_usd_year = Some(threshold);
        scenarios.push((name, query));
    }

    for (name, query) in scenarios {
        for _ in 0..5 {
            search_catalog(&connection, &query, "1").expect("benchmark warm-up should succeed");
        }
        let mut samples = Vec::with_capacity(30);
        for _ in 0..30 {
            let started = Instant::now();
            search_catalog(&connection, &query, "1").expect("benchmark query should succeed");
            samples.push(started.elapsed().as_secs_f64() * 1_000.0);
        }
        let p95 = p95_milliseconds(samples);
        println!("{name}: p95={p95:.2} ms");
        assert!(p95 < 300.0, "{name}: p95={p95:.2} ms");
    }
}
