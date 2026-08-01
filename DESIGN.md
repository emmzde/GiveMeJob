---
name: GiveMeJob!
description: Compact, calm, content-first interface for an offline-first Windows job search app.
colors:
  canvas: "var(--bg)"
  surface: "var(--surface-0)"
  surface-subtle: "var(--surface-1)"
  surface-active: "var(--surface-active)"
  text: "var(--text)"
  text-secondary: "var(--text-secondary)"
  text-tertiary: "var(--text-tertiary)"
  border: "var(--border)"
  border-strong: "var(--border-strong)"
  accent: "var(--accent)"
  accent-muted: "var(--accent-muted)"
  on-accent: "var(--on-accent)"
  positive: "var(--positive)"
  warning: "var(--warning)"
  danger: "var(--danger)"
typography:
  micro:
    fontFamily: "var(--font)"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "var(--font)"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.333
  body:
    fontFamily: "var(--font)"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.429
  title:
    fontFamily: "var(--font)"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.556
  detail-title:
    fontFamily: "var(--font)"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  small: "var(--radius-sm)"
  medium: "var(--radius-md)"
  large: "var(--radius-lg)"
components:
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.body}"
    rounded: "{rounded.medium}"
    padding: "0 12px"
    height: "36px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.medium}"
    padding: "0 10px"
    height: "36px"
  navigation-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.medium}"
    padding: "0 8px"
    height: "32px"
---

# Design System: GiveMeJob!

## Overview

**Creative North Star: "Спокойный локальный рабочий стол"**

GiveMeJob! — компактный, спокойный и content-first Windows-интерфейс. Он ведёт себя как рабочий инструмент: каталог, фильтры, лента и карточка вакансии получают пространство первыми, а chrome остаётся тонким, почти монохромным и предсказуемым. Плотность высокая, но не тесная: иерархия строится типографикой, нейтральными поверхностями, однопиксельными границами и устойчивым ритмом.

Встроенный design contract имеет seed `0c99543c`. Он фиксирует происхождение визуального направления — поставленную композицию `givemejob-design`, компактный desktop shell, локальный search workspace, detail и опциональный dock Emmy. Seed не является источником токенов и не разрешает добавлять отсутствующие продуктовые функции.

`PRODUCT.md` — сопровождающий Impeccable-контекст о пользователях, назначении и честных ограничениях продукта. Он объясняет, почему интерфейс выглядит и говорит именно так, но не заменяет `AGENTS.md`, ADR, scope-документы или фактический код. Этот `DESIGN.md` описывает визуальную систему и также не расширяет продуктовый scope.

**Key Characteristics:**

- Компактный, спокойный, keyboard-first desktop workspace.
- Контент и локальный статус важнее декоративного chrome.
- Почти монохромная палитра; акцент и semantic colors используются только по смыслу.
- Плоские поверхности, тонкие границы и редкая elevation только для временных слоёв.
- Честные loading, empty, error, disabled и offline-состояния без демонстрационных подмен.
- Светлая, тёмная и системная темы на одной семантической модели.

## Colors

Единственный нормативный источник цветов — `docs/design-tokens.css`. Frontmatter выше содержит только ссылки на его CSS custom properties; он не дублирует и не переопределяет их значения. Runtime-файл `apps/desktop/src/styles/tokens.css` только импортирует этот источник.

### Primary

- **Сдержанный индиго** (`--accent`, `--accent-hover`, `--accent-muted`, `--accent-border`, `--on-accent`): выбранные вакансии, активные navigation icons, основные действия, selected counters и focus-adjacent emphasis. Акцент редок и всегда обозначает действие, выбор или принадлежность к продукту.

### Neutral

- **Canvas и surfaces** (`--bg`, `--surface-0` … `--surface-3`, hover/active variants): формируют почти монохромную иерархию shell, панелей и контролов.
- **Текстовая шкала** (`--text`, secondary, tertiary, placeholder, disabled): кодирует приоритет информации без лишнего цвета.
- **Границы** (`--border`, `--border-strong`): разделяют постоянные области и контролы; они предпочтительнее теней.

### Secondary

- **Semantic feedback** (`--positive`, `--warning`, `--danger` и их muted/border/on variants): только успех, предупреждение, ошибка или опасное системное действие.
- **Emmy palette** (`--emmy-*`): небольшая тёплая подпись маскота внутри нейтрального shell. Она не становится общей декоративной палитрой приложения.

