---
name: GiveMeJob!
description: Dark-first precision workbench for local Windows job search, match, shortlist, and optional Emmy assistance.
colors:
  canvas: "var(--bg)"
  canvas-secondary: "var(--bg-secondary)"
  raised: "var(--bg-raised)"
  sidebar: "var(--sidebar)"
  sidebar-field: "var(--sidebar-field)"
  panel-frame: "var(--panel-frame)"
  panel-card: "var(--panel-card)"
  surface-control: "var(--surface-2)"
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
  brand:
    fontFamily: "var(--font-brand)"
    fontSize: "15.5px"
    fontWeight: 560
    lineHeight: 1
    letterSpacing: "-0.055em"
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
  screen-title:
    fontFamily: "var(--font)"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.167
    letterSpacing: "-0.03em"
  detail-title:
    fontFamily: "var(--font)"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
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
  button-primary:
    backgroundColor: "{colors.text}"
    textColor: "{colors.canvas}"
    typography: "{typography.label}"
    rounded: "{rounded.medium}"
    padding: "0 12px"
    height: "32px"
  button-outline:
    backgroundColor: "{colors.panel-card}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.medium}"
    padding: "0 12px"
    height: "32px"
  field:
    backgroundColor: "{colors.sidebar-field}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.medium}"
    padding: "0 10px"
    height: "32px"
  search-field:
    backgroundColor: "{colors.sidebar-field}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.medium}"
    padding: "0 12px"
    height: "32px"
  navigation-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.medium}"
    padding: "0 10px"
    height: "30px"
  dashboard-panel:
    backgroundColor: "{colors.surface-active}"
    textColor: "{colors.text}"
    rounded: "{rounded.large}"
    padding: "0 2px 2px"
  emmy-composer:
    backgroundColor: "{colors.surface-control}"
    textColor: "{colors.text}"
    rounded: "{rounded.medium}"
    padding: "10px 12px 8px"
    height: "96px"
---

# Design System: GiveMeJob!

## Overview

**Creative North Star: "Точный локальный рабочий стол"**

GiveMeJob! — плотный локальный workbench для Windows. Поставленная Kravio-style адаптация берёт у dashboard-референса полный визуальный язык — угольные поверхности, компактные header strips, inset bodies, hairline borders и строгие neutral buttons — но не копирует графики, таблицы или чужую analytics IA. Поиск, лента вакансий, detail и опциональная Emmy остаются product-native частями одного точного инструмента.

Визуальная история следует реальному продукту: пользователь ищет в локальном каталоге, видит объяснимое совпадение, сохраняет вакансию и при желании подключает Emmy. AI остаётся дополнительным dock, а не центром композиции; offline-состояние не меняет иерархию каталога. Светлая тема реализована на той же семантической модели, но не возвращает систему к прежней бледной shell-эстетике.

Design seed `0c99543c` фиксирует происхождение нового мира и поставленный desktop dashboard как визуальный ориентир. `PRODUCT.md` объясняет назначение и честные ограничения продукта; `AGENTS.md` и документы scope остаются выше этого визуального контракта.

**Key Characteristics:**

- Плотный dark-first desktop workbench с shell `236px / 50px / 0px` и угольными поверхностями.
- Иерархичный search overview: текущий результат доминирует, полный каталог даёт контекст, число загруженных строк остаётся служебным.
- Product-native vacancy feed rows вместо analytics-table, grid chrome или чужой информационной архитектуры.
- Self-hosted Inter Variable через `@fontsource-variable/inter`; Segoe используется только как fallback.
- Сгенерированный маршрут к открытой позиции — фирменный знак без контейнера; wordmark набран self-hosted Manrope Variable с усилением `Job!`.
- Neutral white/inverse primary controls; синий зарезервирован для focus и ограниченных explicit semantic states.
- Постоянный detail rail `340px` и опциональный Emmy dock `440px` без четвёртой сжатой колонки.
- Реальные loading, empty, error, offline и disabled-состояния без демонстрационных подмен.

**The Local Truth Rule.** Каталог, совпадение и сохранение должны оставаться визуально полноценным продуктом без Emmy и без сети.

## Colors

Единственный документированный источник значений цветов — `docs/design-tokens.css`. Frontmatter и sidecar только ссылаются на его semantic custom properties; runtime-файл `apps/desktop/src/styles/tokens.css` импортирует тот же источник.

### Primary

