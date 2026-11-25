# Changelog

All notable changes to GiveMeJob! are documented in this file.

## [1.1.0] - 2026-11-26

### Changed

- New OLED-black interface: true-black canvas, grouped cards with notch corners, pill controls, thin display headings and sort tabs.
- UI text uses Segoe UI Variable on Windows; mid-size headings and icon strokes are tuned for 100% display scaling.
- Emmy is now an animated 3D Shiba: breathing, blinking, tail wag, pointer tracking, state animations and petting with hearts.
- New app icon and brand mark built from the Emmy render.
- Job details show the match score as a gauge with a per-factor breakdown.
- Settings regrouped into Emmy & AI, Appearance and Local catalog; quick-setup presets for OpenRouter, Groq, Gemini, Ollama and LM Studio.
- Emmy shows an animated thinking indicator and a round avatar in the titlebar and chat.

### Fixed

- Persistent blur filters and composited layers from entrance animations no longer soften text.
- Detail panel floats over the list on windows narrower than 1180 px instead of squeezing it.

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

[1.1.0]: https://github.com/emmzde/GiveMeJob/releases/tag/v1.1.0
[1.0.0]: https://github.com/emmzde/GiveMeJob/releases/tag/v1.0.0
