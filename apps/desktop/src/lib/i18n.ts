import productConfig from "../../../../config/product.json";

const messages = {
  ru: {
    phase: "Фаза 0",
    foundationEyebrow: "Фундамент проекта",
    foundationTitle: "Всё готово, чтобы начать собирать живые вакансии.",
    foundationDescription:
      "Первый технический срез соединяет инфраструктуру, API и десктопный клиент. Продуктовые функции появятся только после прохождения критериев каждой фазы.",
    postgresTitle: "PostgreSQL + pgvector",
    postgresDescription: "Единая схема данных и миграции Alembic.",
    apiTitle: "FastAPI",
    apiDescription: "Типизированный API, health-check и структурные логи.",
    desktopTitle: "Tauri v2",
    desktopDescription: "React 19, TypeScript и общие дизайн-токены.",
    continueToData: "Перейти к данным",
  },
} as const;

type Locale = keyof typeof messages;
type MessageKey = keyof (typeof messages)["ru"];

const configuredLocale = productConfig.localization.uiDefaultLocale;
export const defaultLocale: Locale = configuredLocale === "ru" ? configuredLocale : "ru";

export function t(key: MessageKey, locale: Locale = defaultLocale): string {
  return messages[locale][key];
}