- **Neutral Inverse Action** (`--text` на `--bg`): primary/default CTA, поиск, открытие оригинала и выбранный sort segment. В dark theme это светлая кнопка на тёмном canvas; в light theme — тёмная на светлом.
- **Emmy Focus Blue** (`--accent`, `--focus`; в dark theme `#2589E8`): keyboard focus, focus-within composer и только те explicit semantic states, которые реализованы как native accent или compact count. В покое composer остаётся нейтральным.

### Secondary

- **Semantic Status** (`--positive`, `--warning`, `--danger` и связанные muted/border/on roles): готовность локального каталога, предупреждения, ошибки и destructive window state.
- **Emmy Signature** (`--emmy-*`): тёплая оранжевая шерсть, кремовые грудь и морда, тёмно-коричневый пиксельный контур и редкий синий semantic accent SVG-маскота. В dark theme тепло персонажа сохраняется, чтобы Emmy оставалась узнаваемой. Эта палитра принадлежит только Emmy.

### Neutral

- **Near-Black Canvas** (`--bg`, `--surface-0`): базовое dark-first поле приложения.
- **Charcoal Structure** (`--sidebar`, `--bg-secondary`, `--surface-1` … `--surface-3`, `--panel-card`): навигация, контролы, карточки detail и интерактивные состояния.
- **Paper Counterpart**: светлая тема использует те же semantic roles и ту же топологию, не отдельную визуальную систему.
- **Text Ladder** (`--text`, secondary, tertiary, placeholder, disabled): приоритет информации задаётся контрастом, а не цветовой радугой.
- **Hairline Dividers** (`--border`, `--border-strong`): геометрия постоянных панелей и границы контролов.

**The Blue Means Focus Rule.** Синий не является постоянным цветом primary button, selected sort, match-score или рамки Emmy. Он появляется при visible focus и в ограниченных explicit semantic states.

**The Neutral Commitment Rule.** Primary/default CTA и выбранный segmented control используют контрастную пару `--text` / `--bg`, а не accent blue.

**The One Color Source Rule.** Новый цвет сначала получает semantic role для обеих тем в `docs/design-tokens.css`; inline hex, локальные theme maps и дублирование значений запрещены.

## Typography

**Display Font:** bundled `Inter Variable` из `@fontsource-variable/inter`, затем `Inter`, `Segoe UI Variable`, `Segoe UI` и системные sans-serif fallbacks через `--font`.

**Body Font:** тот же Inter-first stack через `--font`.

**Brand Font:** bundled `Manrope Variable` из `@fontsource-variable/manrope` через `--font-brand`. Wordmark использует вес `560`, а смысловая часть `Job!` — `780`; это фирменная подпись, не новый body-font.

**Label/mono font:** основной UI остаётся sans-serif; `--font-mono` (`Cascadia Code` → `SFMono-Regular` → `Consolas`) органично выделяет KPI, зарплаты, даты, match-score и индексы Emmy.

**Character:** нейтральная, компактная и инженерно-точная типографика. Inter Variable и фирменный Manrope Variable self-hosted внутри приложения и не требуют сети; Segoe — только системный fallback. Корневой размер — `15px`, сглаживание и запрет font synthesis удерживают метрики стабильными.

### Hierarchy

- **Screen title** (regular, `24px`, `28px` line-height, `-0.03em`): Search, Shortlist, Profile и Settings; это спокойный workspace heading, не marketing display.
- **Emmy headline** (bold, `18px`, `24px` line-height): welcome message в dock; offline сохраняет более крупный аварийный акцент.
- **Detail title** (semibold, `18px`, `1.25` line-height, `-0.02em`): название выбранной вакансии в фиксированном rail.
- **Metric** (mono): главный результат `36px/650`; полный каталог `24.8px/520`; загруженное число `21.6px/500`. Размер и контраст следуют продуктовой важности.
- **Body** (regular/medium, преимущественно `13px`, `20px` line-height): feed, description, composer и основные действия.
- **Label** (medium/semibold, `0.75rem`): controls, filters, sort и metadata.
- **Caption** (regular/medium, `11px`, `16px` line-height): company, location, salary, timeline status.
- **Micro** (regular/semibold, `10px`): counts, eyebrow labels, dates и служебные состояния.

Числа каталога, зарплаты и счётчики используют tabular alignment. Vacancy description остаётся plain text и не получает HTML/Markdown styling.

