# M2 final acceptance — 2026-08-01

Статус этой записи: **M2 complete**. Все обязательные hard gates из
`docs/PLAN.md` и `docs/METRICS.md` фактически пройдены. Следующий
разрешённый этап — M3; работы M3 в рамках этой записи не выполнялись.

## Provenance

- source commit: `7d75041963896c464c074b3732cd144488daa7af`;
- M2 implementation/evidence commit:
  `dbc1ca76f256b917056283faa0bf8c05633fc033`;
- worktree во время измерений: dirty; clean-commit claim не делается;
- catalog version: `1`, 78 719 jobs;
- catalog SHA-256:
  `e03b6b3e76be625c432268043cc241eb133e41566c3057dfdb610dbab92ab71e`;
- corpus: `m2-search-benchmark-v1`, 90 cases, config SHA-256
  `db206119a36ef47b32e72bcced9455b3d2bf1587d9f2075e65b24fe9b1e153fd`;
- final machine-readable decision:
  [`m2/final-acceptance-v1-windows-2026-08-01.json`](m2/final-acceptance-v1-windows-2026-08-01.json),
  SHA-256 `71e888c15497847a22d2f962e3102c6a23739ea961e5971e76847b998dd2dd1d`.

Environment: Windows `10.0.26200` build `26200`, AMD64, 13th Gen Intel Core
i5-13420H, 16 961 822 720 bytes RAM, SKHynix HFS001TEJ4X112N NVMe SSD,
1 024 209 543 168 bytes.

## Gate decision

| Gate | Evidence | Result |
|---|---:|---:|
| Warm search p95 | aggregate `150.86 ms`; worst query `167.85 ms` | pass, both `<300 ms` |
| Warm quality target | aggregate `150.86 ms` | missed target `<150 ms` by `0.86 ms`; non-blocking |
| Cold first IPC query | `95.77 ms` | pass, `<500 ms` |
| Repeated startup | p95/max `233.98 ms`, 10 runs | pass, `<2.5 s` |
| Steady-state RAM | private working-set p95 `109 379 584` bytes | pass, `<250 MiB` |
| Scroll long frames | 0 frames `>100 ms` | pass |
| Cursor | 78 719 visited / 78 719 unique, 0 duplicates, 0 omissions | pass |
| Physical offline search/detail | Wi-Fi radio `Off`, no profile, ping failed, `python` → 9 306 results and detail | pass |
| Original URL | 0 calls before user action, 1 after click; HTTPS/JobId tests pass | pass |
| Keyboard/a11y smoke | 65 focusable controls, 0 unnamed app controls, 5 focus checks, 8 Tab checks, Space toggle | pass |
| Reduced motion | native WebView media query true; max animation/transition `1 ms` | pass |
| Corrupt recovery | manifest SHA restored, no temp/previous residue | pass |
| Real NSIS first run | installer exit 0, window `1 266.05 ms`, catalog ready `12 441.81 ms` | pass |
| Real portable first run | extracted ZIP, window `1 007.39 ms`, catalog ready `12 070.23 ms` | pass |
| Quality suites | frontend 121, Rust 77 + 4 ignored heavy diagnostics, Python 35 | pass |

## Physical network isolation

Wi-Fi отключён через системный `Windows.Devices.Radios.Radio` со статусом
`RadioState.Off`. Во время проверки отсутствовал connection profile, а внешний
ping завершился с кодом 1. На чистом `%LOCALAPPDATA%\GiveMeJob!` окно portable
build появилось за `212.85 ms`, каталог был распакован и sealed за
`11 111.01 ms`; итоговый SQLite имел ожидаемый размер `1 043 488 768` bytes,
временных файлов не осталось.

Следующий нативный запуск при всё ещё выключенном радио экспонировал UI через
UI Automation: запрос `python` вернул `9 306` результатов, список, описание и
кнопка оригинала были доступны. После проверки радио включено, сохранённый
Wi-Fi profile восстановлен вызовом WLAN API с кодом 0, IPv4 вернулся в
`Internet`.

Публичные raw-файлы заменяют локальные SSID и WLAN interface GUID на явные
`<redacted-...>` placeholders; на gate-поля и измерения эта публикационная
редакция не влияет.

Первичный lifecycle JSON содержит `passed: false` только потому, что обычный
WebView2 лениво не включил UI Automation provider до подключения screen-reader.
Сами first-run/network/catalog поля в нём прошли. Follow-up включил официальный
renderer accessibility switch и отдельно подтвердил search/detail; итоговое
решение не скрывает этот диагностический false-negative.

Raw evidence:

- [`m2/offline-first-run-radio-v1-windows-2026-08-01.json`](m2/offline-first-run-radio-v1-windows-2026-08-01.json),
  SHA-256 `f40c6b0c08b60bf1dda16a70779b2bd071c7d29615d919f4c199c34313086943`;
- [`m2/offline-search-radio-v1-windows-2026-08-01.json`](m2/offline-search-radio-v1-windows-2026-08-01.json),
  SHA-256 `8fbb0c3c0b321da803f2f30f149dd820916215e9917ef1b8c3e99c01cbe51b6d`;
- [`screenshots/M2_NATIVE_FULLY_OFFLINE_2026-08-01.png`](screenshots/M2_NATIVE_FULLY_OFFLINE_2026-08-01.png),
  SHA-256 `a2387d6efcfefc519672dc7bfec908c3b02fcd895121144053cb79859323358c`.

## Native keyboard, accessibility and reduced motion

Нативное Tauri/WebView2 окно экспонировало 199 UIA elements и 65 keyboard
focusable controls. У всех application controls есть accessible name. Единственный
безымянный focusable `Pane` имеет пустой rectangle и классифицирован как
внутренний WebView2 provider host, а не control приложения.

Фокус последовательно установлен на theme selector, remote checkbox, search,
первую вакансию и original-link button: 5/5 name/role/focus checks совпали.
Восемь последовательных Tab stops имеют имя и фактический keyboard focus.
`Space` перевёл remote checkbox в `On`, второй `Space` вернул `Off`.

Системный Windows Narrator реально работал во время developer-mode capture.
Developer mode замаскировал экран и выделил поле поиска с доступным именем и
описанием. После capture Narrator штатно остановлен. Это smoke в рамках MVP, а
не заявка на отдельную screen-reader сертификацию.

Microsoft Accessibility Insights AccChecker дополнительно записан как
диагностика. Он сообщил об одном безымянном внутреннем 0×0 WebView2 Pane,
provider parent/child mismatch и offscreen/1×1 bounding rectangles. Отдельный
UIA audit подтвердил 0 безымянных focusable controls приложения; поэтому эти
framework-provider diagnostics не являются M2 blocker.

Native WebView2 запущен с принудительным OS reduced-motion preference. CDP
подтвердил `prefers-reduced-motion: reduce`, максимум `1 ms` для animation и
transition, 0 нарушений и 0 элементов со smooth scrolling.

Raw evidence:

- [`m2/narrator-v1-windows-2026-08-01.json`](m2/narrator-v1-windows-2026-08-01.json),
  SHA-256 `0be7b7a3161e1887a12d939aa1d103af5c5c4a15402236c9a81f18a2f55a63f5`;
- [`m2/reduced-motion-v1-windows-2026-08-01.json`](m2/reduced-motion-v1-windows-2026-08-01.json),
  SHA-256 `ee1af2ee14b76868548165eab72345dec400e9cfc79e879da44d389776eab641`;
- [`m2/acccheck-v1-windows-2026-08-01.log`](m2/acccheck-v1-windows-2026-08-01.log),
  SHA-256 `f945008beb79baffeaa37c0c61fac2795a532f6afab219d138da4c62db8b581e`;
- [`screenshots/M2_NATIVE_NARRATOR_DEV_MODE_2026-08-01.png`](screenshots/M2_NATIVE_NARRATOR_DEV_MODE_2026-08-01.png),
  SHA-256 `3b251a505a404d4dd74260cd148826900f1616bbc4bc897fbbd477118e818872`.

## Existing benchmark/package evidence

Полные 2 700 raw timings, percentiles, hardware, catalog identity, cursor audit,
repeated startup, RAM, scroll, recovery, NSIS/portable и screenshots находятся в:

- [`M2_BENCHMARK_GATE_2026-08-01.md`](M2_BENCHMARK_GATE_2026-08-01.md);
- [`m2/benchmark-v1-windows-2026-08-01.json`](m2/benchmark-v1-windows-2026-08-01.json),
  SHA-256 `8d8a280e7d1413c38b889d20eb8704ca7d3290f1a21ffb2809366e77c72325e8`;
- [`m2/native-v1-windows-2026-08-01.json`](m2/native-v1-windows-2026-08-01.json),
  SHA-256 `d31f794ad9e7c21071317514b673e733015050e05e3b6355fb1f3be2fd4d143e`.

## Final quality rerun

После нативных acceptance-проверок повторно выполнены:

- frontend typecheck, ESLint, Vitest `121 passed`, production web build;
- Rust fmt, check, test `77 passed / 4 ignored`, Clippy with `-D warnings`;
- Ruff check, Ruff format check, strict mypy, pytest `35 passed`.

Все команды завершились с exit code 0. M2 официально закрыт этой записью.
