# GiveMeJob! — scope Windows pet MVP

Дата решения: 31 июля 2026 года.

## Цель релиза

Публичный Windows pet-project с красивым локальным поиском работы,
объяснимым match-score и AI-маскотом Emmy.

Пользователь скачивает `Setup.exe` или portable ZIP и работает без Docker,
Python, PostgreSQL, регистрации и обязательной настройки API-ключа.

## Зафиксированный набор данных

Источник SQLite catalog — локальный срез PostgreSQL с границей данных
`2026-07-29T20:30:03.846872Z`. Artifact экспортирован с зафиксированным
`exported_at` и принят после проверки M1 31 июля 2026 года; `published_at`
остаётся `null` до первого stable release:

| Метрика | Значение |
|---|---:|
| Активные канонические вакансии | 78 719 |
| Канонические вакансии со skills | 68 881 (87,50%) |
| Канонические вакансии с `salary_usd_year` | 22 467 (28,54%) |
| Residual-дубли | 0 |
| Исторические embeddings 1024 dim | 1 |
| Медианный возраст на момент фиксации | 21,87 дня |
| Активные сырые строки | 78 877 |

Для runtime используются только активные канонические вакансии. Raw source
variants, ingestion checkpoints и embedding не экспортируются.

Himalayas full sweep, на котором получена основная часть набора, завершён:

- обработано 96 200 feed items;
- сохранено 96 182 upsert;
- 68 409 source rows;
- attribution `Himalayas` и backlink присутствовали у всех строк.

Эти значения были повторно подтверждены read-only SQL и приняты вместе с
первым catalog artifact; неизменяемая запись находится в `docs/evidence/`.

## Входит в v1

### Данные и поиск

- versioned SQLite FTS5 catalog;
- title/company/skills/location/description search;
- RU/EN-алиасы и ESCO;
- фильтры по skills, location, remote mode, seniority, employment, salary и
  source;
- M2-сортировки по relevance, newest и salary;
- глобальная сортировка по match после core M4 и до M5 release gate по
  ADR-018;
- карточка вакансии с attribution и оригинальной ссылкой;
- видимая дата frozen snapshot (`source_frozen_at`);
- локальная работа без сети.

Необязательная проверка обновления приложения разрешена, но запускается
асинхронно и не блокирует offline startup или локальный поиск.

### Профиль и match

- profile empty-state и короткая ручная анкета без отдельного wizard;
- локальное хранение;
- deterministic match-score 0–100;
- component breakdown, strengths и gaps;
- shortlist;
- сортировка по match как отложенный post-M4 v1 follow-up.

Match-score не является вероятностью трудоустройства.

### Emmy

- анимированная SVG-собачка;
- состояния idle/listening/thinking/searching/success/empty/error/offline;
- чат со strict structured output;
- ровно пять локальных tools: `search_jobs`, `get_job`, `compare_jobs`,
  `get_match_breakdown`, `set_shortlist`;
- подтверждение shortlist mutation;
- release-only встроенные demo credentials, считающиеся извлекаемыми;
- BYOK через Windows Credential Manager;
- последовательный Groq → Gemini → OpenRouter → Cerebras fallback;
- graceful offline state.

### Распространение

- Windows 10/11 x64;
- NSIS installer;
- portable ZIP;
- public GitHub repository и Releases;
- подписанные Tauri updater artifacts;
- без Authenticode в v1.

До stable распространяются только приватные RC artifacts из CI. Публичный
preview/prerelease не входит в текущий scope и требует отдельного ADR.

## Не входит

- ingestion и новые job API calls;
- постоянное обновление вакансий;
- backend runtime;
- accounts/sync;
- embeddings/vector search;
- probability of offer;
- PDF/DOCX resume parsing;
- application tracker;
- cover letters;
- auto apply;
- notifications о новых вакансиях;
- macOS/Linux/mobile;
- production SLA, billing и монетизация.

## Данные пользователя

Локально в `user.sqlite`:

- профиль;
- shortlist;
- настройки;
- recent searches;
- история Emmy;
- зарезервированная таблица `provider_health`; текущие EWMA, error/429 counters
  и cooldown живут только в памяти процесса.

В Windows Credential Manager:

- BYOK.

Провайдеру не передаются вся база, полный профиль или резюме. Только последние
12 сообщений, запрос и минимальные результаты явно вызванных инструментов.
Agent loop выполняет не более четырёх tool-шагов. Локальная timeline загружает
до 500 последних сообщений активного разговора и показывает до восьми последних
разговоров.

## Принятые ограничения

- snapshot будет стареть;
- часть оригинальных ссылок со временем перестанет работать;
- весь текущий нормализованный snapshot публично распространяется вместе с
  приложением;
- demo API keys можно извлечь из бинарника;
- общий free-tier quota может закончиться;
- SmartScreen может предупредить о неподписанном издателе.

Каждое ограничение должно иметь понятное UI-состояние, а не приводить к падению.

## Критерий готового MVP

На чистой Windows 10/11 x64 без dev-инструментов:

1. Устанавливается `Setup.exe`.
2. Каталог распаковывается и проверяется по checksum.
3. Поиск работает офлайн.
4. Профиль и shortlist сохраняются после перезапуска.
5. Match-score детерминирован.
6. Emmy выполняет tools и переключает провайдера при сбое.
7. При полном отказе AI локальный продукт остаётся работоспособным.
8. Обновление проверяет подпись Tauri.
