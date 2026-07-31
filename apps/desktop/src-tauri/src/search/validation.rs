use crate::ipc::IpcError;

use super::{
    dto::{AutocompleteRequest, EmploymentType, RemoteMode, SearchQuery, Seniority},
    normalization::{normalize_filter_values, normalize_search_text},
};

pub(crate) const MAX_CURSOR_LENGTH: usize = 2_048;
pub(super) const MAX_FILTER_VALUE_LENGTH: usize = 100;
const MAX_LOCATION_FILTERS: usize = 20;
const MAX_QUERY_LENGTH: usize = 200;
const MAX_SEARCH_ITEMS: usize = 50;
const MAX_SKILL_FILTERS: usize = 50;
const MAX_SOURCE_FILTERS: usize = 20;
const MAX_SALARY_USD_YEAR: f64 = 10_000_000.0;
const MAX_AUTOCOMPLETE_ITEMS: u32 = 20;

impl AutocompleteRequest {
    pub(crate) fn validate_and_normalize(&self) -> Result<Self, IpcError> {
        if self.query.chars().count() > MAX_FILTER_VALUE_LENGTH
            || !(1..=MAX_AUTOCOMPLETE_ITEMS).contains(&self.limit)
        {
            return Err(IpcError::InvalidQuery);
        }
        Ok(Self {
            query: normalize_search_text(&self.query),
            limit: self.limit,
        })
    }
}

impl SearchQuery {
    pub(crate) fn validate(&self) -> Result<(), IpcError> {
        validate_query(self)
    }
}

pub(super) fn validate_and_normalize(request: &SearchQuery) -> Result<SearchQuery, IpcError> {
    validate_query(request)?;
    let mut normalized = request.clone();
    normalized.text = normalize_search_text(&request.text);
    normalized.skills = normalize_filter_values(&request.skills);
    normalized.locations = normalize_filter_values(&request.locations);
    normalized.sources = normalize_filter_values(&request.sources);
    normalized.remote_modes =
        sorted_unique(&request.remote_modes, |value: &RemoteMode| value.as_str());
    normalized.seniorities =
        sorted_unique(&request.seniorities, |value: &Seniority| value.as_str());
    normalized.employment_types =
        sorted_unique(&request.employment_types, |value: &EmploymentType| {
            value.as_str()
        });
    Ok(normalized)
}

fn validate_query(request: &SearchQuery) -> Result<(), IpcError> {
    if request.text.chars().count() > MAX_QUERY_LENGTH
        || normalize_search_text(&request.text).chars().count() > MAX_QUERY_LENGTH
    {
        return Err(IpcError::InvalidQuery);
    }
    validate_text_filters(&request.skills, MAX_SKILL_FILTERS)?;
    validate_text_filters(&request.locations, MAX_LOCATION_FILTERS)?;
    validate_text_filters(&request.sources, MAX_SOURCE_FILTERS)?;
    if request.remote_modes.len() > 3
        || request.seniorities.len() > 10
        || request.employment_types.len() > 7
    {
        return Err(IpcError::InvalidQuery);
    }
    if let Some(salary) = request.salary_min_usd_year {
        if !salary.is_finite() || !(0.0..=MAX_SALARY_USD_YEAR).contains(&salary) {
            return Err(IpcError::InvalidQuery);
        }
    }
    if !(1..=MAX_SEARCH_ITEMS as u32).contains(&request.limit) {
        return Err(IpcError::InvalidQuery);
    }
    if request
        .cursor
        .as_ref()
        .is_some_and(|cursor| cursor.is_empty() || cursor.len() > MAX_CURSOR_LENGTH)
    {
        return Err(IpcError::InvalidQuery);
    }
    Ok(())
}

fn validate_text_filters(values: &[String], max_items: usize) -> Result<(), IpcError> {
    if values.len() > max_items
        || values.iter().any(|value| {
            value.chars().count() > MAX_FILTER_VALUE_LENGTH
                || super::normalization::normalize_filter_value(value).is_empty()
        })
    {
        return Err(IpcError::InvalidQuery);
    }
    Ok(())
}

fn sorted_unique<T, F>(values: &[T], key: F) -> Vec<T>
where
    T: Clone,
    F: Fn(&T) -> &'static str,
{
    let mut normalized = values.to_vec();
    normalized.sort_unstable_by_key(|value| key(value));
    normalized.dedup_by(|left, right| key(left) == key(right));
    normalized
}

#[cfg(test)]
mod tests {
    use super::validate_and_normalize;
    use crate::search::dto::{RemoteMode, Seniority};
    use crate::search::tests::search_query;

    #[test]
    fn query_and_filter_arrays_are_normalized_sorted_and_deduplicated() {
        let mut query = search_query();
        query.text = "  Cafe\u{301}\tDeveloper ".to_owned();
        query.skills = vec!["SQL".to_owned(), "Python".to_owned(), "Python".to_owned()];
        query.locations = vec!["  New\tYork ".to_owned(), "Berlin".to_owned()];
        query.remote_modes = vec![RemoteMode::Remote, RemoteMode::Hybrid, RemoteMode::Remote];
        query.seniorities = vec![Seniority::Senior, Seniority::Junior, Seniority::Senior];

        let normalized = validate_and_normalize(&query).expect("query should normalize");
        assert_eq!(normalized.text, "café developer");
        assert_eq!(normalized.skills, vec!["Python", "SQL"]);
        assert_eq!(normalized.locations, vec!["Berlin", "New York"]);
        assert_eq!(
            normalized.remote_modes,
            vec![RemoteMode::Hybrid, RemoteMode::Remote]
        );
        assert_eq!(
            normalized.seniorities,
            vec![Seniority::Junior, Seniority::Senior]
        );
    }
}
