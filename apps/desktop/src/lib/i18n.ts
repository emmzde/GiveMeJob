import productConfig from "../../../../config/product.json";

const messages = {
  ru: {
    appDescription: "Локальный поиск по замороженному каталогу вакансий",
    jobs: "Вакансии",
    shortlist: "Избранное",
    profile: "Профиль",
    emmy: "Emmy",
    filters: "Фильтры",
    searchTitle: "Поиск по локальному каталогу",
    searchPlaceholder: "Роль, навык или компания",
    search: "Найти",
    allLocations: "Любая локация",
    remoteOnly: "Удалённо",
    allGrades: "Любой грейд",
    later: "позже",
    catalogChecking: "Проверяем локальный каталог",
    catalogInitializing: "Подготавливаем локальный каталог",
    catalogVerifying: "Проверяем целостность каталога",
    catalogRecovering: "Восстанавливаем каталог",
    offlineReady: "Работает без сети",
    catalogMissing: "Каталог не найден",
    catalogError: "Ошибка локального каталога",
    catalogRetry: "Повторить восстановление",
    catalogRetrying: "Восстанавливаем…",
    catalogProgress: "Прогресс подготовки каталога",
    catalogPreparingSearch: "Поиск станет доступен после подготовки каталога",
    catalogStageStarting: "Запускаем проверку каталога",
    catalogStageSeal: "Проверяем локальную seal-запись",
    catalogStageSpace: "Проверяем свободное место",
    catalogStageArchive: "Проверяем архив каталога",
    catalogStageDecompressing: "Распаковываем каталог",
    catalogStageCatalog: "Проверяем контрольную сумму каталога",
    catalogStageSqlite: "Проверяем SQLite и поисковый индекс",
    catalogStageActivating: "Устанавливаем проверенный каталог",
    catalogStageOpening: "Открываем каталог",
    catalogStageCleanup: "Завершаем установку",
    jobsFound: "вакансий в каталоге",
    resultsLoading: "Загружаем вакансии",
    resultsFound: "результатов",
    initialSearchError: "Не удалось загрузить вакансии из локального каталога.",
    submitSearchError: "Не удалось выполнить поиск. Ранее загруженные результаты сохранены.",
    selectJob: "Выберите вакансию из ленты",
    detailLoadError: "Не удалось загрузить локальную карточку вакансии.",
    source: "Источник",
    attribution: "Атрибуция",
    snapshotVersion: "Версия снимка",
    skills: "Навыки",
    description: "Описание",
    openOriginal: "Открыть оригинал",
    openingOriginal: "Открываем…",
    originalLinkShortcut: "Откроется в системном браузере. Быстрая клавиша: Ctrl+Enter.",
    originalOpenError: "Не удалось открыть оригинал. Локальная карточка остаётся доступной.",
    emmyHint: "Emmy появится после локального каталога и не мешает офлайн-поиску.",
    empty: "По этому запросу ничего не найдено.",
    unexpectedErrorTitle: "Интерфейс не смог продолжить работу",
    unexpectedErrorDescription: "Перезапустите приложение. Локальные данные не были изменены.",
  },
} as const;

type Locale = keyof typeof messages;
type MessageKey = keyof (typeof messages)["ru"];

const configuredLocale = productConfig.localization.uiDefaultLocale;
export const defaultLocale: Locale = configuredLocale === "ru" ? configuredLocale : "ru";

export function t(key: MessageKey, locale: Locale = defaultLocale): string {
  return messages[locale][key];
}
