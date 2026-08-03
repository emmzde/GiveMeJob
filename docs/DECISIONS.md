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

- OpenRouter как основной последовательный каскад по ADR-020;
- Groq;
- Gemini;
- Cerebras как последний последовательный fallback по ADR-019.

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

BYOK хранится в Windows Credential Manager и всегда имеет приоритет над
встроенным demo credential того же провайдера.

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
`JobId` используется в IPC, cursor и Emmy tools, чтобы контракт не
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
считается готовой backend-сортировкой M2.

M2 использует opaque versioned keyset cursor. Envelope связывается с версией
catalog и fingerprint нормализованного query, filters и sort; несовпадение
query, sort, catalog или envelope version возвращает `invalid_query`. Exact
`total` остаётся optional и вычисляется только на первой странице: observed
page + count p95 не превысил `117.59 ms`, что ниже hard gate `<300 ms`.
Последующие страницы count не повторяют.

Закрытый IPC error contract: `catalog_missing`, `catalog_corrupt`,
`invalid_query`, `not_found`, `open_failed`, `internal`. Локальные path и сырые
SQLite errors не являются частью wire response.

Hard performance gate для warm search — p95 строго меньше 300 мс. Значение
строго меньше 150 мс является целевым уровнем, но не отдельным блокирующим
gate.

Search input нормализуется в Rust через NFKC, lowercase lookup и свёртку
whitespace. Filter arrays сортируются и dedupe до query/fingerprint. FTS
expression строится только из quoted literals: AND между concepts и OR между
aliases одного concept; пользовательский FTS syntax остаётся данными.

Relevance использует cursor v3 и детерминированный tuple: exact normalized
title, число exact canonical skill matches, BM25, `posted_at` с `NULL` после
известных дат, затем job ID. BM25 хранится в cursor как 16-символьный hex
bit-pattern IEEE 754, поэтому сериализация не меняет ни одного бита rank.
`newest` аналогично ставит `posted_at IS NULL` после известных дат, а `salary`
оставляет неизвестные зарплаты после известных. Страница выбирает `limit + 1`
строку только для определения `nextCursor`; lookahead-строка в `items` не
попадает. Spelling suggestion разрешён только при `total <= 3`, считается
bounded edit distance по curated словарю ролей/skills и не запускает
исправленный поиск автоматически.

## ADR-016. Временные метки catalog artifact

Catalog manifest использует три разных понятия:

- `source_frozen_at` — граница данных исходного frozen snapshot;
- `exported_at` — момент создания SQLite/Zstandard artifact;
- `published_at` — момент публикации artifact, `null` до публикации.

В пользовательском интерфейсе показывается только `source_frozen_at`, потому
что именно эта дата описывает свежесть вакансий. Даты export и publication
остаются provenance и release metadata.

У первоначального исторического export `catalog-v1` значения
`source_frozen_at` и `exported_at` совпадали. Corrective export сохранил
`source_frozen_at = 2026-07-29T20:30:03.846872Z`, записал настоящий
`exported_at = 2026-07-31T11:09:37.316686Z`; `published_at` остаётся `null`.

## ADR-017. Corrective catalog gate и manifest v1

31 июля 2026 года exporter hardening был полностью закоммичен как
`b30162a21d1e473b61d037d10165d283798aa586` до повторного export. Новый сбор
данных не выполнялся: сохранённый PostgreSQL volume монтировался только
read-only, PostgreSQL запускался на временной копии, а exporter использовал
server-enforced `REPEATABLE READ, READ ONLY`.

Приняты следующие решения:

- manifest schema имеет `manifest_version = 1`, использует только
  `snake_case`, строгий набор полей, отдельные sizes и SQLite/archive SHA-256;
- artifact filenames являются basename и не допускают absolute path, path
  components или `..`;
- release URL/locator отсутствует в generated manifest и принадлежит будущему
  M5 release descriptor;
- `description_text` имеет формат `plain_text`: Unicode NFKC, Markdown links/
  headings/lists без chrome, HTML entities декодируются, `script`/`style`
  удаляются;