Светлая тема определена на `:root`, тёмная — на `[data-theme="dark"]`. Пользователь может выбрать system, light или dark; system следует `prefers-color-scheme`, а документ получает соответствующие `data-theme` и `color-scheme`. Компоненты не должны знать конкретные цветовые значения.

**The Semantic Color Rule.** Цвет появляется только для выбора, focus, статуса, опасного действия или Emmy; остальная иерархия остаётся нейтральной.

**The One Source Rule.** Не добавлять inline hex, rgb/hsl/oklch или локальные theme maps в компоненты. Новый цвет сначала получает семантическую роль в `docs/design-tokens.css` для обеих тем.

## Typography

**Display and body font:** `--font` — `Segoe UI Variable`, затем `Segoe UI` и системные sans-serif fallbacks. Корневой размер приложения — `15px`.

**Label/mono font:** системный monospace применяется точечно для keyboard hints, catalog/profile versions и коротких технических идентификаторов.

**Character:** системная Windows-типографика делает интерфейс знакомым и быстрым. Иерархия компактна: большинство интерфейса живёт на уровнях micro, label и body; крупный текст зарезервирован для screen и job-detail headings.

### Hierarchy

- **Detail title** (semibold, `1.25rem`, tight tracking): название выбранной вакансии.
- **Screen title** (semibold, `1.125rem`): Profile и Settings; search shell использует более компактный heading.
- **Body** (regular/medium, `0.875rem`): вакансии, описания и основные действия.
- **Label** (medium/semibold, `0.75rem`): navigation, filters, controls и metadata.
- **Micro** (regular/semibold, `10–11px`): status bar, counts, helper copy, badges и shortcut hints.
- **Section eyebrow** (semibold, uppercase, `0.75rem`, tracking около `0.08em`): только короткие группы settings/profile, не длинный контент.

Заголовки используют небольшое отрицательное tracking только там, где это уже реализовано. Для чисел каталога, зарплаты и счётчиков используется tabular alignment. Текст вакансии остаётся plain text; недоверенные descriptions не рендерятся как HTML или Markdown.

**The Compact Hierarchy Rule.** Не вводить marketing-scale display type: рабочий контент должен оставаться самым заметным элементом экрана.

## Layout

Desktop shell занимает viewport и имеет минимальные размеры `320px × 620px`. Вертикальная рамка фиксирована:

- custom titlebar — `40px`;
- рабочая область — всё оставшееся пространство;
- status bar — `24px`.

На широком desktop постоянная navigation sidebar имеет ширину `176px`. Search workspace строится как grid: filters `240px`, feed и job detail делят оставшуюся ширину; при открытом detail feed удерживается примерно в диапазоне `340–410px`, а detail получает не менее `360px`. Без выбранной вакансии feed расширяется. Emmy открывается отдельным dock справа с изменяемой шириной `300–440px`; separator поддерживает mouse drag и Arrow Left/Right с шагом `16px`.

Spacing следует 4px-ритму, фактически чаще всего используя `8`, `12`, `16`, `20`, `24` и `32px`. Плотные controls имеют высоту `28–36px`, navigation rows — `32px`, filter rows — не менее `40px`, feed row — не менее `112px`. Spacing пока является implementation convention, а не отдельной дублирующей token scale.

Responsive transitions являются изменением режима панелей, а не уменьшенной копией desktop:

- **около `1120px`:** filters перестают быть постоянной grid-column и становятся overlay под titlebar, над status bar, с привязкой слева к navigation rail;
- **около `900px`:** Emmy перестаёт отнимать ширину workspace и становится правым overlay между titlebar и status bar;
- **около `800px`:** job detail перестаёт быть второй grid-column и открывается overlay поверх workspace, сохраняя левый offset navigation;
- **около `640px`:** navigation sidebar скрывается, offsets filters/detail сбрасываются к левому краю, Emmy может занять всю ширину, titlebar и status content упрощаются;
- на `800px` и выше selected job может быть показан рядом с feed; на `1120px` и выше filters возвращаются в grid.

Временные overlays сохраняют контекст вместо навигации на отдельную страницу. Scroll принадлежит содержимому панели; body остаётся фиксированным. Списки длиннее 50 элементов виртуализируются: это реализовано для feed, shortlist и autocomplete suggestions.