**The Compact Type Rule.** Не добавлять marketing-scale display type: рабочий контент, а не декоративный заголовок, должен доминировать в viewport.

## Layout

Приложение занимает весь viewport с минимальной высотой `620px` и шириной `320px`. Shell состоит из titlebar `50px` и единственной рабочей области; visible status bar отсутствует (`--statusbar-height: 0px`). Постоянная navigation имеет ширину `236px`.

SearchScreen использует единый overview-frame минимум `112px` с пропорциями `1.4fr / 1fr / 0.72fr`. Первый сегмент — текущий результат с `2px` neutral top rule и самым крупным mono-числом; второй — контекст полного каталога; третий — тихий служебный счётчик загруженных строк. Results panel сохраняет header strip минимум `38px` и inset body с отступом `0 2px 2px`. Внутри остаются реальный search form, filters, sort и product-native vacancy rows — без sticky table header, table grid или analytics columns.

Рабочая сетка и responsive-переходы следуют текущему CSS точно:

- **`>=1320px`:** открытые filters — inline `224px`; workbench — `minmax(420px, 1fr)`; видимый detail — фиксированный rail `340px`.
- **`<=1319px`:** filters становятся fixed overlay от `left: 236px`, шириной `min(300px, viewport - 236px)`, между titlebar и нижним краем; только этот overlay получает `--shadow-md`.
- **`>=900px`:** видимый detail остаётся inline `340px`.
- **`<=899px`:** detail становится fixed overlay от `left: 236px` без дополнительной card shadow.
- **`<=1279px`:** Emmy становится fixed right overlay между titlebar и нижним краем, с `max-width: viewport - 236px`.
- **`<=699px`:** navigation скрывается; titlebar упрощается; filters и detail начинаются от `left: 0`; filters ограничены `min(280px, 92vw)`; Emmy занимает весь viewport и теряет resizer.
- **Feed container `<=520px`:** вторичная metadata скрывается, row minimum меняется с `86px` на `76px`, а текстовый label match badge скрывается.

Emmy dock стартует с `440px`, ограничен диапазоном `400–480px` и меняется drag-жестом либо Arrow Left/Right по `16px`. Базовый spatial rhythm — `4px`; controls и shared buttons — `32px`, navigation/search command rows — `30px`, filter rows — минимум `40px`. Vacancy feed использует virtualizer estimate `86px`, а не отдельный фиксированный table-row component. Scroll принадлежит содержимому панелей; body не скроллится.

**The Persistent Context Rule.** На desktop выбранная вакансия остаётся рядом с лентой; при нехватке ширины вторичные области переходят в overlays, а не сжимают feed и detail до нечитаемого состояния.

## Elevation & Depth

Постоянный shell, overview, feed rows, detail и Emmy composer плоские: `--shadow-sm` равен `none`. Глубину создают near-black/charcoal tones и границы структурных областей. Обычная строка вакансии не имеет видимой рамки; strong border появляется только у выбранной строки. `--shadow-md` появляется только на реально плавающих слоях — command/history popovers и overlay filters. Detail и Emmy overlay не получают выдуманную card shadow. Тяжёлых теней, glass, blur, glow и градиентов нет.

### Shadow Vocabulary

- **Flat rest** (`--shadow-sm: none`): обычные cards, dashboard frames, selected rows, buttons и composer.
- **Overlay separation** (`--shadow-md`): только реализованный floating popup или filters overlay поверх workspace.

**The Divider Before Shadow Rule.** Сначала разделять постоянные области тоном и однопиксельной линией; shadow допустим только там, где слой действительно проходит над другим.

## Shapes

Форма сдержанно прямоугольная. Radius scale живёт рядом с цветовыми semantic tokens: small `4px`, medium `7px`, large `10px`. Fields, buttons, cards, dialogs и panels не превышают `10px`; локальные `2px` и `5px` используются только для tiny affordance и product mark. Полный круг зарезервирован для небольшого count indicator и checkbox/radio; кнопка отправки Emmy использует medium radius.

Границы обычно однопиксельные. Dashed line применяется в headers и честном profile empty state. Lucide icons преимущественно `16px`, с `12–14px` для micro chrome и `20px` только для более заметного marker.

**The Quiet Geometry Rule.** Не превращать рабочие области в набор больших округлых карточек; радиус обозначает affordance, а dividers удерживают структуру.

## Components

### Desktop shell and navigation

