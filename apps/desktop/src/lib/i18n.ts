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
    offlineReady: "Работает без сети",
    catalogMissing: "Каталог не найден",
    jobsFound: "вакансий в каталоге",
    selectJob: "Выберите вакансию из ленты",
    source: "Источник",
    save: "В избранное",
    saved: "Сохранено",
    openOriginal: "Открыть оригинал",
    emmyHint: "Emmy появится после локального каталога и не мешает офлайн-поиску.",
    empty: "По этому запросу ничего не найдено.",
  },
} as const;

type Locale = keyof typeof messages;
type MessageKey = keyof (typeof messages)["ru"];

const configuredLocale = productConfig.localization.uiDefaultLocale;
export const defaultLocale: Locale = configuredLocale === "ru" ? configuredLocale : "ru";

export function t(key: MessageKey, locale: Locale = defaultLocale): string {
  return messages[locale][key];
}
