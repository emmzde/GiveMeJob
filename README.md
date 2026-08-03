# GiveMeJob!

GiveMeJob! is a desktop job-search application built with Tauri, Rust, React,
TypeScript and SQLite.

## Repository

- `apps/desktop` — desktop application;
- `config` — runtime and catalog data;
- `tools/catalog_export` — catalog export utilities;
- `tests` — data-tooling and contract tests;
- `docs/evidence` — historical verification records.

## Development

```powershell
pnpm install
pnpm quality

pnpm -C apps/desktop dev
pnpm -C apps/desktop typecheck
pnpm -C apps/desktop lint
pnpm -C apps/desktop test
pnpm -C apps/desktop web:build

uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run pytest -q
```

Current behavior is represented by the implementation, configuration and test
suite. Historical verification records remain under `docs/evidence`.