Titlebar высотой `50px` совмещает product mark, breadcrumb, Emmy trigger, Settings и native window controls. Brand block выровнен с navigation и имеет ту же ширину `236px`. Sidebar command и nav rows имеют высоту `30px`; active navigation использует neutral `--surface-active`. Visible status bar отсутствует.

### Search, filters, feed and detail

Search dashboard начинается с `24px` regular heading и единого иерархичного overview: текущий результат расположен первым и визуально доминирует, полный каталог даёт контекст, загруженное число остаётся второстепенным. Query field, filter toggle, submit и shared controls имеют высоту `32px`; submit — neutral inverse. Selected sort segment тоже neutral inverse. Filters — inline `224px` на широком desktop и overlay по точным breakpoint rules; ActiveFilterChips являются кнопками удаления.

Feed — product-native вертикальная лента без sticky header, table grid, карточных рамок на каждой строке и аналитических колонок. Базовая строка имеет minimum `86px`: semibold title, medium company, tertiary metadata и отдельный `32px` shortlist action. Поскольку snapshot не содержит настоящих brand assets, интерфейс не синтезирует «логотипы» из первых букв и не подменяет их generic company-иконками; название компании остаётся честным текстовым идентификатором. Зарплата и дата используют mono. В покое строка имеет transparent border; выбранная строка получает neutral surface и единственный strong border, hover — только тональный сдвиг. Match-score имеет четыре тона: strong `>=70`, medium `>=40`, weak `>=25`, low `<25`; low нейтрален и не конкурирует оранжевым с более релевантным результатом. При container `<=520px` metadata скрывается, а minimum становится `76px`. Detail — фиксированный `340px` rail с плоскими разделёнными секциями; original action остаётся самым сильным neutral CTA.

### Buttons, fields, chips and state

Основная высота shared button — `32px`, medium radius, `12px` medium type. `default` и legacy-named `accent` в текущем Button оба рендерятся как neutral inverse (`--text` на `--bg`); outline и ghost остаются нейтральными. Active press использует scale `0.97`; disabled — `50%` opacity. Search field и form controls также `32px`, с `1px` border. Global focus-visible — `2px` outline с offset `2px`. Filter count, native checkbox accent и `New` badge могут использовать blue как explicit semantic state, но не превращают его в primary button color.

### Profile, Settings and match

Profile, Shortlist и Settings используют единый `workspace-frame`: спокойный `24px` title в `72px` header strip, один внешний hairline и плоское содержимое с разделителями вместо сетки одинаковых карточек. Settings имеет реальный двухколоночный layout `176px / content`; на узком окне внутренняя навигация превращается в горизонтальный rail. Каталог показан как компактный data-list, а Emmy providers — как фактический последовательный fallback route `01–04`; нумерация разрешена здесь именно потому, что порядок исполнения имеет смысл. Profile использует строки `176px / value` для просмотра и редактирования, Shortlist — непрерывную журнальную ленту без синтетических company-monograms. Theme control остаётся трёхсегментной native radio-группой System/Light/Dark. Match breakdown показывает локальные компоненты, strengths и gaps; интерфейс называет результат «совпадением», не шансом оффера.

### Emmy

Emmy — правый dock с header `48px`, code-native layered pixel SVG mascot, timeline, tool activity, job cards, comparison, quick replies, inline confirmation и composer. Визуальный identity-anchor хранится в `apps/desktop/public/brand/emmy-pixel-anchor.png`, но runtime-персонаж собран из независимых SVG-слоёв с `crispEdges`, поэтому глаза, уши, голова и хвост следуют настоящему состоянию agent loop. Пока dock открыт, зрачки следуют за курсором; интерактивную Emmy можно погладить ЛКМ либо клавишами Enter/Space. Поглаживание временно накладывает добрую bliss-эмоцию поверх любого agent-state, не меняя его. При клавиатурном фокусе используются пиксельные сердечки, а не прямоугольная focus-рамка. Новая беседа строится как часть vacancy workbench: маскот ведёт к headline `18/24px` и четырём вертикальным starter-командам с разными смысловыми иконками, без нумерации, карточной сетки и поясняющего микротекста. Во время agent turn монохромный SVG-trace заменяет generic sparkle/spinner. Только новый ответ последовательно раскрывается за ограниченные `0.5–1.1s`; история появляется сразу, structured cards и quick replies мягко входят после текста. Composer имеет минимум `96px`, `7px` radius и нейтральную `1px` strong border в покое; синий появляется только при focus-within. Нижняя command strip содержит квадратный send action `32px`, textarea имеет минимум `40px`. Offline state сохраняет композицию, блокирует ввод и направляет в Settings.

