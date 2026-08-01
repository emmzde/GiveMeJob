# M2 benchmark and native gate — 2026-08-01

Статус этой записи: **M2 остаётся открытым**. Все автоматизируемые performance,
cursor, package, recovery, scroll, keyboard и quality checks ниже выполнены.
Полная network isolation не была выполнена: текущая Windows-сессия не elevated,
а Windows Sandbox/Hyper-V отсутствуют. Финальный native screen-reader и
reduced-motion audit также остаётся ручным acceptance из нормативного плана.

## Source and immutable inputs

- source commit: `7d75041963896c464c074b3732cd144488daa7af`;
- worktree во время измерения: dirty (результаты относятся к явно перечисленным
  файлам, а не выдаются за clean-commit run);
- corpus: `m2-search-benchmark-v1`, schema `1`, 90 cases, config SHA-256
  `db206119a36ef47b32e72bcced9455b3d2bf1587d9f2075e65b24fe9b1e153fd`;
- catalog version: `1`, 78 719 jobs;
- catalog SHA-256:
  `e03b6b3e76be625c432268043cc241eb133e41566c3057dfdb610dbab92ab71e`;
- raw benchmark evidence:
  [`m2/benchmark-v1-windows-2026-08-01.json`](m2/benchmark-v1-windows-2026-08-01.json),
  SHA-256 `8d8a280e7d1413c38b889d20eb8704ca7d3290f1a21ffb2809366e77c72325e8`;
- raw native evidence:
  [`m2/native-v1-windows-2026-08-01.json`](m2/native-v1-windows-2026-08-01.json),
  SHA-256 `d31f794ad9e7c21071317514b673e733015050e05e3b6355fb1f3be2fd4d143e`.

Benchmark runner собран в release mode отдельным feature `m2-benchmark` и не
попадает в приложение/installer. Он измеряет JSON request → тот же command core,
который вызывает Tauri `search_jobs` → `spawn_blocking` → новая read-only SQLite
connection → search repository → JSON response. Это end-to-end IPC boundary без
стоимости WebView transport, а не прямой вызов repository function.

## Environment

- OS: Windows `10.0.26200`, build `26200`, AMD64;
- CPU: 13th Gen Intel Core i5-13420H;
- RAM: 16 961 822 720 bytes;
- disk: SKHynix HFS001TEJ4X112N, NVMe SSD, 1 024 209 543 168 bytes.

## Search and cursor

На каждый из 90 запросов выполнено ровно 5 warmups и 30 measured runs.

| Metric | Result | Gate |
|---|---:|---:|
| Aggregate warm p50 | 31.09 ms | informational |
| Aggregate warm p95 | 150.86 ms | target <150 ms, hard <300 ms |
| Aggregate warm max | 169.94 ms | informational |
| Worst per-query p95 | 167.85 ms (`phrase-02`) | <300 ms |
| Cold first IPC query | 95.77 ms | <500 ms |
| Cursor traversal | 78 719 visited / 78 719 unique | exact |
| Cursor duplicates | 0 | 0 |
| Cursor pages | 1 575 × 50 | no omissions |

Hard performance gate пройден. Цель `<150 ms` для aggregate p95 пропущена на
`0.86 ms`; по контракту это не блокирует M2, но зафиксировано без округления в
сторону pass.

Первый `cargo run` после release linking сохранён локально как failed diagnostic:
warm p95 `179.62 ms` прошёл, но cold query `923.64 ms` не прошёл при одновременной
работе compiler/linker и portable WebView. Нормативный файл получен прямым
запуском уже собранного release runner при остановленном UI; неудачный результат
не перезаписан.

## Native packages, startup, RAM and recovery

- NSIS: 347 402 315 bytes, SHA-256
  `0f571610c8f65f8af1ea7a0a3caa405974f7cd2745b02aa3548775de363c7b1f`;
- portable ZIP: 344 172 821 bytes, SHA-256
  `f683976403f9b14be250c41dc2f57bcf938d6de1ea752a803a3e98b56c9a20ba`;
