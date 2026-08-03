use serde::Deserialize;

use crate::ipc::IpcError;

const GITHUB_PROFILE_URL: &str = "https://github.com/emmzde";
const FEEDBACK_URL: &str = "https://github.com/emmzde/GiveMeJob/issues";

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum SupportLink {
    Github,
    Feedback,
}

impl SupportLink {
    fn url(self) -> &'static str {
        match self {
            Self::Github => GITHUB_PROFILE_URL,
            Self::Feedback => FEEDBACK_URL,
        }
    }
}

pub(crate) fn open_support_with<F, E>(link: SupportLink, opener: F) -> Result<(), IpcError>
where
    F: FnOnce(&str) -> Result<(), E>,
{
    opener(link.url()).map_err(|_| IpcError::OpenFailed)
}

#[cfg(test)]
mod tests {
    use std::{cell::RefCell, convert::Infallible};

    use super::{open_support_with, SupportLink};
    use crate::ipc::IpcError;

    #[test]
    fn opens_only_the_fixed_project_links() {
        for (link, expected) in [
            (SupportLink::Github, "https://github.com/emmzde"),
            (
                SupportLink::Feedback,
                "https://github.com/emmzde/GiveMeJob/issues",
            ),
        ] {
            let opened = RefCell::new(None);
            open_support_with(link, |url| {
                opened.replace(Some(url.to_owned()));
                Ok::<(), Infallible>(())
            })
            .expect("fixed support URL should open");
            assert_eq!(opened.into_inner().as_deref(), Some(expected));
        }
    }

    #[test]
    fn maps_system_browser_failure_to_closed_ipc_error() {
        let result = open_support_with(SupportLink::Github, |_: &str| Err(()));
        assert_eq!(result, Err(IpcError::OpenFailed));
    }
}