Обычные UI transitions ограничены диапазоном `120–160ms` с `--ease`. Движение следует геометрии: Emmy dock раскрывается и закрывается справа с одновременным изменением ширины; filters приходят слева, detail — справа; основные screens используют вертикальный fade `4px`; command/history layers — малый scale-in. Search overview и results получают только один короткий staged entrance при активации экрана, а виртуализированные vacancy rows не анимируются. Более длинные движения разрешены только внутри SVG-состояний Emmy, реакции на поглаживание и skeleton/status feedback. `prefers-reduced-motion` сводит transitions и animations к `1ms`, одной итерации, отключает smooth scrolling и фиксирует зрачки по центру.

### Keyboard and accessibility

Все mouse paths имеют keyboard equivalent. `/`, `j/k`, `s`, `Ctrl+Enter`, `Ctrl+K`, `Ctrl+E` и numeric navigation не перехватывают editable controls вне своего контекста, но их сочетания не выводятся в постоянный интерфейс и command palette. Popup controls сохраняют Arrow/Home/End/Enter/Escape behavior, overlays возвращают focus, resizer имеет separator/value semantics, а loading/error/offline сообщаются через semantic roles и live regions.

**The Real State Rule.** Selection, match, shortlist, provider availability и tool activity должны отражать фактическое локальное или provider state; animation, hover и цвет не могут быть единственным носителем смысла.

## Do's and Don'ts

### Do:

- **Do** сохранять dark-first точность, near-black canvas, charcoal panels и `1px` dividers как основной визуальный характер.
- **Do** держать shell в топологии navigation `236px` → nested search dashboard/product-native feed → detail rail `340px` либо Emmy `440px`.
- **Do** использовать только semantic properties из `docs/design-tokens.css` и одновременно определять обе темы.
- **Do** использовать neutral inverse для primary/default CTA и selected sort; blue оставлять focus и реализованным explicit semantic states.
- **Do** сохранять bundled Inter Variable, компактный `4px` rhythm и точные media thresholds `1320/1319/1279/900/899/699` плюс feed container query `520px`.
- **Do** давать главному KPI явный приоритет размером, позицией и контрастом; вторичные значения оставлять контекстом.
- **Do** виртуализировать длинные списки и сохранять видимый focus, keyboard equivalence, live feedback и reduced-motion behavior.
- **Do** показывать реальные Profile, Shortlist, локальный match и optional Emmy; недоступный AI обозначать как offline, не блокируя каталог.

### Don't:

- **Don't** возвращать pale shell, white-card dashboard или равномерно светлую композицию как основной визуальный мир.
- **Don't** добавлять gradients, glass, blur, heavy shadows, glow или декоративную многоцветность.
- **Don't** добавлять обычные card/composer shadows: `--shadow-sm` остаётся `none`, а `--shadow-md` принадлежит только реально плавающим слоям.
- **Don't** давать всем KPI одинаковый card weight, рисовать видимую рамку вокруг каждой вакансии или окрашивать все низкие match-score одним warning-цветом.
- **Don't** выдавать первую букву компании или generic building glyph за её логотип, если в каталоге нет настоящего brand asset.
- **Don't** возвращать Emmy к permanent blue frame и четырём равновесным icon-menu actions.
- **Don't** использовать inline colors, дублировать theme values или превращать `DESIGN.md`/sidecar во второй источник значений.
- **Don't** превышать `10px` radius для структурных прямоугольных компонентов или делать основные containers pill-shaped.
- **Don't** превращать blue `#2589E8` в primary button или selected-sort fill и не возвращать stale `Accent Button` primitive.
- **Don't** добавлять sticky table header, table grid, аналитические columns или фиксированный `76px` desktop row; базовый feed estimate — `86px`, а `76px` применяется только в compact container mode.
- **Don't** анимировать каждую строку виртуализированной ленты, добавлять пружины, overshoot или разнонаправленные декоративные flourishes; motion обязан объяснять появление конкретной панели или состояния.
- **Don't** сжимать feed/detail при responsive переходе, рендерить vacancy text как HTML/Markdown или изображать несуществующий global match-sort.
- **Don't** позволять hover, animation или цвету быть единственным признаком selection, status или ошибки.
