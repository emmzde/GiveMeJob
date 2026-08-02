---
name: GiveMeJob!
description: Dark-first precision workbench for local Windows job search, match, shortlist, and optional Emmy assistance.
colors:
  canvas: "var(--bg)"
  canvas-secondary: "var(--bg-secondary)"
  raised: "var(--bg-raised)"
  sidebar: "var(--sidebar)"
  sidebar-field: "var(--sidebar-field)"
  panel-card: "var(--panel-card)"
  surface-hover: "var(--surface-hover)"
  surface-active: "var(--surface-active)"
  text: "var(--text)"
  text-secondary: "var(--text-secondary)"
  text-tertiary: "var(--text-tertiary)"
  text-disabled: "var(--text-disabled)"
  border: "var(--border)"
  border-strong: "var(--border-strong)"
  accent: "var(--accent)"
  accent-hover: "var(--accent-hover)"
  accent-muted: "var(--accent-muted)"
  accent-border: "var(--accent-border)"
  on-accent: "var(--on-accent)"
  focus: "var(--focus)"
  positive: "var(--positive)"
  warning: "var(--warning)"
  danger: "var(--danger)"
  emmy-fur: "var(--emmy-fur)"
  emmy-outline: "var(--emmy-outline)"
typography:
  micro:
    fontFamily: "var(--font)"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: "var(--font)"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.455
  label:
    fontFamily: "var(--font)"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.333
  body:
    fontFamily: "var(--font)"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.538
  workspace-title:
    fontFamily: "var(--font)"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: "-0.025em"
  screen-title:
    fontFamily: "var(--font)"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
rounded:
  small: "var(--radius-sm)"
  medium: "var(--radius-md)"
  large: "var(--radius-lg)"
spacing:
  unit: "4px"
  compact: "8px"
  control: "12px"
  panel: "16px"
  section: "20px"
  content: "24px"
  screen: "32px"
components:
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.body}"
    rounded: "{rounded.medium}"
    padding: "0 12px"
    height: "36px"
  button-default:
    backgroundColor: "{colors.text}"
    textColor: "{colors.canvas}"
    typography: "{typography.body}"
    rounded: "{rounded.medium}"
    padding: "0 12px"
    height: "36px"
  field:
    backgroundColor: "{colors.sidebar-field}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.medium}"
    padding: "0 10px"
    height: "36px"
  search-field:
    backgroundColor: "{colors.sidebar-field}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.medium}"
    padding: "0 12px"
    height: "40px"
  navigation-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.body}"
    rounded: "{rounded.medium}"
    padding: "0 10px"
    height: "36px"
  panel-card:
    backgroundColor: "{colors.panel-card}"
    textColor: "{colors.text}"
    rounded: "{rounded.large}"
    padding: "20px"
---

# Design System: GiveMeJob!

## Overview

**Creative North Star: "Точный локальный рабочий стол"**

GiveMeJob! — плотный локальный workbench для Windows, а не светлая web-оболочка вокруг карточек. Референсное состояние — почти чёрная рабочая среда с угольными панелями, однопиксельными разделителями и компактной типографикой: навигация, поиск, лента, постоянный detail и опциональная Emmy читаются как единый точный инструмент.

Визуальная история следует реальному продукту: пользователь ищет в локальном каталоге, видит объяснимое совпадение, сохраняет вакансию и при желании подключает Emmy. AI остаётся дополнительным dock, а не центром композиции; offline-состояние не меняет иерархию каталога. Светлая тема реализована на той же семантической модели, но не возвращает систему к прежней бледной shell-эстетике.

Design seed `0c99543c` фиксирует происхождение нового мира и поставленный desktop dashboard как визуальный ориентир. `PRODUCT.md` объясняет назначение и честные ограничения продукта; `AGENTS.md` и документы scope остаются выше этого визуального контракта.

**Key Characteristics:**

- Плотный dark-first desktop workbench с почти чёрным canvas и угольными поверхностями.
- Постоянный контекст: navigation → search/feed → job detail, с Emmy как опциональным правым dock.
- Однопиксельные dividers и тональные перепады вместо декоративной карточности.
- Inter-first типографика с Segoe fallback и компактной информационной иерархией.
- Синий только для действия, focus и явного выбора; обычная структура остаётся нейтральной.
- Реальные loading, empty, error, offline и disabled-состояния без демонстрационных подмен.

