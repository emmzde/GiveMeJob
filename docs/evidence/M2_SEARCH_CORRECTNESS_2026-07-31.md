# M2 search correctness — evidence

Дата проверки: 31 июля 2026 года.

Scope этой записи ограничен backend search correctness. Она не закрывает M2
целиком и не является performance benchmark evidence.

## Реализованный контракт

- Rust search разделён на DTO, validation, normalization, aliases, cursor и
  query-builder модули.
- Backend применяет NFKC/lowercase/whitespace normalization; filter arrays
  сортируются и dedupe до SQL и cursor fingerprint.
- Quoted parser не исполняет пользовательские `AND`, `OR`, `NEAR` или скобки.
- FTS строится как AND concepts / OR aliases и сохраняет phrase grouping.
- Alias configs имеют `schema_version = 1`; loader отклоняет неизвестную
  schema, duplicate canonical и ambiguous alias без explicit target.
- Первые 54 skill entries имеют RU aliases; role aliases содержат curated
  RU↔EN mappings. Selenium и Playwright не пересекаются.
- Relevance tuple: exact normalized title, exact canonical skill count, BM25,
  job ID. Cursor envelope version — 2.
- Typo suggestion использует bounded Damerau-Levenshtein только по curated
  dictionary, возвращается при `total <= 3` и не применяется автоматически.

## Проверки

```text
Frontend: typecheck, ESLint, 24 Vitest tests, production web build — passed.
Rust: cargo fmt/check/test/clippy -D warnings — passed; 32 tests.
Python: ruff check/format, strict mypy — passed.
Python: pytest — 35 passed.
git diff --check — passed.
```

Root `pnpm quality` прошёл frontend и Rust группы, затем остановился до Python
на отсутствии `uv` в PATH. Те же pinned `.venv` executables были запущены
напрямую; pytest получил уникальный workspace `--basetemp`, потому что
системный `%TEMP%\pytest-of-Emil` возвращал `WinError 5`.

## Frozen catalog smoke

Read-only smoke выполнялся на локальном
`.artifacts/catalog/catalog-v1.sqlite` (78 719 jobs). Непустую выдачу дали:

```text
python
разработчик
python разработчик
"data scientist"
cpp
c#
.net
node.js
playwright
```

Запрос `pyhton` вернул suggestion `python`; исправленный запрос автоматически
не запускался.