- `verify --manifest` пересчитывает logical checksum из SQLite и проверяет все
  artifact, SQLite, counts, attribution/URL, metadata, product и Git gates;
- будущим release asset сопутствует GNU-style файл
  `catalog-v1.sqlite.zst.sha256`.

Повторный export сохранил 78 719 jobs, 68 881 jobs со skills, 22 467 jobs с
salary и прежнюю frozen boundary. Logical checksum изменился с
`1ef6792c62ef099b21974805fbade6c6eec1eeeb2db249a97a355ef1ffc8776b` на
`895d38f383597e7ba8e2de60c7cab5c99a8ae32de6df7f51035a225a4ed5bb6b` только
из-за normalization 78 317 descriptions: контрфактический пересчёт с исходным
`description_md` точно восстановил старый checksum, а иных расхождений не было.

## ADR-018. Минимальный M3 и on-demand match перед Emmy

1 августа 2026 года M3 зафиксирован как минимальный локальный фундамент,
который действительно нужен Emmy:

- отдельный многошаговый onboarding не создаётся; его роль выполняют
  profile empty-state и та же редактируемая анкета;
- schema version `1` для `user.sqlite` сразу включает profile, shortlist,
  recent searches, settings, conversations/messages, provider health и
  `match_cache`. Таблицы будущего M4 создаются заранее, но не изображают
  реализованную AI-функциональность;
- profile и shortlist сохраняются локально и проверяются через настоящий
  save → restart → load smoke;
- match считается чистым детерминированным Rust-модулем по пяти компонентам и
  запрашивается только для показанных, выбранных, сохранённых или сравниваемых
  вакансий; batch IPC ограничен 200 уникальными `JobId`;
- `match_cache` в минимальном M3 зарезервирован схемой, но не заполняется.

Глобальная сортировка всех 78 719 вакансий по match, `savedOnly` в search IPC и
предварительный пересчёт каталога **не являются gate M3**. Они остаются в scope
v1, но выполняются после core M4 Emmy и до M5 release gate. До этого UI не
показывает несуществующий match-sort и честно использует только
`relevance/newest/salary`.

Причина: Emmy нужны профиль, shortlist и локальный breakdown для небольшого
набора результатов, а полный catalog-wide ranking не должен задерживать
проверку agent loop. Решение не меняет веса формулы, offline-инвариант или
требование детерминизма и не разрешает переход к M5 без отложенной сортировки.

## ADR-019. Cerebras как четвёртый fallback Emmy

1 августа 2026 года пользователь явно расширил provider pool M4. После Groq,
Gemini и OpenRouter разрешён четвёртый последовательный fallback Cerebras с
моделью `gpt-oss-120b`.

Решение не меняет остальные AI-инварианты:

- параллельная гонка моделей запрещена;
- все ответы остаются structured output и валидируются Rust-схемой;
- ключ Cerebras подчиняется тем же правилам GitHub Actions Secrets и Windows
  Credential Manager, что ключи остальных провайдеров;
- реальные значения ключей не попадают в Git, frontend, документацию, логи,
  crash reports или test fixtures;
- Cerebras не получает новых инструментов и не меняет лимит четырёх tool-шагов.

Причина: дополнительный независимый free-tier provider повышает доступность
Emmy, не создавая обязательного cloud backend и не затрагивая offline core.

## ADR-020. OpenRouter-first каскад и переносимая память Emmy

2 августа 2026 года пользователь передал восемь free model IDs и явно выбрал
соответствующий gateway основным. Идентификаторы формата
`provider/model:free` сверены с актуальным каталогом OpenRouter; они не
являются model IDs OpenCode Zen. Поэтому используется уже существующий
OpenRouter credential и endpoint, без нового ошибочного provider-контракта:

1. `inclusionai/ling-3.0-flash:free`;
2. `nvidia/nemotron-3-ultra-550b-a55b:free`;
3. `google/gemma-4-31b-it:free`;
4. `google/gemma-4-26b-a4b-it:free`;
5. `openai/gpt-oss-20b:free`;
6. `nvidia/nemotron-3-nano-30b-a3b:free`;
7. `poolside/laguna-s-2.1:free`;
8. `cohere/north-mini-code:free`.

Router пробует модели строго последовательно. Timeout, 429, transport/schema
error или невалидный structured output переводят попытку к следующей модели.
Только после восьми OpenRouter-моделей используются Groq, Gemini и Cerebras.
Параллельная гонка и расход нескольких free-tier квот одновременно запрещены.

Не все модели списка поддерживают server-side JSON Schema. Для совместимых
моделей используется strict schema, для остальных схема передаётся в system
prompt; результат всегда проходит один и тот же закрытый serde-контракт.

Для непрерывности сессии полная timeline по-прежнему хранится локально, а
провайдер получает максимум 12 последних сырых сообщений. Дополнительно
финальный structured response возвращает `conversationMemory` до 4000
символов. Сводка атомарно сохраняется в `user.sqlite` и передаётся любой
следующей модели/провайдеру. В неё запрещено копировать ключи, полный профиль,
сырые описания вакансий и инструкции из tool data. Это сохраняет
межпровайдерный контекст, не отменяя privacy-лимит на сырой transcript.

## ADR-021. Ограниченный latency budget Emmy bridge

2 августа 2026 года live-диагностика показала, что задержка возникала в bridge,
а не в локальном поиске: последовательный timeout одной модели составлял 24
секунды, tool calling эмулировался prompt-контрактом, а reasoning не
отключался. Два model calls одного agent turn вместе с перебором бесплатных
endpoints давали 95–106 секунд.

Первый вариант hard budget в восемь секунд оказался слишком жёстким:
сохранённая timeline зафиксировала timeout ровно через 8,0 секунды, хотя
отдельные free-модели отвечали за 0,8–3,0 секунды. Operational log показал две
дополнительные причины: часть endpoints возвращает правильный response payload
без внешнего `{type, payload}`, а часть попыток получает штатные 429/schema
errors. Пользователь увеличил допустимый turn budget до 15 секунд.

Решение:

- весь Emmy turn жёстко ограничен 15 секундами, отдельная provider/model
  попытка — тремя секундами;
- initial OpenRouter tool phase использует native function calling только для
  пяти разрешённых локальных tools и `tool_choice: required`;
- OpenRouter reasoning отключён и исключён из ответа;
- после локального tool result выполняется одна приоритетная OpenRouter
  попытка, затем Groq, Gemini и Cerebras могут быть проверены до оставшихся
  медленных OpenRouter endpoints;
- простой чат аналогично начинает с OpenRouter Ling, но после невалидного
  structured output рано переходит к Groq Llama;
- все попытки остаются строго последовательными; model racing не разрешён;
- OpenRouter free endpoints используют prompt schema, а закрытая
  serde-валидация остаётся обязательной. Допускается безопасное снятие целой
  Markdown JSON-обёртки и нормализация известного unwrapped response payload с
  закрытыми defaults; не regex-извлечение tool calls;
- generated Russian response не пропускает неожиданные CJK/Hangul-символы;
  невалидные quick replies отбрасываются;
- operational log содержит только provider/model, закрытый outcome, latency и
  безопасную форму невалидного ответа без его содержимого.

ADR-021 уточняет порядок ADR-020: OpenRouter остаётся первым и основным, но
требование перебрать все восемь его моделей перед межпровайдерным fallback не
применяется после tool result, поскольку противоречит hard latency budget.
На итоговой ревизии live simple-chat smoke прошёл за 1,86 секунды, а search →
native tool → local result → final answer — за 6,14 секунды. При исчерпании
budget Emmy возвращает typed timeout, не блокируя offline core.

## Машиночитаемый источник

Current и target состояния разнесены в [`config/product.json`](../config/product.json).
Этот документ остаётся человекочитаемым источником причин и ограничений.
