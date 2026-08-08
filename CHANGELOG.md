# Changelog

All notable changes to GiveMeJob! are documented in this file.

## [1.0.0] - 2026-08-08

### Added

- Offline Windows search across a frozen catalog of 78,719 vacancies.
- Filters, deterministic pagination, shortlist persistence and bilingual UI.
- Candidate profiles with explainable local match scoring.
- Emmy AI assistant with local tool calls, confirmation-gated writes, BYOK credentials and provider fallback.
- NSIS and portable Windows release packaging with SHA-256 checksums.

### Security and privacy

- Search, profiles and saved jobs persist locally.
- AI credentials are stored through Windows Credential Manager.
- External links are validated before opening and provider errors are redacted.

### Known limitations

- Windows binaries are not code-signed and may trigger SmartScreen.
- The bundled catalog is a frozen snapshot and does not update in-app yet.

[1.0.0]: https://github.com/emmzde/GiveMeJob/releases/tag/v1.0.0
