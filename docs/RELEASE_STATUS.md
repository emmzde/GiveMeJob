# GiveMeJob! — статус релиза

Дата решения: 31 июля 2026 года.

## Решение

**GitHub Release сейчас не публиковать.**

В репозитории ещё нет опубликованных версий, поэтому будущий `v0.1.0` будет
первым portfolio release, а не обновлением существующего продукта.

Локально уже подтверждены:

- `catalog-v1.sqlite` и Zstandard archive;
- NSIS `Setup.exe`;
- portable ZIP;
- frontend, Rust и exporter quality checks.

Эти artifacts доказывают, что release pipeline технически возможен, но M2 ещё
не закрыт. Backend search correctness, фильтры, три backend-сортировки
(`relevance`, `newest`, `salary`) и cursor/keyset готовы; detail, filter options,
source counts и локальные skill/location autocomplete имеют строгий
Rust/TypeScript IPC-контракт. Filter/location/salary corpus benchmark прошёл
hard gate с worst clean release p95 `273.02 ms`; новые SQLite indexes не
добавлялись. Подключение фильтров/сортировок в UI, виртуализация, полный
end-to-end M2 benchmark и законченная job detail navigation ещё не готовы.
`match`-sort относится к M3 и также не реализован. M3, M4 и
release-hardening M5 не завершены.

Публикация сейчас создала бы ложное ожидание готового MVP и зафиксировала бы
неполный UX как первую публичную версию.

## Что отправляется на GitHub сейчас

- исходный код verified snapshot exporter;
- manifest и checksums без самого каталога;
- offline desktop shell и локальный Rust SQLite IPC;
- backend-фильтры и сортировки relevance/newest/salary;
- удаление legacy backend/ingestion;
- актуальная документация, roadmap и Windows CI;
- remote feature branch; merge в `main` выполняется только через pull request.

NSIS, portable ZIP, `.env`, PostgreSQL volume и `.artifacts/` в Git не
коммитятся.

## Gate для `v0.1.0`

Release разрешён только после выполнения всех пунктов:

1. M2: UI wiring filters/sorts, cursor, virtualized feed,
   detail/original-link flow и hard gate warm search p95 строго <300 мс;
   строго <150 мс остаётся целевым уровнем.
2. M3: `user.sqlite`, профиль, shortlist и детерминированный match-score.
3. M4: Emmy, Rust `LLMRouter`, ровно пять tools, BYOK и graceful offline.
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
