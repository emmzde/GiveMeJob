# GiveMeJob! — журнал продуктовых решений

Последнее обновление: 31 июля 2026 года.

Статус решений ниже: **принято**. Они заменяют исходное направление
production-агрегатора от 29–30 июля 2026 года. Изменение любого решения требует
новой записи в этом файле, синхронизации `AGENTS.md`, `docs/PLAN.md`,
`docs/MVP_SCOPE.md` и `config/product.json`.

Место документа в единой иерархии:
`rules → ADR → scope → target plan → metrics → current status → evidence`.
ADR подчиняются `AGENTS.md`, но имеют приоритет над scope, планом, статусом и
evidence.

## ADR-001. Pet-project вместо production-продукта

GiveMeJob! развивается как публичный portfolio pet-project. Цель — законченный
и приятный пользовательский MVP, а не постоянно обновляемый коммерческий
агрегатор.

Следствия:

- scope режется в пользу качества desktop UX;
- production SLA, монетизация и масштабирование исключены;
- пользовательский runtime не зависит от инфраструктуры разработчика.

## ADR-002. Только Windows

Первая версия поддерживает Windows 10/11 x64.

Artifacts:

- основной — NSIS `Setup.exe`;
- дополнительный — portable ZIP.

macOS, Linux и mobile не тестируются и не входят в roadmap MVP.

## ADR-003. Автономный runtime

Установленное приложение работает без FastAPI, PostgreSQL, Redis, Docker и
Python.

Каталог и поиск находятся в локальном SQLite FTS5. После проверенного export
legacy backend/ingestion удалён; в репозитории остаётся только минимальный
read-only Python exporter. Исходный PostgreSQL volume хранится отдельно.

Интернет нужен только:

- Emmy;
- открытию оригинальной вакансии;
- проверке обновления приложения.

Проверка обновления необязательна, выполняется асинхронно после начала запуска
и не блокирует доступ к локальному каталогу при отсутствии сети.

## ADR-004. Frozen dataset

Каталог фиксируется на срезе из 78 719 активных канонических вакансий.

Не выполнять без нового ADR:

- Adzuna/Jooble live-запуски;
- ATS sweep;
- новые источники;
- salary/freshness remediation;
- embedding backfill;
- scheduler и периодический refresh.

Полный текущий нормализованный снимок включается в offline artifact. Для
каждой вакансии обязательны attribution и оригинальный URL. Принят риск,
связанный с публичным распространением полного снимка; рядом с релизом должен
быть `NOTICE_DATA.md` с датой, источниками и дисклеймером.

## ADR-005. FTS вместо vectors

MVP использует SQLite FTS5, BM25, RU/EN-алиасы, ESCO-канон, prefix matching и
словарное исправление опечаток.

Embeddings, pgvector, HNSW, vector search и RRF не используются. Историческая
embedding-запись не переносится в runtime catalog.

## ADR-006. Локальный match-score

Match-score — детерминированная оценка соответствия 0–100:

- skills — 40%;
- role — 20%;
- seniority — 15%;
- location/work mode — 15%;
- salary — 10%.

Это не вероятность оффера. В MVP запрещены probability score, диапазоны шансов
и LLM-корректировка match-score.

## ADR-007. Профиль без резюме

Первая версия использует короткую ручную анкету:

- желаемые роли;
- грейд;
- навыки;
- локация;
- remote/hybrid/office;
- зарплатные ожидания.

PDF/DOCX parsing и автоматическое извлечение резюме отложены.

## ADR-008. Emmy

Emmy — дружелюбная анимированная SVG-собачка и AI-ассистент.

Разрешённые инструменты:

1. `search_jobs`;
2. `get_job`;
3. `compare_jobs`;
4. `get_match_breakdown`;
5. `set_shortlist`.

Только shortlist является мутирующим инструментом и требует подтверждения.
Ответы моделей проходят structured-output validation.

## ADR-009. AI-провайдеры и ключи

Первичный вариант не требует настройки пользователя:

- Groq;
- Gemini;
- OpenRouter как аварийный fallback.

Все вызовы идут через Rust `LLMRouter`. Router выбирает модель по capability,
локальной задержке, ошибкам, 429 и cooldown.

Разрешены встроенные demo-ключи при условиях:

- ключ создан специально для GiveMeJob!;
- только free tier, billing отключён;
- scopes и квоты минимальны;
- значение хранится в GitHub Actions Secrets и передаётся Rust release build;
- ключ отсутствует в Git, JavaScript, логах и crash reports;
- ключ считается публично извлекаемым;
- compile-time обфускация является только замедлением простого анализа;
- компрометация закрывается отзывом ключа и новым release.

