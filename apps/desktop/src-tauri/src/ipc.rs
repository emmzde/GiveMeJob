use serde::{Deserialize, Deserializer, Serialize};

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(tag = "code", rename_all = "snake_case", deny_unknown_fields)]
pub(crate) enum IpcError {
    CatalogMissing,
    CatalogCorrupt,
    CatalogBusy,
    DiskFull,
    InvalidQuery,
    NotFound,
    OpenFailed,
    RecoveryFailed,
    Internal,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
enum IpcErrorCode {
    CatalogMissing,
    CatalogCorrupt,
    CatalogBusy,
    DiskFull,
    InvalidQuery,
    NotFound,
    OpenFailed,
    RecoveryFailed,
    Internal,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct IpcErrorWire {
    code: IpcErrorCode,
}

impl<'de> Deserialize<'de> for IpcError {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let wire = IpcErrorWire::deserialize(deserializer)?;
        Ok(match wire.code {
            IpcErrorCode::CatalogMissing => Self::CatalogMissing,
            IpcErrorCode::CatalogCorrupt => Self::CatalogCorrupt,
            IpcErrorCode::CatalogBusy => Self::CatalogBusy,
            IpcErrorCode::DiskFull => Self::DiskFull,
            IpcErrorCode::InvalidQuery => Self::InvalidQuery,
            IpcErrorCode::NotFound => Self::NotFound,
            IpcErrorCode::OpenFailed => Self::OpenFailed,
            IpcErrorCode::RecoveryFailed => Self::RecoveryFailed,
            IpcErrorCode::Internal => Self::Internal,
        })
    }
}

impl IpcError {
    pub(crate) fn public_message(self) -> &'static str {
        match self {
            Self::CatalogMissing => "The local catalog is not installed.",
            Self::CatalogCorrupt => "The local catalog failed validation.",
            Self::CatalogBusy => "The local catalog is already being prepared.",
            Self::DiskFull => "There is not enough free disk space to install the catalog.",
            Self::InvalidQuery => "The request is invalid.",
            Self::NotFound => "The requested vacancy was not found.",
            Self::OpenFailed => "The local catalog could not be opened.",
            Self::RecoveryFailed => "The previous local catalog could not be restored.",
            Self::Internal => "The local operation failed.",
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::Value;

    use super::IpcError;
    use crate::catalog::CatalogStatus;
    use crate::search::dto::{
        AutocompleteRequest, FilterOptions, JobDetail, JobSummary, LocationSuggestion,
        SearchFacets, SearchPage, SearchQuery, SkillSuggestion,
    };

    const CONTRACT_FIXTURES: &str =
        include_str!("../../../../tests/contracts/m2_ipc_contracts.json");

    fn fixtures() -> Value {
        serde_json::from_str(CONTRACT_FIXTURES).expect("contract fixtures should be valid JSON")
    }

    #[test]
    fn shared_valid_contract_fixtures_deserialize() {
        let fixtures = fixtures();
        let query: SearchQuery = serde_json::from_value(fixtures["valid"]["searchQuery"].clone())
            .expect("valid search query should deserialize");
        query
            .validate()
            .expect("valid search query should validate");
        serde_json::from_value::<CatalogStatus>(fixtures["valid"]["catalogStatus"].clone())
            .expect("valid catalog status should deserialize");
        serde_json::from_value::<SearchPage<JobSummary>>(fixtures["valid"]["searchPage"].clone())
            .expect("valid search page should deserialize");
        serde_json::from_value::<JobDetail>(fixtures["valid"]["jobDetail"].clone())
            .expect("valid job detail should deserialize");
        serde_json::from_value::<SearchFacets>(fixtures["valid"]["facets"].clone())
            .expect("valid facets should deserialize");
        let autocomplete: AutocompleteRequest =
            serde_json::from_value(fixtures["valid"]["autocompleteRequest"].clone())
                .expect("valid autocomplete request should deserialize");
        autocomplete
            .validate_and_normalize()
            .expect("valid autocomplete request should validate");
        serde_json::from_value::<FilterOptions>(fixtures["valid"]["filterOptions"].clone())
            .expect("valid filter options should deserialize");
        serde_json::from_value::<Vec<SkillSuggestion>>(
            fixtures["valid"]["skillSuggestions"].clone(),
        )
        .expect("valid skill suggestions should deserialize");
        serde_json::from_value::<Vec<LocationSuggestion>>(
            fixtures["valid"]["locationSuggestions"].clone(),
        )
        .expect("valid location suggestions should deserialize");
        for error in fixtures["valid"]["ipcErrors"]
            .as_array()
            .expect("IPC errors fixture should be an array")
        {
            serde_json::from_value::<IpcError>(error.clone())
                .expect("valid IPC error should deserialize");
        }
    }

    #[test]
    fn shared_invalid_autocomplete_fixtures_are_rejected() {
        let fixtures = fixtures();
        for case in fixtures["invalidAutocompleteRequests"]
            .as_array()
            .expect("invalid autocomplete fixtures should be an array")
        {
            let result = serde_json::from_value::<AutocompleteRequest>(case["value"].clone())
                .map_err(|_| IpcError::InvalidQuery)
                .and_then(|request| request.validate_and_normalize().map(|_| ()));
            assert_eq!(
                result,
                Err(IpcError::InvalidQuery),
                "fixture: {}",
                case["name"]
            );
        }
    }

    #[test]
    fn shared_invalid_query_fixtures_are_rejected() {
        let fixtures = fixtures();
        for case in fixtures["invalidSearchQueries"]
            .as_array()
            .expect("invalid query fixtures should be an array")
        {
            let result = serde_json::from_value::<SearchQuery>(case["value"].clone())
                .map_err(|_| IpcError::InvalidQuery)
                .and_then(|query| query.validate());
            assert_eq!(
                result,
                Err(IpcError::InvalidQuery),
                "fixture: {}",
                case["name"]
            );
        }
    }

    #[test]
    fn unicode_limits_count_scalars_instead_of_utf8_bytes() {
        let fixtures = fixtures();
        for case in fixtures["unicodeLengthCases"]
            .as_array()
            .expect("Unicode fixtures should be an array")
        {
            let scalar = case["scalar"].as_str().expect("scalar should be a string");
            let count = case["count"].as_u64().expect("count should be numeric") as usize;
            let valid = case["valid"].as_bool().expect("valid should be boolean");
            let mut query: SearchQuery =
                serde_json::from_value(fixtures["valid"]["searchQuery"].clone())
                    .expect("base query should deserialize");
            query.text = scalar.repeat(count);
            assert_eq!(query.validate().is_ok(), valid, "fixture: {}", case["name"]);
        }
    }

    #[test]
    fn shared_job_description_limit_counts_unicode_scalars() {
        let fixtures = fixtures();
        for case in fixtures["descriptionLengthCases"]
            .as_array()
            .expect("description length fixtures should be an array")
        {
            let scalar = case["scalar"].as_str().expect("scalar should be a string");
            let count = case["count"].as_u64().expect("count should be numeric") as usize;
            let valid = case["valid"].as_bool().expect("valid should be boolean");
            let mut detail = fixtures["valid"]["jobDetail"].clone();
            detail["description"] = Value::String(scalar.repeat(count));
            assert_eq!(
                serde_json::from_value::<JobDetail>(detail).is_ok(),
                valid,
                "fixture: {}",
                case["name"]
            );
        }
    }

    #[test]
    fn shared_unknown_response_fields_are_rejected() {
        let fixtures = fixtures();
        for case in fixtures["invalidResponses"]
            .as_array()
            .expect("invalid response fixtures should be an array")
        {
            let schema = case["schema"].as_str().expect("schema should be a string");
            let value = case["value"].clone();
            let rejected = match schema {
                "catalogStatus" => serde_json::from_value::<CatalogStatus>(value).is_err(),
                "searchPage" => serde_json::from_value::<SearchPage<JobSummary>>(value).is_err(),
                "jobDetail" => serde_json::from_value::<JobDetail>(value).is_err(),
                "facets" => serde_json::from_value::<SearchFacets>(value).is_err(),
                "filterOptions" => serde_json::from_value::<FilterOptions>(value).is_err(),
                "skillSuggestions" => {
                    serde_json::from_value::<Vec<SkillSuggestion>>(value).is_err()
                }
                "locationSuggestions" => {
                    serde_json::from_value::<Vec<LocationSuggestion>>(value).is_err()
                }
                "ipcError" => serde_json::from_value::<IpcError>(value).is_err(),
                _ => panic!("unknown fixture schema: {schema}"),
            };
            assert!(rejected, "fixture: {}", case["name"]);
        }
    }
}
