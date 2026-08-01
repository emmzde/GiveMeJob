# M2 theme, keyboard и accessibility evidence — 1 августа 2026

## Scope

Проверка относится только к M2 offline shell. Она не добавляет profile,
shortlist, Emmy или их будущие shortcuts.

Реализовано:

- `system`, `light`, `dark`; preference живёт только в Zustand session state и
  после reload снова равен `system`;
- resolved `light|dark` всегда записывается в `data-theme` корневого `html`, а
  native `color-scheme` выбирается CSS по этому атрибуту;
- secondary и placeholder tokens имеют WCAG AA contrast на `--bg` и
  `--bg-secondary`;
- `/` фокусирует основной search input;
- `j/k` перемещают selection, feed использует listbox/option semantics и
  roving `tabindex`, а virtualizer прокручивает выбранную строку в viewport;
- `Ctrl+Enter` открывает original выбранной вакансии;
- global shortcuts не срабатывают из input, textarea, select и contenteditable;
- `Ctrl+K` открывает cmdk/Radix dialog с focus trap и focus restore;
- palette содержит только focus search, show/hide filters и три реально
  работающих theme actions;
- `s` и `Ctrl+E` не зарегистрированы;
- все Lucide product icons имеют размер 16 px;
- reduced-motion media rule отключает smooth scroll и сводит transition и
  animation к одному 1 ms cycle.

## Contrast

Минимальный обязательный порог для обычного текста — `4.5:1`.

| Theme | Token | На `--bg` | На `--bg-secondary` |
|---|---|---:|---:|
| light | `--text-secondary` | 6.58 | 6.14 |
| light | `--text-placeholder` | 4.88 | 4.55 |
| dark | `--text-secondary` | 9.87 | 9.15 |
| dark | `--text-placeholder` | 6.97 | 6.46 |

Значения пересчитываются frontend-тестом из фактических hex tokens, а не
зафиксированы в assertion как готовые коэффициенты.

## Automated acceptance

Команды:

```text
pnpm -C apps/desktop typecheck  PASS
pnpm -C apps/desktop lint       PASS
pnpm -C apps/desktop test       PASS — 121 tests
pnpm -C apps/desktop web:build  PASS
```

`axe-core 4.12.1` smoke не нашёл нарушений в отдельных surfaces:

- shell;
- filters;
- feed;
- detail;
- app error fallback;
- command dialog.

`color-contrast` rule в jsdom отключён намеренно: jsdom не имеет layout/CSS
engine. Вместо ложного результата AA проверяется отдельным token contrast
test, указанным выше.

## Browser smoke, Chromium, 900×620

Проверено на локальном Vite shell во встроенном Chromium:

```text
viewport              = 900 × 620
document scroll size  = 900 × 620
horizontal overflow   = none
header height         = 56
content height        = 564
filters initial       = hidden
filters overlay       = 280 × 564, top 56
browser console       = no warnings/errors
```

Дополнительно подтверждено:

- `system` разрешился в `dark`, одновременно получены
  `data-theme=dark` и `color-scheme=dark`;
- переключение control в `light` дало `data-theme=light` и
  `color-scheme=light`, переключение обратно в `dark` — соответствующую пару;
- после reload preference снова `system`, то есть M2 не создал постоянное
  хранение;
- `Ctrl+K` открыл dialog, фокус оказался в combobox;
- Tab остался внутри dialog;
- Escape закрыл dialog и вернул фокус на trigger при открытии мышью, а при
  открытии shortcut — на прежний элемент;
- accessibility tree содержит подписанные theme/search/filter controls,
  dialog, listbox, groups и options.

## Ручной screen-reader статус

Accessibility-tree smoke и keyboard-only browser smoke выполнены. Реальный
слуховой smoke через NVDA/Narrator не заявляется: в агентской сессии нельзя
достоверно услышать и оценить синтезированную речь. Перед закрытием M2 нужен
короткий человеческий прогон на Windows:

1. search → results count → feed option → detail heading;
2. filters и autocomplete;
3. loading, empty, search error и detail error announcements;
4. command dialog open, navigation, Escape и focus restore;
5. light/dark и Windows reduced-motion setting.

Это ограничение не отменяет автоматический axe/contrast gate, но не заменяет
финальный native screen-reader acceptance.

## M2 gate

Theme/keyboard/automated accessibility часть реализована. M2 остаётся открыт
до человеческого native screen-reader/reduced-motion smoke и ранее
зафиксированных feed-scroll, cold-query, repeated-startup и steady-state RAM
измерений.
