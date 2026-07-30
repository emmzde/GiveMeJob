# GiveMeJob! — план автономного Windows pet MVP

Версия направления: 31 июля 2026 года.

Этот документ полностью заменяет прежний roadmap production-агрегатора.
Источники истины:

1. `AGENTS.md` — обязательные правила;
2. `docs/DECISIONS.md` — принятые решения;
3. `docs/MVP_SCOPE.md` — границы релиза;
4. этот файл — реализация и порядок работ.

## 1. Продукт

GiveMeJob! — публичное Windows-приложение для поиска по замороженному каталогу
вакансий. Оно должно ощущаться как законченный продукт, а не как UI над
developer backend.

Ценность MVP:

- быстрый FTS-поиск по 78 719 вакансиям;
- понятные фильтры и клавиатурное управление;
- локальный профиль;
- честный match-score с объяснением;
- милая Emmy, которая умеет работать с тем же локальным каталогом;
- запуск без сервера и ручной настройки.

Видимая дата snapshot обязательна. Приложение не создаёт иллюзию live job
board.

## 2. Архитектура

```mermaid
flowchart LR
    PG["Frozen PostgreSQL<br/>developer-only"] --> EXPORT["Deterministic export"]
    EXPORT --> ARTIFACT["catalog-v1.sqlite.zst<br/>GitHub data asset"]
    ARTIFACT --> APP["Tauri Windows app"]
    APP --> CATALOG[("catalog-v1.sqlite<br/>FTS5, read-only")]
    APP --> USER[("user.sqlite<br/>profile, shortlist, chat")]
    APP --> ROUTER["Rust LLMRouter"]
    ROUTER --> GROQ["Groq"]
    ROUTER --> GEMINI["Gemini"]
    ROUTER --> OR["OpenRouter"]
```

Пользовательский runtime не содержит FastAPI, PostgreSQL, Redis, Celery,
Alembic или Python sidecar.

### 2.1 Catalog artifact

Однократный export:

1. Read-only запрос выбирает активные canonical jobs.
2. HTML/Markdown приводится к безопасному plain text.
3. Skills агрегируются в canonical English names и alias search text.
4. Записи вставляются в SQLite в стабильном порядке по ID.
5. Создаётся FTS5 external-content index.
6. Выполняются integrity check, `ANALYZE` и `VACUUM`.
7. Формируются manifest и SHA-256.
8. База сжимается в `catalog-v1.sqlite.zst`.

Snapshot не коммитится из-за размера. В Git хранится только manifest:

```json
{
  "catalogVersion": "1",
  "canonicalJobs": 78719,
  "schemaVersion": 1,
  "sha256": "<artifact checksum>",
  "asset": "<immutable release asset URL>"
}
```

Release workflow скачивает только точный asset и прерывается при несовпадении
checksum.

### 2.2 Первый запуск и обновление

Tauri bundle содержит compressed catalog. На первом запуске:

1. Проверить свободное место.
2. Распаковать во временный файл в Local AppData.
3. Проверить SHA-256 и SQLite integrity.
4. Переименовать файл атомарно.
5. Открыть catalog read-only.
6. Создать или мигрировать `user.sqlite`.

Первичная распаковка может занимать дольше обычного запуска и показывает
прогресс с состоянием Emmy `searching`. После инициализации целевой startup
меньше 1,5 секунды.

При обновлении новый catalog ставится side-by-side. Старый удаляется только
после успешной проверки нового. Пользовательская база не заменяется.

### 2.3 Локальные интерфейсы

```ts
interface SearchQuery {
  text: string;
  skills: string[];
  locations: string[];
  remoteModes: RemoteMode[];
  seniorities: Seniority[];
  employmentTypes: EmploymentType[];
  salaryMinUsdYear?: number;
  salaryKnownOnly: boolean;
  sources: string[];
  savedOnly: boolean;
  sort: "relevance" | "match" | "newest" | "salary";
  cursor?: string;
  limit: 50;
}

interface JobSummary {
  id: string;
  title: string;
  company: string;
  location: string;
  remoteMode?: RemoteMode;
  salary?: SalaryRange;
  skills: string[];
  source: string;
  postedAt?: string;
  match?: number;
  saved: boolean;
}

interface JobDetail extends JobSummary {
  description: string;
  attribution: string;
  sourceUrl: string;
  applyUrl?: string;
  snapshotVersion: string;
}

interface SearchPage<T> {
  items: T[];
  nextCursor?: string;
  totalEstimate: number;
}
```

Публичные операции:

