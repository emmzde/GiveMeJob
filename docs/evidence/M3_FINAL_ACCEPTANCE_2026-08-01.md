# M3 final acceptance — 2026-08-01

Статус этой записи: **минимальный M3 complete** по ADR-018. Profile, shortlist
и on-demand match дают Emmy необходимый локальный фундамент. Следующий
разрешённый этап — M4. Глобальный match-sort остаётся post-M4 follow-up до M5
и не изображается готовым.

## Provenance

- source commit: `b1f6841c6c699bcda2d4ef6bbcd13db901745557`;
- worktree во время acceptance: dirty; clean-commit claim не делается;
- Windows `10.0.26200` build `26200`, AMD64, Intel Core i5-13420H;
- catalog version `1`, 78 719 jobs;
- machine-readable evidence:
  [`m3/native-v1-windows-2026-08-01.json`](m3/native-v1-windows-2026-08-01.json),
  SHA-256 `585438872f22d9a19c8286c734e4fb764cca578f9348390126c51c01f0ed10c9`.

## Gate decision

| Gate | Evidence | Result |
|---|---|---:|
| Profile UX | draft переживает смену screen; field errors, focus и Retry покрыты тестами | pass |
| `user.sqlite` schema v1 | 9 ожидаемых таблиц, WAL, `integrity_check = ok` | pass |
| Profile persistence | save → close → restart → role/location/salary видимы | pass |
| Shortlist persistence | кнопки feed/detail, screen, `s`; сохранённая вакансия видна после restart | pass |
| Match | 5 компонентов, unknown-weight redistribution, score/strengths/gaps/breakdown | pass |
| Determinism | повторный input даёт идентичный JSON; score всегда 0–100 | pass |
| Native frameless shell | реальное Tauri/WebView2 окно, drag `32×24 px`, minimize/maximize/restore/close | pass |
| Accessibility/UI | 151 frontend tests, axe smoke, Impeccable detector `[]` | pass |
| Rust | 87 passed, 4 тяжёлых diagnostics ignored; Clippy `-D warnings` | pass |
| Python/data regression | Ruff/Mypy pass, Pytest 35 passed | pass |

## Реальный Tauri smoke

Финальная debug-сборка создана командой
`pnpm -C apps/desktop exec tauri build --debug --no-bundle`. Каталог читался из
verified development artifact, а `GIVEMEJOB_USER_DATA_PATH` указывал на новый
изолированный файл
`.artifacts/m3-native-final-20260801-1851/user.sqlite`; реальный
`%LOCALAPPDATA%\GiveMeJob!` не изменялся.

В нативном frameless окне UI Automation увидела 126 элементов приложения.
Mouse drag за пустую область custom titlebar изменил позицию окна на
`32×24 px`. Собственные кнопки последовательно подтвердили maximize, restore,
minimize, restore и штатное закрытие процесса.

В первом запуске создан профиль `Final Native Engineer`, сохранены
`Baku, Azerbaijan`, minimum salary и remote mode. В detail появился локальный
match breakdown, а выбранная вакансия была добавлена в shortlist. Окно закрыто
собственной titlebar-кнопкой и запущено снова с тем же изолированным файлом.
После restart профиль восстановил role/location/salary, shortlist показал
сохранённую вакансию и её match badge. Повторное закрытие также прошло через
custom titlebar.

Read-only audit созданного файла вернул:

- `schema_version = 1`;
- `PRAGMA journal_mode = wal`;
- `PRAGMA integrity_check = ok`;
- по одной записи profile и shortlist;
- таблицы `profile`, `shortlist`, `recent_searches`, `settings`,
  `conversations`, `chat_messages`, `provider_health`, `match_cache` и
  `user_meta`.

## Match contract

Rust-модуль не использует сеть или LLM. Веса остаются нормативными: skills
40%, role 20%, seniority 15%, location/work mode 15%, salary 10%. Неизвестные
компоненты исключаются из знаменателя, поэтому их вес пропорционально
распределяется между известными. Batch IPC принимает не больше 200 уникальных
`JobId`; frontend режет показанный набор по этой границе.

Score показан как «Совпадение», а не вероятность найма. Match вычисляется для
видимых, выбранных и сохранённых вакансий. `match_cache` пока только
зарезервирован schema v1 и не заполняется.

## Bundle и UI hardening

Production build вынес Emmy в отдельный lazy chunk `4.14 kB`. Profile,
Shortlist и Settings также загружаются отдельными chunks; Profile после первого
открытия остаётся смонтированным, поэтому незаписанный draft не теряется.
Initial JS составляет `530.21 kB` (`158.97 kB` gzip). В production
`index.html` нет внутреннего `impeccable-design-contract`.

Impeccable mechanical detector завершился без findings. Frontend suite:
32 files / 151 tests; TypeScript strict, ESLint и production build прошли.

## Quality environment note

Root `pnpm quality` успешно завершил frontend и Rust, но не смог запустить
Python-секцию, потому что `uv` отсутствовал в PATH текущего desktop shell.
Те же pinned `.venv` executables запущены напрямую: Ruff check и format check,
Mypy и все 35 Pytest tests прошли. Pytest использовал новый безопасный
`--basetemp` внутри `.artifacts`, поскольку глобальный `%TEMP%\pytest-of-Emil`
был недоступен текущему процессу.

## Отложенный release scope

По ADR-018 глобальная match-сортировка всех 78 719 вакансий, `savedOnly` в
search IPC и catalog-wide пересчёт выполняются после core M4 Emmy и до M5.
Это не расширяет M4, не разрешает M5 раньше времени и не меняет offline или
determinism invariants.