**The Local Truth Rule.** Каталог, совпадение и сохранение должны оставаться визуально полноценным продуктом без Emmy и без сети.

## Colors

Единственный документированный источник значений цветов — `docs/design-tokens.css`. Frontmatter и sidecar только ссылаются на его semantic custom properties; runtime-файл `apps/desktop/src/styles/tokens.css` импортирует тот же источник.

### Primary

- **Signal Blue** (`--accent`, hover/muted/border/on roles): кнопка поиска, focus, выбранные сегменты, активные counters и другие состояния, где пользователь действует или подтверждает выбор.
- **Precision Focus** (`--focus`): контрастный keyboard focus и focus-within у полей и composer.

### Secondary

- **Semantic Status** (`--positive`, `--warning`, `--danger` и связанные muted/border/on roles): готовность локального каталога, предупреждения, ошибки и destructive window state.
- **Emmy Signature** (`--emmy-*`): тёплая шерсть, контур и ошейник SVG-маскота. Эта палитра принадлежит только Emmy.

### Neutral

- **Near-Black Canvas** (`--bg`, `--surface-0`): базовое dark-first поле приложения.
- **Charcoal Structure** (`--sidebar`, `--bg-secondary`, `--surface-1` … `--surface-3`, `--panel-card`): навигация, контролы, карточки detail и интерактивные состояния.
- **Paper Counterpart**: светлая тема использует те же semantic roles и ту же топологию, не отдельную визуальную систему.
- **Text Ladder** (`--text`, secondary, tertiary, placeholder, disabled): приоритет информации задаётся контрастом, а не цветовой радугой.
- **Hairline Dividers** (`--border`, `--border-strong`): геометрия постоянных панелей и границы контролов.

**The Blue Means Intent Rule.** Синий обозначает действие, focus или явный выбор; он не окрашивает постоянный chrome и не подменяет типографическую иерархию.

**The One Color Source Rule.** Новый цвет сначала получает semantic role для обеих тем в `docs/design-tokens.css`; inline hex, локальные theme maps и дублирование значений запрещены.

## Typography

**Display Font:** `Inter`, затем `Segoe UI Variable`, `Segoe UI` и системные sans-serif fallbacks через `--font`.

**Body Font:** тот же Inter-first stack через `--font`.

**Label/mono font:** тот же sans-serif для UI; системный monospace используется точечно для shortcut hints и версий каталога.

**Character:** нейтральная, компактная и инженерно-точная типографика. Корневой размер приложения — `15px`; сглаживание и запрет font synthesis удерживают Inter и Segoe визуально стабильными.

### Hierarchy

- **Screen title** (semibold, `22px`, tight tracking): Profile, Settings и заголовок выбранной вакансии.
- **Emmy headline** (bold, `21px`, `28px` line-height): только welcome/offline message в dock.
- **Workspace title** (semibold, `1.125rem`, `1.5rem` line-height): заголовок локального поиска.
- **Body** (regular/medium, преимущественно `13px`, `20px` line-height): feed, description, composer и основные действия.
- **Label** (medium/semibold, `0.75rem`): controls, filters, sort и metadata.
- **Caption** (regular/medium, `11px`, `16px` line-height): company, location, salary, timeline status.
- **Micro** (regular/semibold, `10px`): status bar, counts, eyebrow labels и shortcut hints.

Числа каталога, зарплаты и счётчики используют tabular alignment. Vacancy description остаётся plain text и не получает HTML/Markdown styling.

**The Compact Type Rule.** Не добавлять marketing-scale display type: рабочий контент, а не декоративный заголовок, должен доминировать в viewport.

## Layout

Приложение занимает весь viewport с минимальной высотой `620px` и минимальной шириной `320px`. Вертикальный shell состоит из titlebar `56px`, рабочей области и status bar `24px`. На широком desktop слева постоянно стоит navigation `260px`.