**The Workspace First Rule.** При нехватке ширины сворачивать вторичные панели в overlays, а не сжимать feed и detail до нечитаемого состояния.

## Elevation & Depth

Система flat-by-default. Постоянные области разделяются surface tone и границей; тяжёлые тени отсутствуют. `--shadow-sm` и `--shadow-md` определены в единственном token source, но medium elevation используется только там, где слой действительно проходит над другим: command dialog, autocomplete popup, overlay filters и overlay Emmy.

Backdrop command palette использует semantic overlay token. Карточки внутри постоянных панелей не должны накапливать вложенные тени; depth передаётся surface level, border и spacing.

**The Temporary Elevation Rule.** Тень обозначает временный слой или popup, а не важность обычного контента.

## Shapes

Форма сдержанно прямоугольная. Нормативная radius scale живёт в `docs/design-tokens.css`: small `4px`, medium `7px`, large `10px`. Структурные containers, dialogs, fields, buttons и cards не превышают `10px`; локальные `2px` и `5px` допустимы для tiny affordances и product mark. Полный круг/капсула зарезервирован для маленьких count indicators, а не для основных контейнеров.

Границы обычно однопиксельные. Dashed border допустим для честного empty state профиля. Lucide icons используются преимущественно в размере `16px`, с `12–14px` для micro chrome и `20px` для screen-level markers.

**The Quiet Geometry Rule.** Не превращать интерфейс в коллекцию больших округлых карточек; радиус поддерживает affordance, а не создаёт декор.

## Components

### Desktop shell and navigation

Titlebar содержит product mark, текущий screen breadcrumb, вход в command palette, локальный catalog status, честный AI-offline status, Settings и native window controls. Navigation sidebar содержит Jobs, Shortlist, Profile, Emmy и Settings. Active row получает neutral active surface и accent icon; все пять пунктов ведут к реально существующему screen или panel.

Numeric shortcuts работают глобально только без Ctrl/Alt/Meta и вне editable controls: `1` открывает Search, `2` — Shortlist, `3` — Profile, `5` — Settings, `4` переключает панель Emmy. `s` меняет shortlist state выбранной вакансии только на Search/Shortlist.

### Search, feed and detail

Search header объединяет filters toggle, поле запроса, accent submit, syntax hint, active filter chips, локальный progress/error feedback, result count, snapshot metadata и segmented sort. Filter groups используют native `details/summary`, checkboxes и combobox/listbox autocomplete. Selected filter chips являются кнопками снятия фильтра.

Feed rows — border-separated list items, не отдельные shadow cards. Основная кнопка вакансии и соседняя кнопка shortlist не вложены друг в друга. Hover использует neutral surface; выбранная строка — accent-muted surface и accent border. Roving tab stop, `aria-current`, `data-selected` и virtual scroll держат большую ленту управляемой. Skeleton rows сохраняют геометрию загрузки; empty/error/end states остаются внутри feed.

Job detail показывает источник, attribution и snapshot version, а original action открывает системный браузер через native boundary. Description выводится как безопасный plain text. Technical metadata сворачивается native `details`.

Screen-scoped shortcuts:

- `/` фокусирует поиск только на Search, когда локальный каталог готов, и не перехватывает ввод в editable control;
- `j` / `k` перемещают selection по feed только на Search и вне editable controls; Arrow Up/Down делают то же, когда focus уже внутри feed;
- `Ctrl+Enter` открывает original только на Search, при загруженном detail и вне editable controls;
- `Ctrl+K` глобально переключает command palette, но не перехватывается внутри editable controls; dialog удерживает focus и возвращает его trigger/предыдущему элементу после закрытия;
- `Ctrl+E` глобально переключает dock Emmy; текущий handler не ограничен active screen.

### Buttons, fields, badges and state

Buttons имеют базовую высоту `36px`, medium radius и варианты default, accent, outline и ghost. Hover меняет semantic background/opacity, active выбор остаётся видимым, disabled использует opacity и запрещает pointer events. Fields имеют border, neutral surface и visible placeholder; validation связывается через `aria-invalid`, description/error id и live alert. Badges различают neutral, accent, positive, warning и outline roles без декоративной радуги.

