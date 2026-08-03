import { Monitor, Moon, Sun } from "lucide-react";

import { useAppUiStore } from "@/app/store/appUiStore";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const themeOptions = ["system", "light", "dark"] as const;

function themeLabel(theme: (typeof themeOptions)[number]): string {
  if (theme === "light") return t("themeLight");
  if (theme === "dark") return t("themeDark");
  return t("themeSystem");
}

function ThemeIcon({ theme }: { theme: (typeof themeOptions)[number] }) {
  if (theme === "light") return <Sun aria-hidden="true" className="size-4" />;
  if (theme === "dark") return <Moon aria-hidden="true" className="size-4" />;
  return <Monitor aria-hidden="true" className="size-4" />;
}

export function ThemeControl() {
  const theme = useAppUiStore((state) => state.theme);
  const setTheme = useAppUiStore((state) => state.setTheme);

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{t("theme")}</legend>
      <div className="theme-grid grid grid-cols-3 gap-2">
        {themeOptions.map((option) => (
          <label className="min-w-0 cursor-pointer" key={option}>
            <input
              checked={theme === option}
              className="peer sr-only"
              name="app-theme"
              onChange={() => setTheme(option)}
              type="radio"
              value={option}
            />
            <span
              className={cn(
                "theme-option theme-card flex min-h-[82px] min-w-0 flex-col items-stretch rounded-[var(--radius-md)] border p-1.5 text-xs font-medium peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]",
                theme === option
                  ? "border-[var(--border-strong)] bg-[var(--panel-card)] text-[var(--text)] shadow-[var(--shadow-sm)]"
                  : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]",
              )}
            >
              <span aria-hidden="true" className="theme-preview" data-preview={option}>
                <span className="theme-preview-sidebar" />
                <span className="theme-preview-main"><i /><i /><i /></span>
              </span>
              <span className="flex items-center justify-center gap-2 px-1 py-1.5">
                <ThemeIcon theme={option} />
                <span className="truncate">{themeLabel(option)}</span>
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
