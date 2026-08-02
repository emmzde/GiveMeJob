import {
  Bookmark,
  Bot,
  BriefcaseBusiness,
  Database,
  Search,
  Settings,
  UserRound,
} from "lucide-react";
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
  const setCommandPaletteOpen = useAppUiStore((state) => state.setCommandPaletteOpen);
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
    <aside className="navigation-sidebar flex w-[260px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)]">
      <div className="px-4 pb-4 pt-3">
        <button
          aria-label={t("openCommandPalette")}
          className="flex h-10 w-full items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--sidebar-field)] px-3 text-left text-xs text-[var(--text-placeholder)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
          onClick={() => setCommandPaletteOpen(true)}
          type="button"
        >
          <Search aria-hidden="true" className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{t("commandSearch")}</span>
          <span className="flex items-center gap-0.5">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      </div>

      <div className="scroll-region min-h-0 flex-1 overflow-y-auto px-4 pb-5">
        <p className="mb-2 px-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          {t("navigationPrimary")}
        </p>
        <nav aria-label={t("navigationPrimary")} className="space-y-1">
          {items.map(({ icon: Icon, key, label, shortcut }) => {
            const active = key === "emmy" ? panel === "emmy" : key === screen;
            return (
              <button
                aria-label={label}
                aria-current={key !== "emmy" && active ? "page" : undefined}
                aria-pressed={key === "emmy" ? active : undefined}
                className={cn(
                  "group flex h-9 w-full items-center gap-3 rounded-[var(--radius-md)] px-2.5 text-[13px]",
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
                    active ? "text-[var(--text)]" : "text-[var(--text-tertiary)]",
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-left font-medium">{label}</span>
                <Kbd className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                  {shortcut}
                </Kbd>
              </button>
            );
          })}
        </nav>

        <div className="mt-8">
          <p className="mb-2 px-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            {t("localCatalog")}
          </p>
          <div className="flex items-start gap-3 rounded-[var(--radius-md)] px-2.5 py-2 text-[11px] leading-4 text-[var(--text-tertiary)]">
            <Database aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{t("localFirstFootnote")}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