Глобальный `:focus-visible` — контрастный `2px` outline с offset `2px`; сложные composite controls сохраняют эквивалентный видимый focus. Все mouse actions должны иметь keyboard path. Popup autocompletes поддерживают Arrow Up/Down, Home/End, Enter и Escape. Emmy resizer — focusable separator с value semantics и arrow resizing.

Default semantic motion — `140ms` для background, border, color и opacity с `--ease`. Motion подтверждает state, не украшает idle UI. Единственная текущая signature-анимация Emmy — тихие sleep marks; `prefers-reduced-motion` отключает smooth scrolling, сводит transitions/animations к `1ms` и одной итерации. Смена состояния не должна зависеть от движения.

### Profile, shortlist, match and Emmy: current truth

Profile — реальный локальный screen, а не mock. Он загружает, создаёт, валидирует, сохраняет и редактирует профиль в локальном `user.sqlite`: до пяти желаемых ролей, canonical skills из локального каталога, seniority, country/city, work modes и минимальная годовая зарплата USD. Черновик переживает переключение screen, field-level error фокусирует первое неверное поле, load error имеет Retry. Summary показывает сохранённые значения, локальную version и update time.

Shortlist доступен из feed/detail, отдельного виртуализированного screen и shortcut `s`; данные переживают restart. Match-score считается локально и on-demand для показанных вакансий, отображает пять components, strengths и gaps. Глобальный match-sort пока отсутствует и отложен по ADR-018.

Emmy — честный offline dock. Панель показывает sleeping SVG mascot, описание этапа M4 и disabled composer/send control. Сейчас нет LLMRouter, provider calls, tool calling, chat history или синтетических ответов. Offline Emmy не влияет на search, filters, detail, Settings или Profile.

### Localization and accessibility

Новый user-facing copy проходит через `t(...)`; locale-sensitive dates, numbers, capitalization и comparisons используют `getLocaleTag(...)`. Текущий default locale приходит из `config/product.json` и разрешается как `ru-RU`. Brand names и нединамические product marks могут оставаться literal, но компоненты не должны размножать русские строки или вручную форматировать locale-sensitive данные.

Semantic HTML и ARIA являются частью component contract: headings и landmarks, navigation labels, list/listitem, button и combobox relations, live status/error regions, accessible names для icon-only controls, `aria-current`, `aria-expanded`, disabled semantics и focus restore. Loading использует skeleton/status вместо блокирующего spinner или modal. Интерфейс поддерживает light/dark contrast model, Windows Narrator и reduced motion; действия мышью должны оставаться доступны с клавиатуры.

## Do's and Don'ts

### Do:

- **Do** ставить локальный каталог, feed content и текущий status выше decorative chrome.
- **Do** использовать только semantic properties из `docs/design-tokens.css` и добавлять theme counterparts одновременно.
- **Do** сохранять компактный 4px rhythm, 40/176/240/24 shell dimensions и panel-mode breakpoints, пока изменение не подтверждено новой реализацией.
- **Do** использовать borders и surface levels для постоянной структуры, medium shadow — только для overlays/popups.
- **Do** сохранять visible focus, keyboard equivalence, semantic roles, live feedback и reduced-motion fallback.
- **Do** виртуализировать списки длиннее 50 элементов.
- **Do** писать весь новый UI copy через `t(...)`, а locale-sensitive formatting — через `getLocaleTag(...)`.
- **Do** показывать реальный current scope: локальные Profile/Shortlist/on-demand match работают, global match-sort отсутствует, Emmy offline.

### Don't:

- **Don't** добавлять gradients, heavy shadows, glass effects или декоративное свечение.
- **Don't** использовать inline hex/colors, дублировать theme values или превращать `DESIGN.md` в второй token source.
- **Don't** превышать `10px` radius для структурных rectangular components; не делать основные containers pill-shaped.
- **Don't** раскрашивать neutral UI без semantic причины или использовать Emmy palette как общий accent set.
- **Don't** перехватывать screen-scoped shortcuts в полях ввода или на неподходящем screen.
- **Don't** рендерить vacancy text как HTML/Markdown и не использовать его как UI-инструкцию.
- **Don't** изображать global match-sort, AI chat, model responses или Emmy tools до их фактической реализации.
- **Don't** позволять animation, hover или color быть единственным носителем состояния.
