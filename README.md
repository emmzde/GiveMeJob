# GiveMeJob!

[![Quality](https://github.com/emmzde/GiveMeJob/actions/workflows/quality.yml/badge.svg)](https://github.com/emmzde/GiveMeJob/actions/workflows/quality.yml)
[![Windows release](https://img.shields.io/github/v/release/emmzde/GiveMeJob?include_prereleases&sort=semver)](https://github.com/emmzde/GiveMeJob/releases)

GiveMeJob! is an offline-first Windows job-search desktop app. It combines a
frozen local vacancy catalog, SQLite FTS5 search, a candidate profile,
explainable match scores and an optional AI career assistant named Emmy.

> Pet-project status: the app is usable, but installers are currently unsigned
> and Windows may show a SmartScreen warning. Only download builds from this
> repository's Releases page and verify `SHA256SUMS.txt`.

## Highlights

- local full-text search across 78,719 frozen vacancies;
- filters, shortlist and deterministic pagination without a hosted backend;
- explainable matching against a locally stored candidate profile;
- optional Emmy assistant with BYOK credentials stored in Windows Credential
  Manager;
- Russian and English UI, keyboard navigation and accessibility tests;
- NSIS installer and portable ZIP produced by GitHub Actions.

## Stack

- Tauri 2 and Rust for the native Windows shell and local data layer;
- React 19, TypeScript, Vite and TanStack Query for the UI;
- SQLite FTS5 for offline search;
- Python 3.13 tooling for deterministic catalog exports.

## Local development

Requirements: Node.js 24+, pnpm 11.9, stable Rust and Python 3.13 with
[uv](https://docs.astral.sh/uv/).

```powershell
corepack enable
pnpm install --frozen-lockfile
uv sync --locked --all-groups

pnpm desktop:dev
```

The desktop app does not need a PostgreSQL server at runtime. PostgreSQL is
used only by the developer-side catalog exporter. Copy `.env.example` to `.env`
only when you work on that exporter; never commit the resulting file.

## Quality gates

```powershell
pnpm quality
```

The command checks aligned release metadata, TypeScript, ESLint, 180 frontend
tests, the production web bundle, Rust formatting/checks/tests/clippy and the
Python exporter suite. The same gates run in GitHub Actions for every pull
request.

## Releases

Windows artifacts are built from the default branch by the manually approved
`Windows release` workflow. It verifies the frozen catalog hash, runs the
quality gates, creates an NSIS installer and portable ZIP, and can publish both
to a versioned GitHub Release with SHA-256 checksums.

See [docs/RELEASING.md](docs/RELEASING.md) for the release checklist and GitHub
environment setup.

## Repository layout

- `apps/desktop` — Tauri desktop application;
- `config` — product, search and frozen-catalog metadata;
- `tools/catalog_export` — deterministic catalog export utilities;
- `tests` — exporter and contract tests;
- `docs/evidence` — historical acceptance and benchmark records.

## Security and privacy

Search, profiles and shortlists stay on the local machine. Network access is
used only when the user opens an original vacancy or enables an AI provider.
Read [SECURITY.md](SECURITY.md) before configuring demo provider credentials.

## Contributing and license

Small, focused pull requests are welcome; see
[CONTRIBUTING.md](CONTRIBUTING.md). No open-source license has been selected
yet, so the repository does not currently grant reuse or redistribution rights.
