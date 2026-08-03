import { useAppUiStore } from "@/app/store/appUiStore";
import { t, type AppLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
      <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-md)] bg-[var(--surface-2)] p-1">
        {languageOptions.map((option) => (
          <label className="min-w-0 cursor-pointer" key={option.locale}>
            <input
              aria-label={languageLabel(option.locale)}
              checked={language === option.locale}
              className="peer sr-only"
              name="app-language"
              onChange={() => setLanguage(option.locale)}
              type="radio"
              value={option.locale}
            />
            <span
              className={cn(
                "theme-option flex h-9 min-w-0 items-center justify-center gap-2.5 rounded-[var(--radius-sm)] border px-3 text-xs font-medium peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]",
                language === option.locale
                  ? "border-[var(--border-strong)] bg-[var(--panel-card)] text-[var(--text)] shadow-[var(--shadow-sm)]"
                  : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]",
              )}
            >
              <span className="ui-mono text-[10px] text-[var(--text-tertiary)]">{option.code}</span>
              <span className="truncate">{languageLabel(option.locale)}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
