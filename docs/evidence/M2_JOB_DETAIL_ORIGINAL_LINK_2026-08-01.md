# M2 job detail и original link — 2026-08-01

## Реализованный контракт

- `get_job({ id })` принимает только branded positive decimal `JobId` и
  валидирует его до открытия SQLite query path.
- Detail payload отдельно от feed возвращает plain-text description,
  canonical skills, employment/work mode/seniority, source, attribution и
  snapshot version.
- Максимум description на Rust/TypeScript IPC boundary — 64 000 Unicode
  scalars; максимум frozen catalog-v1 равен 36 848.
- `open_original({ jobId })` повторно читает `source_url` в Rust и для
  catalog-v1 разрешает только HTTPS URL без credentials.
- URL передаётся системному browser opener; frontend не передаёт произвольный
  URL и не открывает vacancy page в WebView.
- Description отображается как обычный React text. Raw HTML, HTML renderer и
  активные Markdown links не используются.

## Проверки

- `pnpm -C apps/desktop typecheck` — pass.
- `pnpm -C apps/desktop lint` — pass.
- `pnpm -C apps/desktop test` — 35 passed.
- `pnpm -C apps/desktop web:build` — pass.
- `cargo fmt --check --manifest-path apps/desktop/src-tauri/Cargo.toml` — pass.
- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` — pass.
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` — 71 passed,
  2 ignored после добавления финального HTTP-policy test.
- `cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets
  -- -D warnings` — pass.
- `.venv/Scripts/ruff.exe check .` — pass.
- `.venv/Scripts/ruff.exe format --check .` — pass.
- `.venv/Scripts/mypy.exe .` — pass.
- `.venv/Scripts/pytest.exe -q --basetemp <workspace-artifact-temp>` — 35
  passed.

Отдельные Rust tests покрывают `file:`, `javascript:`, `http:`, malformed,
empty/NULL и missing-job cases, а также отказ системного opener. Frontend test
подтверждает, что ошибка открытия оставляет локальный detail на экране и что
HTML/Markdown-подобный description остаётся инертным текстом.

Композитный `pnpm quality` прошёл frontend и Rust sections, но не смог запустить
Python section из-за отсутствия `uv` в `PATH` desktop-сеанса. Те же Python gates
выполнены напрямую из project `.venv`; pytest потребовал workspace-local
`--basetemp`, поскольку глобальный `%TEMP%\pytest-of-Emil` недоступен по ACL.
