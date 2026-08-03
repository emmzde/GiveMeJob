# GiveMeJob! — статус релиза

Дата решения: 31 июля 2026 года. Последнее обновление: 1 августа 2026 года.

## Решение

**GitHub Release сейчас не публиковать.**

В репозитории ещё нет опубликованных версий, поэтому будущий `v0.1.0` будет
первым portfolio release, а не обновлением существующего продукта.

Локально уже подтверждены:

- `catalog-v1.sqlite` и Zstandard archive;
- NSIS `Setup.exe`;
- portable ZIP;
- frontend, Rust и exporter quality checks.

Эти artifacts доказывают, что release pipeline технически возможен. M2
официально закрыт 1 августа 2026 года; backend search correctness, фильтры,
три backend-сортировки
(`relevance`, `newest`, `salary`) и cursor/keyset готовы; detail, filter options,
source counts и локальные skill/location autocomplete имеют строгий
Rust/TypeScript IPC-контракт. Filter/location/salary corpus benchmark прошёл
hard gate с worst clean release p95 `273.02 ms`; новые SQLite indexes не
добавлялись. Catalog lifecycle вынесен в `catalog.rs`: реализованы seal-based
fast startup, полная install/recovery validation, streaming unpack, progress UI,
lock, stale-temp cleanup, `.previous` rollback и пользовательский retry.
Job detail navigation и безопасный original-link flow готовы: detail загружается
отдельным IPC, description остаётся недоверенным plain text и безопасно
структурируется в абзацы/list/NOTE, а Rust открывает только HTTPS URL, повторно
полученный по `JobId`. Filter/sort UI, active chips, validated minimum salary,
source multi-select, local skill/location autocomplete, cursor pagination,
selected feed state и виртуализация после 50 загруженных jobs готовы. Сортировка
не дублируется в filters/chips, а reset сохраняет search text и sort.
System/light/dark session theme, AA secondary/placeholder tokens, root
`data-theme`, roving feed, `/`, `j/k`, `Ctrl+Enter` и `Ctrl+K` cmdk palette
готовы. Axe smoke покрывает shell, filters, feed, detail, errors и dialog;
Chromium smoke при 900×620 не обнаружил overflow и подтвердил focus
trap/restore. Подробности записаны в
[`evidence/M2_THEME_KEYBOARD_A11Y_2026-08-01.md`](evidence/M2_THEME_KEYBOARD_A11Y_2026-08-01.md).

Versioned 90-query release benchmark, cold IPC query, полный cursor audit,
feed-scroll, repeated startup, steady-state RAM, corrupt recovery и реальные
NSIS/portable first runs записаны в
[`evidence/M2_BENCHMARK_GATE_2026-08-01.md`](evidence/M2_BENCHMARK_GATE_2026-08-01.md).
Hard performance gate пройден: worst per-query p95 `167.85 ms`, cold
`95.77 ms`, cursor `78 719/78 719` без дублей; aggregate p95 `150.86 ms`
чуть выше неблокирующей цели `<150 ms`.

Закрывающий physical-offline и native accessibility/reduced-motion acceptance
записан в
[`evidence/M2_FINAL_ACCEPTANCE_2026-08-01.md`](evidence/M2_FINAL_ACCEPTANCE_2026-08-01.md).
Wi-Fi radio было физически выключено: offline search/detail прошли; системный
Narrator, UIA keyboard smoke и native reduced-motion также прошли. Все M2 hard
gates закрыты. Aggregate warm p95 `150.86 ms` остаётся на `0.86 ms` выше
неблокирующей цели `<150 ms`, но ниже hard gate `<300 ms`.

Минимальный M3 закрыт 1 августа 2026 года. Полная schema v1 `user.sqlite`,
локальный профиль, shortlist с кнопками/feed/detail/экраном/shortcut `s` и
детерминированный on-demand match по пяти компонентам реализованы без LLM.
Field-level validation фокусирует первое неверное поле, профиль имеет Retry, а
черновик переживает переключение экранов. В настоящем frameless Tauri/WebView2
окне подтверждены drag region, minimize/maximize/restore/close и отдельный
save → restart → load для profile и shortlist. Закрывающая запись:
[`evidence/M3_FINAL_ACCEPTANCE_2026-08-01.md`](evidence/M3_FINAL_ACCEPTANCE_2026-08-01.md).

