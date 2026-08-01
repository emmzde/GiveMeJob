import { Bookmark, Bot, BriefcaseBusiness, Settings, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { AppScreen } from "@/app/store/appUiStore";
import { useAppUiStore } from "@/app/store/appUiStore";
import { Kbd } from "@/components/ui/kbd";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: LucideIcon;
  key: "search" | "shortlist" | "profile" | "emmy" | "settings";
  label: string;
  shortcut: string;
}

const items: readonly NavItem[] = [
  { key: "search", label: t("jobs"), icon: BriefcaseBusiness, shortcut: "1" },
  { key: "shortlist", label: t("shortlist"), icon: Bookmark, shortcut: "2" },
  { key: "profile", label: t("profile"), icon: UserRound, shortcut: "3" },
  { key: "emmy", label: t("emmy"), icon: Bot, shortcut: "4" },
  { key: "settings", label: t("settings"), icon: Settings, shortcut: "5" },
];

export function NavigationSidebar() {
  const panel = useAppUiStore((state) => state.panel);
  const screen = useAppUiStore((state) => state.screen);
  const selectedId = useAppUiStore((state) => state.selectedId);
  const setPanel = useAppUiStore((state) => state.setPanel);
  const setScreen = useAppUiStore((state) => state.setScreen);

  function select(key: NavItem["key"]): void {
    if (key === "emmy") {
      setPanel(panel === "emmy" ? (selectedId ? "job_detail" : null) : "emmy");
      return;
    }
    setScreen(key satisfies AppScreen);
  }

  return (
    <aside className="navigation-sidebar flex w-44 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface-0)]">
      <nav aria-label={t("navigationPrimary")} className="space-y-0.5 p-2">
        {items.map(({ icon: Icon, key, label, shortcut }) => {
          const active = key === "emmy" ? panel === "emmy" : key === screen;
          return (
            <button
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-8 w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2 text-xs",
                active
                  ? "bg-[var(--surface-active)] text-[var(--text)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]",
              )}
              key={key}
              onClick={() => select(key)}
              type="button"
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  "size-4 shrink-0",
                  active ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]",
                )}
              />
              <span className="min-w-0 flex-1 truncate text-left font-medium">{label}</span>
              <Kbd className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">{shortcut}</Kbd>
            </button>
          );
        })}
      </nav>
      <p className="mt-auto border-t border-[var(--border)] p-3 text-[10px] leading-relaxed text-[var(--text-tertiary)]">
        {t("localFirstFootnote")}
      </p>
    </aside>
  );
}