Референсный первый viewport строится слева направо: navigation `260px`; search/feed; постоянный job detail; опциональный Emmy dock шириной `320px`. При открытых фильтрах перед feed появляется inline-колонка `232px`. Emmy изменяется от `316px` до `420px`, стартует с `320px` и поддерживает drag либо Arrow Left/Right по `16px`.

Search workspace использует четыре точных режима:

- **`1320px` и шире:** открытые filters занимают inline-колонку `232px`; feed и detail остаются рядом.
- **ниже `1320px`:** filters становятся overlay от левого края workspace (`260px`) шириной до `300px`, между titlebar и status bar.
- **ниже `980px`:** Emmy становится правым overlay и не уменьшает рабочие колонки.
- **ниже `900px`:** job detail становится overlay поверх workspace; при `900px` и шире он остаётся inline.
- **ниже `700px`:** navigation скрывается, offsets filters/detail сбрасываются, filters ограничены `280px`/`92vw`, Emmy занимает всю ширину, titlebar упрощается.

Базовый spatial rhythm — `4px`; фактические интервалы концентрируются на `8`, `12`, `16`, `20`, `24` и `32px`. Search field имеет высоту `40px`, основные controls — `36px`, navigation rows — `36px`, filter rows — минимум `40px`, feed rows — минимум `112px`. Scroll принадлежит содержимому каждой панели; body не скроллится. Feed, shortlist, autocomplete и Emmy timeline виртуализируются по реализованным thresholds.

**The Persistent Context Rule.** На desktop выбранная вакансия остаётся рядом с лентой; при нехватке ширины вторичные области переходят в overlays, а не сжимают feed и detail до нечитаемого состояния.

## Elevation & Depth

Постоянный shell плоский: глубину создают near-black/charcoal tones и `1px` dividers. Малый shadow локально поднимает composer и выбранный theme segment; medium shadow используется у command palette, history/autocomplete popup и панелей, которые фактически переходят в overlay. Тяжёлых теней, glass, blur и свечения нет.

### Shadow Vocabulary

- **Local lift** (`--shadow-sm`): compact floating emphasis внутри существующей панели.
- **Overlay separation** (`--shadow-md`): временный слой поверх workspace.

**The Divider Before Shadow Rule.** Сначала разделять постоянные области тоном и однопиксельной линией; shadow допустим только там, где слой действительно проходит над другим.

## Shapes

Форма сдержанно прямоугольная. Radius scale живёт рядом с цветовыми semantic tokens: small `4px`, medium `7px`, large `10px`. Fields, buttons, cards, dialogs и panels не превышают `10px`; локальные `2px` и `5px` используются только для tiny affordance и product mark. Полный круг зарезервирован для небольшого count indicator, checkbox/radio или кнопки отправки Emmy.

Границы обычно однопиксельные. Dashed line применяется в headers и честном profile empty state. Lucide icons преимущественно `16px`, с `12–14px` для micro chrome и `20px` только для более заметного marker.

**The Quiet Geometry Rule.** Не превращать рабочие области в набор больших округлых карточек; радиус обозначает affordance, а dividers удерживают структуру.

## Components

### Desktop shell and navigation

Titlebar высотой `56px` совмещает product mark, breadcrumb, compact command entry, Emmy trigger, Settings и native window controls. Brand block выровнен с navigation и имеет ту же ширину `260px`. Navigation использует neutral hover/active surfaces; синий не обязан сопровождать каждый active row. Status bar высотой `24px` держит readiness локального каталога, версию, count и keyboard hints.

### Search, filters, feed and detail

Search header содержит filters toggle, `40px` query field, accent submit, синтаксический hint, результат, snapshot metadata и segmented sort. Filters — угольная колонка с native `details/summary`, compact checkbox rows и combobox/listbox autocomplete. Active filter chips являются кнопками удаления.

Feed — border-separated list, а не сетка карточек. Вакансия и shortlist — соседние кнопки; выбранная строка получает более сильную нейтральную поверхность и border, hover — тональный сдвиг. Roving tab stop и virtual scroll сохраняют keyboard-first работу. Detail использует плоский canvas и отдельные `panel-card` sections для match, skills, description и technical data; original action остаётся самым сильным neutral CTA.

