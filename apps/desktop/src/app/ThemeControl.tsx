import { Monitor, Moon, Sun } from "lucide-react";
import type { ChangeEvent } from "react";

import { useAppUiStore } from "@/app/store/appUiStore";
import { isAppTheme } from "@/app/theme";
import { t } from "@/lib/i18n";

function ThemeIcon({ theme }: { theme: "system" | "light" | "dark" }) {
  if (theme === "light") return <Sun aria-hidden="true" className="size-4" />;
  if (theme === "dark") return <Moon aria-hidden="true" className="size-4" />;
  return <Monitor aria-hidden="true" className="size-4" />;
}

export function ThemeControl() {
  const theme = useAppUiStore((state) => state.theme);
  const setTheme = useAppUiStore((state) => state.setTheme);

  function changeTheme(event: ChangeEvent<HTMLSelectElement>): void {
    if (isAppTheme(event.target.value)) setTheme(event.target.value);
  }

  return (
    <label className="inline-flex min-h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-raised)] px-2 text-xs text-[var(--text-secondary)]">
      <ThemeIcon theme={theme} />
      <span className="sr-only">{t("theme")}</span>
      <select
        aria-label={t("theme")}
        className="max-w-24 bg-transparent text-xs text-[var(--text)]"
        onChange={changeTheme}
        value={theme}
      >
        <option value="system">{t("themeSystem")}</option>
        <option value="light">{t("themeLight")}</option>
        <option value="dark">{t("themeDark")}</option>
      </select>
    </label>
  );
}