```ts
searchJobs(query: SearchQuery): Promise<SearchPage<JobSummary>>
getJob(id: string): Promise<JobDetail>
saveProfile(input: ProfileInput): Promise<UserProfile>
getMatchBreakdown(id: string): Promise<MatchBreakdown>
setShortlist(id: string, saved: boolean): Promise<ShortlistState>
```

Все payload валидируются. Произвольный SQL через IPC запрещён.

## 3. Offline search

### 3.1 Индексация

FTS5 поля и BM25 weights:

| Поле | Вес |
|---|---:|
| title | 8 |
| skills | 6 |
| company | 3 |
| location | 2 |
| description | 1 |

Дополнительное поле `search_aliases` содержит:

- canonical ESCO skill;
- русские и английские aliases;
- нормализованные варианты role/title;
- распространённые сокращения.

Tokenizer: `unicode61 remove_diacritics 2`, prefix indexes `2 3 4`.

### 3.2 Query pipeline

1. Trim и Unicode normalization.
2. Выделение фраз в кавычках.
3. Canonicalization skills/roles по alias map.
4. Безопасная сборка FTS expression.
5. BM25.
6. Exact title и exact skill bonus.
7. `posted_at` только как tie-breaker.
8. При нулевой/слабой выдаче — spelling suggestion по небольшому словарю
   ролей и skills, без fuzzy scan всех вакансий.

### 3.3 Фильтры и пагинация

Фильтры выполняются параметризованным SQL. Пагинация cursor/keyset по
`(sort_value, id)`, limit 50. Offset pagination не используется.

Лента виртуализирована. Менять sort/filter можно без блокирующей модалки;
предыдущие результаты остаются до готовности новых.

### 3.4 Производительность

- warm search p95: цель <150 мс;
- обязательный максимум p95: <300 мс;
- cold first query: <500 мс после завершённой распаковки;
- scroll: 60 fps;
- steady-state RAM: <250 МБ.

Методика измерения зафиксирована в `docs/METRICS.md`.

## 4. Профиль, shortlist и match

### 4.1 Онбординг

Анкета:

- до пяти желаемых ролей;
- seniority;
- skills через autocomplete;
- страна/город;
- допустимые remote modes;
- минимальная желаемая годовая зарплата USD, опционально.

Онбординг можно пропустить. Без профиля поиск и shortlist работают, а
match-sort скрыт.

### 4.2 Match formula

| Компонент | Вес | Правило |
|---|---:|---|
| skills | 40% | доля canonical job skills, присутствующих в профиле |
| role | 20% | exact/alias/token overlap желаемой роли и title |
| seniority | 15% | детерминированная compatibility matrix |
| location/work mode | 15% | remote или совпадение выбранной географии/режима |
| salary | 10% | overlap диапазона с minimum expectation |

Если данные вакансии для компонента отсутствуют, вес распределяется
пропорционально между известными компонентами.

```ts
interface MatchBreakdown {
  score: number;
  components: {
    skills?: number;
    role?: number;
    seniority?: number;
    location?: number;
    salary?: number;
  };
  strengths: MatchReason[];
  gaps: MatchReason[];
}
```

Score всегда воспроизводим. Он не меняется из-за провайдера, сети или истории
чата. UI подписывает его как «Совпадение», не «вероятность».

### 4.3 Пользовательская база

`user.sqlite` хранит:

- единственный локальный профиль;
- shortlist;
- recent searches;
- настройки;
- conversation metadata/messages;
- provider health и локальные quota counters.

При удалении приложения пользователь может выбрать удаление local data.
Экспорт/синхронизация профиля не входит в v1.

## 5. UI и Emmy

### 5.1 Layout

Три основные колонки:

1. navigation + filters;
2. virtualized feed;
3. job detail.

Emmy открывается дополнительной панелью поверх правой части. При узкой ширине
job detail и Emmy становятся mutually exclusive panels.

Экраны:

- короткий onboarding;
- feed/search;
- job detail;
- shortlist;
- profile/settings;
- Emmy chat;
- first-run catalog initialization;
- update/error/offline states.

Хоткеи:

- `/` — focus search;
- `j/k` — selection;
- `s` — shortlist;
- `Ctrl+Enter` — original URL;
- `Ctrl+K` — command palette;
- `Ctrl+E` — Emmy.

### 5.2 Маскот

Emmy — code-native layered SVG, а не растровая картинка.

```ts
type EmmyState =
  | "idle"
  | "listening"
  | "thinking"
  | "searching"
  | "success"
  | "empty"
  | "error"
  | "offline";
```

Анимация использует transform/opacity и не вызывает layout thrashing.
`prefers-reduced-motion` обязателен. Цвета берутся только из design tokens.

### 5.3 Agent tools

