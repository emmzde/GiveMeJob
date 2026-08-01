# Product

<!-- impeccable:product-schema 1 -->

## Platform

Windows desktop / Tauri

## Users

GiveMeJob! предназначен для соискателей IT- и digital-вакансий, которые ищут
работу на Windows и хотят быстро исследовать большой каталог без аккаунта,
облачного backend и обязательного подключения к интернету.

## Product Purpose

Приложение даёт локальный поиск по зафиксированному каталогу вакансий,
сохраняемые профиль и shortlist, объяснимое локальное совпадение и
необязательного AI-ассистента Emmy. Успех означает, что
основной поиск и пользовательские данные полезны и доступны даже при полностью
отключённой сети.

## Positioning

GiveMeJob! объединяет устанавливаемый Windows-клиент, неизменяемый локальный
SQLite FTS5-каталог и детерминированное объяснимое совпадение без обязательного
сервера, аккаунта или LLM.

## Operating Context

- Публичный open-source pet-project и portfolio MVP, а не production-агрегатор.
- Целевая платформа — Windows 10/11 x64; основной артефакт — NSIS Setup.exe,
  дополнительный — portable ZIP.
- Каталог содержит 78 719 канонических вакансий и поставляется отдельным
  versioned release artifact с зафиксированным SHA-256.
- Интернет используется только для открытия оригинальной вакансии, Emmy и
  необязательной асинхронной проверки обновлений.

## Capabilities and Constraints

- Реализованы offline-поиск, фильтры, сортировки, виртуализированная лента,
  detail и открытие оригинального URL через Rust.
- Реализованы локальный профиль, shortlist, полный schema-v1 contract
  `user.sqlite` и детерминированный match breakdown для показанных вакансий.
- Глобальный match-sort остаётся честно скрытым и отложен после core M4 до M5
  по ADR-018.
- Core Emmy реализован: Rust `LLMRouter`, четыре последовательных провайдера,
  structured output, пять локальных tools, timeline, job cards, comparison,
  quick replies, confirmation и локальная история. M4 остаётся текущим этапом
  до live-provider, BYOK restart, native offline и protected-release smoke.
- Ingestion, embeddings, vector search, cloud backend, аккаунты, синхронизация,
  parsing резюме и автоматическая отправка откликов вне scope.
- Вакансии являются недоверенным plain text. React не рендерит из них HTML или
  Markdown.
- Все сетевые AI-вызовы проходят только через Rust; ключи никогда не
  попадают во frontend, SQLite, логи или документацию.

## Brand Commitments

- Название продукта — GiveMeJob!, маскот — собачка Emmy.
- Тон спокойный, честный и практичный; match в UI называется «совпадением», а
  не вероятностью трудоустройства.
- Поставленный каталог `givemejob-design` является обязательным визуальным
  референсом для нового desktop shell. Vendor-брендинг, telemetry, mock-данные и
  инфраструктура референса частью продукта не являются.

## Evidence on Hand

- Нормативные решения и scope находятся в `AGENTS.md`, `docs/DECISIONS.md` и
  `docs/MVP_SCOPE.md`.
- M2 принят 1 августа 2026 года; неизменяемые результаты и screenshots находятся
  в `docs/evidence/`.
- Минимальный M3 принят 1 августа 2026 года; текущий этап — M4.
- Реализованный M4 core и открытые acceptance gates зафиксированы в
  `docs/evidence/M4_IMPLEMENTATION_PROGRESS_2026-08-01.md`.
- Реальный snapshot содержит source attribution и оригинальный URL для каждой
  вакансии.
- Коммерческих заявлений, testimonials, production-пользователей или внешних
  benchmark-утверждений нет; UI не должен их выдумывать.

## Product Principles

- Основной продукт остаётся полезным без AI и без сети.
- Реальные локальные данные важнее демонстрационных состояний.
- Любой score должен быть воспроизводимым и объяснимым.
- Пользовательские данные остаются на устройстве.
- Быстрый keyboard-first интерфейс и доступность являются частью готовности, а
  не отдельным polish-этапом.

## Accessibility & Inclusion

Все действия мышью доступны с клавиатуры; интерфейс поддерживает visible focus,
Windows Narrator, светлую и тёмную темы и `prefers-reduced-motion`. Длинные
списки виртуализируются.