### Buttons, fields, chips and state

Основная высота кнопки — `36px`, medium radius, compact `13px` type. Варианты: dark default, blue accent, bordered outline и transparent ghost. Active press использует scale `0.97`; disabled — `50%` opacity без pointer events. Fields используют sidebar-field surface, `1px` border и visible placeholder. Глобальный focus-visible — `2px` outline с offset `2px`. Badges различают neutral, accent, positive, warning и outline roles, не создавая декоративную палитру.

### Profile, Settings and match

Profile и Settings ограничивают строку чтения (`max-width` containers), используют dashed header divider, section eyebrows и bordered rows/cards. Theme control — трёхсегментная native radio-группа System/Light/Dark. Match breakdown показывает локальные компоненты, strengths и gaps; интерфейс называет результат «совпадением», не шансом оффера.

### Emmy

Emmy — правый dock с header `48px`, layered SVG mascot, timeline, tool activity, job cards, comparison, quick replies, inline confirmation и composer. Welcome/offline state собирается снизу вверх: маскот `96px`, compact headline, краткое объяснение, затем реальные действия. Composer использует `10px` radius, strong border, local shadow и круглую send-button; offline state сохраняет композицию, но блокирует ввод и направляет в Settings.

Обычные UI transitions ограничены наблюдаемым диапазоном `140–150ms` (внутри продуктового контракта `120–160ms`) с `--ease`: background, border, color, opacity и короткий press transform. Emmy dock не получает выдуманной entrance-анимации. Более длинные движения разрешены только внутри уже реализованных SVG-состояний Emmy и skeleton/status feedback; они не становятся общим motion language. `prefers-reduced-motion` сводит transitions и animations к `1ms`, одной итерации и отключает smooth scrolling.

### Keyboard and accessibility

Все mouse paths имеют keyboard equivalent. `/`, `j/k`, `s`, `Ctrl+Enter`, `Ctrl+K`, `Ctrl+E` и numeric navigation не перехватывают editable controls вне своего контекста. Popup controls сохраняют Arrow/Home/End/Enter/Escape behavior, overlays возвращают focus, resizer имеет separator/value semantics, а loading/error/offline сообщаются через semantic roles и live regions.

**The Real State Rule.** Selection, match, shortlist, provider availability и tool activity должны отражать фактическое локальное или provider state; animation, hover и цвет не могут быть единственным носителем смысла.

## Do's and Don'ts

### Do:

- **Do** сохранять dark-first точность, near-black canvas, charcoal panels и `1px` dividers как основной визуальный характер.
- **Do** держать первый desktop viewport в топологии navigation `260px` → search/feed → persistent detail → optional Emmy `320px`.
- **Do** использовать только semantic properties из `docs/design-tokens.css` и одновременно определять обе темы.
- **Do** применять синий только к действию, focus и явному выбору; neutral selection может оставаться charcoal.
- **Do** сохранять Inter-first stack, компактный `4px` rhythm, точные shell dimensions и breakpoints `1320/980/900/700`.
- **Do** виртуализировать длинные списки и сохранять видимый focus, keyboard equivalence, live feedback и reduced-motion behavior.
- **Do** показывать реальные Profile, Shortlist, локальный match и optional Emmy; недоступный AI обозначать как offline, не блокируя каталог.

### Don't:

- **Don't** возвращать pale shell, white-card dashboard или равномерно светлую композицию как основной визуальный мир.
- **Don't** добавлять gradients, glass, blur, heavy shadows, glow или декоративную многоцветность.
- **Don't** использовать inline colors, дублировать theme values или превращать `DESIGN.md`/sidecar во второй источник значений.
- **Don't** превышать `10px` radius для структурных прямоугольных компонентов или делать основные containers pill-shaped.
- **Don't** придумывать dock transitions, idle flourishes или другие motion patterns сверх наблюдаемых `140–150ms` state transitions и реализованных состояний Emmy.
- **Don't** сжимать feed/detail при responsive переходе, рендерить vacancy text как HTML/Markdown или изображать несуществующий global match-sort.
- **Don't** позволять hover, animation или цвету быть единственным признаком selection, status или ошибки.