Core M4 реализован: закрытые Rust/TypeScript contracts, Rust adapters Groq,
Gemini, OpenRouter и Cerebras, последовательный `LLMRouter`, максимум четыре
tool-шага, ровно пять локальных tools, confirmation для shortlist, локальная
timeline/history, реальные job cards/comparison и state-driven SVG Emmy.
По ADR-020 OpenRouter стал основным каскадом из восьми явно заданных
free-моделей. ADR-021 добавил native tool calling, трёхсекундный attempt
timeout и 15-секундный budget всего turn; после tool result
разрешён ранний последовательный fallback к Groq, Gemini и Cerebras. Memory-
сводка разговора атомарно хранится локально и переносит контекст между
моделями и провайдерами при сохранении лимита 12 сырых сообщений.
Fake-provider вертикаль и failover проходят; targeted live OpenRouter
simple/native-tool smokes и полный search → tool → final-answer smoke прошли,
итоговые simple/search замеры — 1,86/6,14 секунды. Изолированный WinAPI Credential Manager
write/read/delete roundtrip также пройден. Полный M4 gate остаётся открытым до
оставшейся live-provider matrix, UI save → restart → configured → clear для
BYOK, native
all-providers-unavailable smoke и protected release-build с отдельными demo
credentials.

После hot reload runtime timeline дополнительно зафиксировала четыре
последовательных успешных пользовательских turn за 4,30–7,05 секунды без
новых timeout notices и без CJK/Hangul в сохранённых assistant payload.

Exact per-option result counts
для remote/seniority/employment не изображаются: текущий IPC возвращает count
только для source и autocomplete. Hide/apply automation не входит в текущий
продуктовый контракт. Глобальный `match`-sort и catalog-wide пересчёт отложены
после core M4 и до M5 по ADR-018. M4 и release-hardening M5 не завершены;
текущий этап — M4.

Публикация сейчас создала бы ложное ожидание готового MVP и зафиксировала бы
неполный UX как первую публичную версию.

## Что отправляется на GitHub сейчас

- исходный код verified snapshot exporter;
- manifest и checksums без самого каталога;
- offline desktop shell и локальный Rust SQLite IPC;
- backend-фильтры и сортировки relevance/newest/salary;
- локальный profile/shortlist и on-demand deterministic match;
- core Emmy: Rust router/provider adapters/tools/credentials и React
  timeline/cards/comparison/settings/mascot states;
- удаление legacy backend/ingestion;
- актуальная документация, roadmap и Windows CI;
- remote feature branch; merge в `main` выполняется только через pull request.

NSIS, portable ZIP, `.env`, PostgreSQL volume и `.artifacts/` в Git не
коммитятся.

## Gate для `v0.1.0`

Release разрешён только после выполнения всех пунктов:

1. M2: **завершён** — UI audit и воспроизводимые
   feed-scroll/cold-query/startup/RAM measurements сохранены; hard gate warm
   search p95 строго <300 мс пройден, а строго <150 мс остаётся целевым уровнем.
2. M3: **завершён** — `user.sqlite`, профиль, shortlist и детерминированный
   on-demand match-score; глобальный match-sort остаётся обязательным post-M4
   follow-up по ADR-018.
3. M4: **в работе** — core Emmy, Rust `LLMRouter`, ровно пять tools, BYOK code
   path и graceful offline реализованы; isolated Credential Manager roundtrip
   пройден. Открыты live-provider smoke, UI BYOK restart/clear, native offline
   и protected release-build. Текущая запись:
   [`evidence/M4_IMPLEMENTATION_PROGRESS_2026-08-01.md`](evidence/M4_IMPLEMENTATION_PROGRESS_2026-08-01.md).
4. M5: clean-Windows install test, NSIS, portable ZIP и signed updater.
5. `catalog-v1.sqlite.zst` опубликован отдельным versioned asset, а его
   SHA-256 совпадает с `config/catalog-manifest.json`.
6. Release workflow проходит без demo-ключей в PR и получает секреты только
   из protected release environment.
7. Secret scan чистый; репозиторий переведён из private в public.
8. Release notes честно описывают отсутствие Authenticode и возможный
   SmartScreen warning.

## Версионирование

- следующий release tag: `v0.1.0`;
- до прохождения gate версия в коде остаётся `0.1.0` как development version;
- до stable используются только приватные RC artifacts из CI;
- промежуточные инженерные сборки не публикуются как GitHub Releases;
- публичного preview/prerelease по текущему ADR нет; его публикация требует
  отдельного ADR.

## Baseline

Текущая единственная M2 catalog baseline создана exporter из commit
`b30162a21d1e473b61d037d10165d283798aa586` и сохранена в
[`evidence/M2_CATALOG_BASELINE_B30162A.md`](evidence/M2_CATALOG_BASELINE_B30162A.md).
Предыдущий файл `M2_BASELINE_74A8588.md` остаётся неизменяемым историческим
evidence, но его catalog checksums больше не являются current baseline.