- clean NSIS first run: window `1 266.05 ms`, catalog seal `12 441.81 ms`;
- clean portable first run from extracted ZIP: window `1 007.39 ms`, catalog
  seal `12 070.23 ms`;
- repeated startup, 10 runs: p50 `39.20 ms`, p95/max `233.98 ms` (<2.5 s);
- steady-state RAM after 5 s, 15 one-second samples across the full Tauri +
  descendant WebView2 tree: private working set p95 `109 379 584` bytes
  (~104.3 MiB); private committed bytes `231 301 120` bytes (~220.6 MiB);
- shared-inclusive working set (~384.7 MiB) записан в raw evidence, но не служит
  RAM gate: он повторно считает shared Edge runtime pages в каждом процессе;
- corrupt recovery: byte 0 SQLite header изменён `83 → 0`; восстановление из
  bundled archive завершилось за `12 312.98 ms`, итоговый SHA снова совпал с
  manifest, temp/previous files не остались;
- обнаруженный на первом пробном installer run `0xC00000FD` исправлен переносом
  двух 1 MiB streaming buffers со стека Tokio blocking worker в heap. Повторный
  реальный NSIS/portable first run не упал.

First-run extraction измерена отдельно и не включена в repeated startup.

## Scroll, keyboard, a11y and original URL

- Chromium Long Animation Frame API поддерживается; после 15 stress-scroll
  actions не появилось ни одного нового frame >50 ms, следовательно >100 ms — 0;
- после загрузки 100 jobs виртуализированный feed держал 8–13 DOM options;
- `/` фокусирует search, `j` переместил selection с job 43 на job 44,
  `Ctrl+K` открыл dialog, `Escape` закрыл;
- `open_original` telemetry: 0 вызовов до user click и 1 после click; Rust tests
  дополнительно проверяют повторную загрузку URL по `JobId` и только HTTPS;
- axe/keyboard smoke и contrast evidence находятся в
  [`M2_THEME_KEYBOARD_A11Y_2026-08-01.md`](M2_THEME_KEYBOARD_A11Y_2026-08-01.md).

Screenshots:

- [`M2_SCROLL_BROWSER_2026-08-01.png`](screenshots/M2_SCROLL_BROWSER_2026-08-01.png),
  SHA-256 `3789547f43b7bcb5c3a119a9dbb502ea16f64787ab4f68cb47d032fc9df3ab7f`;
- [`M2_NSIS_FIRST_RUN_2026-08-01.png`](screenshots/M2_NSIS_FIRST_RUN_2026-08-01.png),
  SHA-256 `acf8f8c1b609474deb9495e8a7769a8f9bd9271760cbcd1306aed1f1209dfea4`;
- [`M2_PORTABLE_FIRST_RUN_2026-08-01.png`](screenshots/M2_PORTABLE_FIRST_RUN_2026-08-01.png),
  SHA-256 `d7e1d64cba9af2e14a33da2e060b9a949b0681f92f26ee99579702b16101814c`.

## Quality suites

- frontend: typecheck pass, ESLint pass, Vitest `121 passed`, web build pass;
- Rust: fmt/check/Clippy pass, `77 passed`, 4 explicit heavy diagnostics ignored;
- Python: Ruff check pass, Ruff format pass, strict mypy pass, pytest
  `35 passed`;
- первый pytest attempt был заблокирован чужим ACL глобального
  `%TEMP%\pytest-of-Emil`; повтор с новым workspace-local `TEMP` прошёл без
  изменения тестов.

## Open gates

1. Запустить установленный NSIS build под реально отключённой сетью или под
   reversible per-executable firewall isolation из elevated session; проверить
   search, filters и detail, отсутствие автоматического открытия URL и затем
   user-triggered original URL после возврата сети.
2. Выполнить финальный native screen-reader speech и reduced-motion audit.

До этих двух evidence M2 не переводится в complete, M3 не начинается.
