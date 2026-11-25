import { useAppUiStore } from "@/app/store/appUiStore";
import { t, type AppLocale } from "@/lib/i18n";

const languageOptions: ReadonlyArray<{ code: string; locale: AppLocale }> = [
  { code: "RU", locale: "ru" },
  { code: "EN", locale: "en" },
];

function languageLabel(locale: AppLocale): string {
  return locale === "ru" ? t("languageRussian") : t("languageEnglish");
}

export function LanguageControl() {
  const language = useAppUiStore((state) => state.language);
  const setLanguage = useAppUiStore((state) => state.setLanguage);

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{t("language")}</legend>
      <div className="segmented">
        {languageOptions.map((option) => (
          <label className="segmented-option" key={option.locale}>
            <input
              aria-label={languageLabel(option.locale)}
              checked={language === option.locale}
              className="peer sr-only"
              name="app-language"
              onChange={() => setLanguage(option.locale)}
              type="radio"
              value={option.locale}
            />
            <span className="segmented-label">{languageLabel(option.locale)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
