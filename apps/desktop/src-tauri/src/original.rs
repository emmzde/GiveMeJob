use rusqlite::{Connection, OptionalExtension};
use tauri::Url;

use crate::{ipc::IpcError, search::dto::JobId};

pub(crate) fn open_original_with<F, E>(
    connection: &Connection,
    job_id: &JobId,
    opener: F,
) -> Result<(), IpcError>
where
    F: FnOnce(&str) -> Result<(), E>,
{
    let id = job_id.as_i64()?;
    let source_url = connection
        .query_row("SELECT source_url FROM jobs WHERE id = ?", [id], |row| {
            row.get::<_, Option<String>>(0)
        })
        .optional()
        .map_err(|_| IpcError::CatalogCorrupt)?
        .ok_or(IpcError::NotFound)?
        .ok_or(IpcError::OpenFailed)?;
    let source_url = source_url.trim();
    let parsed = Url::parse(source_url).map_err(|_| IpcError::OpenFailed)?;
    if parsed.scheme() != "https"
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err(IpcError::OpenFailed);
    }

    opener(parsed.as_str()).map_err(|_| IpcError::OpenFailed)
}

#[cfg(test)]
mod tests {
    use std::{cell::RefCell, convert::Infallible};

    use rusqlite::{params, Connection};

    use super::open_original_with;
    use crate::{ipc::IpcError, search::dto::JobId};

    fn fixture(url: Option<&str>) -> Connection {
        let connection = Connection::open_in_memory().expect("fixture should open");
        connection
            .execute_batch("CREATE TABLE jobs (id INTEGER PRIMARY KEY, source_url TEXT);")
            .expect("fixture schema should be valid");
        connection
            .execute(
                "INSERT INTO jobs (id, source_url) VALUES (1, ?)",
                params![url],
            )
            .expect("fixture job should insert");
        connection
    }

    fn job_id(value: &str) -> JobId {
        JobId::parse(value).expect("fixture job ID should be valid")
    }

    fn assert_rejected(url: Option<&str>) {
        let connection = fixture(url);
        let result =
            open_original_with(
                &connection,
                &job_id("1"),
                |_: &str| Ok::<(), Infallible>(()),
            );
        assert_eq!(result, Err(IpcError::OpenFailed));
    }

    #[test]
    fn opens_only_the_https_url_loaded_by_job_id() {
        let connection = fixture(Some("https://example.test/jobs/1"));
        let opened = RefCell::new(None);

        open_original_with(&connection, &job_id("1"), |url| {
            opened.replace(Some(url.to_owned()));
            Ok::<(), Infallible>(())
        })
        .expect("safe original URL should open");

        assert_eq!(
            opened.into_inner().as_deref(),
            Some("https://example.test/jobs/1")
        );
    }

    #[test]
    fn rejects_file_url() {
        assert_rejected(Some("file:///C:/Windows/System32/calc.exe"));
    }

    #[test]
    fn rejects_javascript_url() {
        assert_rejected(Some("javascript:alert(document.domain)"));
    }

    #[test]
    fn rejects_http_url_for_the_current_snapshot_policy() {
        assert_rejected(Some("http://example.test/jobs/1"));
    }

    #[test]
    fn rejects_invalid_url() {
        assert_rejected(Some("not a URL"));
    }

    #[test]
    fn rejects_missing_url() {
        assert_rejected(None);
        assert_rejected(Some("   "));
    }

    #[test]
    fn rejects_missing_job() {
        let connection = fixture(Some("https://example.test/jobs/1"));
        let result = open_original_with(&connection, &job_id("999"), |_: &str| {
            Ok::<(), Infallible>(())
        });
        assert_eq!(result, Err(IpcError::NotFound));
    }

    #[test]
    fn maps_system_browser_failure_to_closed_ipc_error() {
        let connection = fixture(Some("https://example.test/jobs/1"));
        let result = open_original_with(&connection, &job_id("1"), |_: &str| Err(()));
        assert_eq!(result, Err(IpcError::OpenFailed));
    }
}
