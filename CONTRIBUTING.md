# Contributing

Thanks for taking an interest in GiveMeJob! Keep changes focused and explain
the user-visible outcome in the pull request.

## Setup

Use Node.js 24+, pnpm 11.9, stable Rust, Python 3.13 and `uv`.

```powershell
pnpm install --frozen-lockfile
uv sync --locked --all-groups
pnpm quality
```

Run `pnpm desktop:dev` for local UI work. The normal desktop runtime is local
and does not require PostgreSQL. Catalog-export work requires a development
database configured through an untracked `.env` file.

## Pull requests

- Add or update tests for behavior changes.
- Keep all five project versions aligned; `pnpm quality:metadata` checks them.
- Follow `docs/design-tokens.css` for visual work. Do not introduce new visual values
  or generic framework accents outside the documented tokens.
- Do not commit generated installers, catalog archives, temporary screenshots,
  credentials or local databases.
- Run `pnpm quality` before requesting review.

Never place provider keys in source, fixtures, logs, issue reports or pull
requests. Use obvious placeholders in tests.