BYOK поддерживается как резерв и хранится в Windows Credential Manager.

## ADR-010. Публичная модель исходников

Цель:

- основной репозиторий публичный;
- исходный код open source;
- бинарники публикуются в GitHub Releases.

Изменение visibility выполняется на release-этапе после secret scan.

## ADR-011. Обновления и подпись

Tauri updater artifacts подписываются отдельным signing key. Приватный ключ
находится только в GitHub Secrets.

Authenticode-сертификата в v1 нет. Возможное предупреждение SmartScreen
принимается и честно описывается в README/Release notes.

## ADR-012. Рынок и язык

Сохраняются решения предыдущего scope:

- remote-first;
- global remote + СНГ;
- IT/digital;
- UI по умолчанию на русском через i18n;
- мультиязычный индекс;
- канонические skills на английском;
- ESCO как основная таксономия.

## ADR-013. Удаление legacy после snapshot

31 июля 2026 года принят и повторно проверен созданный exporter-ом
`catalog-v1.sqlite` из 78 719 активных канонических вакансий.
`integrity_check` вернул `ok`, foreign key audit — 0 ошибок, attribution и
original URL присутствуют у всех записей.

После прохождения gate удалены:

- FastAPI и server API contracts;
- Alembic и PostgreSQL schema из репозитория;
- ingestion, коннекторы, scheduler и embeddings;
- Redis/Docker Compose;
- shared health types и старые contract fixtures.

Сохранены `tools/catalog_export`, manifest/checksums и локальный PostgreSQL
named volume. Volume не удаляется без отдельного подтверждения пользователя.

## ADR-014. Первый GitHub Release только после M5 gate

На 31 июля 2026 года GitHub Releases отсутствуют. Локально собранные NSIS и
portable ZIP подтверждают build pipeline, но не считаются пользовательской
версией.

`v0.1.0` не публикуется до завершения M2–M5, публикации versioned catalog
asset, clean-Windows проверки, secret scan и перевода репозитория в public.
Development changes попадают в `main` только через pull request.

До stable используются только приватные RC artifacts, доступные участникам
репозитория через CI. Публичный preview/prerelease текущим решением не разрешён;
его публикация потребует отдельного ADR. Первым публичным бинарным релизом по
текущему решению остаётся stable `v0.1.0`.

Подробный checklist находится в [`RELEASE_STATUS.md`](RELEASE_STATUS.md).

## ADR-015. M2 search и wire semantics

В SQLite `jobs.id` остаётся `INTEGER`. За границей SQLite job ID представлен
как branded положительная decimal string без знака и ведущих нулей. Этот
`JobId` используется в IPC, cursor и будущих Emmy tools, чтобы контракт не
зависел от JavaScript number precision.

Фильтры объединяются через OR внутри одной категории и через AND между
категориями. Зарплатный минимум означает
`salary_usd_year >= salaryMinUsdYear`; `salaryKnownOnly` означает
`salary_usd_year IS NOT NULL`.

Поддерживаются backend-сортировки:

- `relevance` при непустом тексте;
- `newest`, в том числе как поведение пустого `relevance`;
- `salary`, где известные значения идут перед `NULL`.

Последний tie-break любой сортировки — job ID. `match` относится к M3 и не
считается готовой backend-сортировкой M2. Cursor остаётся незавершённой частью
M2.

Hard performance gate для warm search — p95 строго меньше 300 мс. Значение
строго меньше 150 мс является целевым уровнем, но не отдельным блокирующим
gate.

## ADR-016. Временные метки catalog artifact

Catalog manifest использует три разных понятия:

- `source_frozen_at` — граница данных исходного frozen snapshot;
- `exported_at` — момент создания SQLite/Zstandard artifact;
- `published_at` — момент публикации artifact, `null` до публикации.

В пользовательском интерфейсе показывается только `source_frozen_at`, потому
что именно эта дата описывает свежесть вакансий. Даты export и publication
остаются provenance и release metadata.

У исторического `catalog-v1` значения `source_frozen_at` и `exported_at`
совпадают. Это свойство конкретного manifest, а не смешение семантики полей;
`published_at` остаётся `null`.

## Машиночитаемый источник

Current и target состояния разнесены в [`config/product.json`](../config/product.json).
Этот документ остаётся человекочитаемым источником причин и ограничений.