```ts
type EmmyToolCall =
  | { name: "search_jobs"; args: SearchQuery }
  | { name: "get_job"; args: { jobId: string } }
  | { name: "compare_jobs"; args: { jobIds: string[] } }
  | { name: "get_match_breakdown"; args: { jobId: string } }
  | { name: "set_shortlist"; args: { jobId: string; saved: boolean } };

interface EmmyResponse {
  message: string;
  jobCards: string[];
  quickReplies: string[];
  mascotState: EmmyState;
  toolCall?: EmmyToolCall;
}
```

`compare_jobs` принимает 2–4 ID. `set_shortlist` сначала возвращает preview,
затем исполняется после явного подтверждения.

Agent loop ограничен четырьмя tool steps. Job descriptions оборачиваются как
untrusted tool data. Модель не получает произвольный filesystem/network tool.

## 6. LLMRouter и demo credentials

### 6.1 Провайдеры

Начальный capability pool:

- Groq `llama-3.1-8b-instant` — простой чат;
- Groq `qwen/qwen3.6-27b` — tools, русский язык, сравнения;
- Gemini `gemini-3.5-flash-lite` — provider fallback;
- OpenRouter `openrouter/free` — emergency fallback.

Текущие лимиты перепроверяются перед release:

- [Groq rate limits](https://console.groq.com/docs/rate-limits);
- [Groq Qwen 3.6 27B](https://console.groq.com/docs/model/qwen/qwen3.6-27b);
- [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing);
- [OpenRouter pricing](https://openrouter.ai/pricing).

### 6.2 Routing

Для каждого provider/model локально хранятся:

- EWMA latency;
- success/error counts;
- последнее 429;
- cooldown until;
- оценка локально использованной квоты.

Router:

1. Фильтрует модели по required capabilities.
2. Исключает cooldown/quota-exhausted.
3. Выбирает лучший health score.
4. Вызывает с timeout.
5. Валидирует structured output.
6. На rate limit, timeout, transport или schema error пробует следующую.
7. При полном отказе возвращает typed `Unavailable`.

Параллельно модели не вызываются.

### 6.3 Privacy

Провайдеру отправляются:

- system prompt;
- максимум 12 последних сообщений;
- текущий запрос;
- минимальный tool result.

Не отправляются:

- вся база;
- сырой профиль;
- resume;
- local settings;
- BYOK другого провайдера;
- произвольные файлы.

### 6.4 Встроенные ключи

Build pipeline:

1. PR CI использует fake adapters.
2. Release environment содержит provider keys в GitHub Secrets.
3. Secrets передаются Rust build process без печати.
4. Rust compile-time фрагментирует/обфусцирует значения.
5. Provider HTTP вызывается только из Rust.
6. Ключ не возвращается через IPC.
7. Временный буфер очищается после запроса.

Это не делает ключ секретным от владельца компьютера. Каждый demo key:

- отдельный от личных аккаунтов;
- free-tier;
- без billing;
- с минимальными scopes;
- с жёсткими provider quotas;
- пригоден для немедленного revoke.

Signed remote config может изменить priority/disable provider, но не может
отозвать украденный ключ: отзыв выполняется в кабинете провайдера.

BYOK хранится в Windows Credential Manager и имеет приоритет.

## 7. Release

### 7.1 CI

Обязательные jobs:

- Python data tooling: Ruff, format check, mypy, pytest;
- frontend: typecheck, ESLint, Vitest, web build;
- Rust: fmt, clippy, tests;
- snapshot contract;
- Windows Tauri build;
- secret scan.

PR workflows не имеют release secrets.

### 7.2 Artifacts

Tag flow:

1. `v0.1.0-preview.1`;
2. smoke test на чистой Windows 10 и Windows 11;
3. исправления;
4. `v0.1.0`.

Каждый release:

- NSIS installer;
- portable ZIP;
- SHA-256 checksums;
- updater manifest/signatures;
- `NOTICE_DATA.md`;
- snapshot version и known limitations.

Updater private key хранится только в GitHub Secrets. Public key находится в
Tauri config. Portable build уведомляет о новой версии и допускает ручное
скачивание.

Authenticode отсутствует в v1; SmartScreen warning документируется.

## 8. Этапы реализации

### D0. Документационный pivot

- [x] Windows-only pet-project scope.
- [x] Offline SQLite architecture.
- [x] Frozen dataset.
- [x] Match и Emmy contracts.
- [x] Release/demo-key policy.
- [x] Старые ingestion-инструкции объявлены историческими.

Критерий: все документы описывают одно направление.

### M1. Snapshot

- [ ] Read-only SQL подтверждение исходного среза.
- [ ] Детерминированный export.
- [ ] SQLite schema/FTS build.
- [ ] Integrity, attribution, URL, row count.
- [ ] Compression, manifest, SHA-256.
- [ ] Data release asset.
- [ ] Integration test.

Критерий: artifact содержит 78 719 jobs и воспроизводим из frozen PostgreSQL.

### M2. Offline search и shell

- [ ] First-run unpack.
- [ ] Catalog versioning.
- [ ] Search repository.
- [ ] Filters/sorts/cursor.
- [ ] Three-column UI.
- [ ] Virtualized feed.
- [ ] Job detail и original link.
- [ ] Themes, keyboard, error states.

Критерий: поиск без сети; p95 <300 мс.

### M3. Profile, match и shortlist

- [ ] Onboarding.
- [ ] `user.sqlite`.
- [ ] Match components.
- [ ] Match explanations.
- [ ] Shortlist persistence.
- [ ] Match sorting.

Критерий: весь этап работает при физически отключённой сети.

### M4. Emmy

- [ ] Layered SVG и state machine.
- [ ] Rust provider adapters.
- [ ] LLMRouter health/failover.
- [ ] Structured schemas.
- [ ] Пять tools.
- [ ] Confirmation flow.
- [ ] Built-in demo credentials.
- [ ] BYOK Credential Manager.
- [ ] Offline degradation.

Критерий: последовательный отказ провайдеров проверен тестом; local features
не деградируют.

### M5. Public Windows release

- [ ] Public repository.
- [ ] Secret/history audit.
- [ ] Windows release workflow.
- [ ] Tauri updater signing.
- [ ] Installer и portable.
- [ ] Clean-machine smoke.
- [ ] Preview release.
- [ ] Stable v0.1.0.

Критерий: пользователь без dev-зависимостей устанавливает приложение, ищет,
создаёт профиль и общается с Emmy.

## 9. Тестовый план

### Data

- stable row order и checksum;
- ровно 78 719 canonical jobs;
- attribution/source_url not empty;
- FTS row count совпадает с jobs;
- `PRAGMA integrity_check = ok`;
- повторный export даёт тот же logical manifest.

### Search

- русский и английский запрос;
- canonical skill alias;
- quoted phrase;
- typo suggestion;
- каждый фильтр отдельно и в комбинации;
- cursor без пропусков/дублей;
- пустая выдача;
- invalid query не превращается в SQL.

### Match

- полный skill overlap;
- частичный overlap;
- unknown salary;
- incompatible seniority;
- remote/location conflict;
- одинаковый input — одинаковый JSON result;
- score всегда 0–100.

### UI

- keyboard-only;
- reduced motion;
- light/dark;
- first-run progress;
- no-network startup;
- broken source URL;
- catalog corruption recovery;
- сохранность user data после catalog update.

### Emmy

- valid response;
- tool call;
- malformed JSON;
- prompt injection в description;
- timeout;
- 429/Retry-After;
- provider fallback;
- all providers unavailable;
- max tool loop;
- shortlist confirmation;
- built-in key не появляется в JS/logs;
- BYOK precedence.

### Release

- Windows 10/11 x64;
- installer install/uninstall;
- portable launch;
- updater signature rejection;
- checksum;
- clean machine без Node/Rust/Python/Docker.

## 10. Риски

| Риск | Мера |
|---|---|
| Snapshot устаревает | Видимая дата и original link; не обещать live data |
| Source URL умер | Понятное состояние и сохранённая локальная карточка |
| Полный snapshot вызывает претензии | Attribution, NOTICE_DATA, возможность снять artifact |
| Catalog слишком большой | Только canonical normalized data, zstd, без raw/embeddings |
| Demo key извлечён | No billing, scopes/quotas, revoke, release rotation, BYOK |
| Бесплатная квота закончилась | Health routing, cooldown, BYOK, graceful offline |
| Model нарушила schema | Validation и fallback |
| Prompt injection | Untrusted data boundary и закрытый tool union |
| SmartScreen warning | Честная инструкция; Authenticode позже отдельным ADR |
| Scope снова растёт | Этапы и запрет соседних функций без нового решения |

## 11. Definition of Done

MVP готов, когда:

- public release устанавливается на чистую Windows;
- catalog проверяется и открывается;
- offline search проходит performance gate;
- профиль, shortlist и история переживают перезапуск;
- match-score объясним и воспроизводим;
- Emmy отображает корректное состояние, вызывает только разрешённые tools и
  переключает провайдеры;
- полный отказ AI не влияет на поиск;
- update artifact проверяется подписью;
- документация соответствует фактическому поведению.
