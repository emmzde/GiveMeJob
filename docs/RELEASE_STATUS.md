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
не закрыт: фильтры являются UI-заготовками, нет полной сортировки,
виртуализации, benchmark gate и законченной job detail navigation. M3, M4 и
release-hardening M5 также не завершены.

Публикация сейчас создала бы ложное ожидание готового MVP и зафиксировала бы
неполный UX как первую публичную версию.

## Что отправляется на GitHub сейчас

- исходный код verified snapshot exporter;
- manifest и checksums без самого каталога;
- offline desktop shell и локальный Rust SQLite IPC;
- удаление legacy backend/ingestion;
- актуальная документация, roadmap и Windows CI;
- pull request в `main`.

NSIS, portable ZIP, `.env`, PostgreSQL volume и `.artifacts/` в Git не
коммитятся.

## Gate для `v0.1.0`

Release разрешён только после выполнения всех пунктов:

1. M2: полноценные filters/sorts, virtualized feed, detail/original-link flow
   и warm search p95 <150 мс при обязательном p95 <300 мс.
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
- промежуточные инженерные сборки не публикуются как GitHub Releases;
- если понадобится внешнее тестирование до M5, оно оформляется отдельным
  draft prerelease только по новому решению.
