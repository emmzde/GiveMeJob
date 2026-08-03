import {
  Bookmark,
  Bot,
  BriefcaseBusiness,
  MessageSquareText,
  Search,
  Settings,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RefObject } from "react";

import type { AppScreen } from "@/app/store/appUiStore";
import { useAppUiStore } from "@/app/store/appUiStore";
import { t } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n";
import { openSupportLink } from "@/lib/support";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: LucideIcon;
  key: "search" | "shortlist" | "profile" | "emmy" | "settings";
  labelKey: MessageKey;
}

const items: readonly NavItem[] = [
  { key: "search", labelKey: "jobs", icon: BriefcaseBusiness },
  { key: "shortlist", labelKey: "shortlist", icon: Bookmark },
  { key: "profile", labelKey: "profile", icon: UserRound },
  { key: "emmy", labelKey: "emmy", icon: Bot },
  { key: "settings", labelKey: "settings", icon: Settings },
];

export function NavigationSidebar({
  commandTriggerRef,
}: {
  commandTriggerRef?: RefObject<HTMLButtonElement | null>;
}) {
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
    <aside className="navigation-sidebar flex w-[var(--sidebar-width)] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)]">
      <div className="px-3 pb-4 pt-3">
        <button
          aria-label={t("openCommandPalette")}
          className="flex h-[30px] w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--sidebar-field)] px-2.5 text-left text-[12px] text-[var(--text-placeholder)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] active:scale-[0.99]"
          onClick={() => setCommandPaletteOpen(true)}
          ref={commandTriggerRef}
          type="button"
        >
          <Search aria-hidden="true" className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{t("commandSearch")}</span>
        </button>
      </div>

      <div className="scroll-region min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <p className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          {t("navigationPrimary")}
        </p>
        <nav aria-label={t("navigationPrimary")} className="space-y-0.5">
          {items.map(({ icon: Icon, key, labelKey }) => {
            const active = key !== "emmy" && key === screen;
            const pressed = key === "emmy" && panel === "emmy";
            const label = t(labelKey);
            return (
              <button
                aria-label={label}
                aria-current={key !== "emmy" && active ? "page" : undefined}
                aria-pressed={key === "emmy" ? pressed : undefined}
                className={cn(
                  "group flex h-[30px] w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-[12px] active:scale-[0.99]",
                  active
                    ? "bg-[var(--surface-active)] text-[var(--text)]"
                    : pressed
                      ? "text-[var(--text)] hover:bg-[var(--surface-hover)]"
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
                    active || pressed ? "text-[var(--text)]" : "text-[var(--text-tertiary)]",
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-left font-normal">{label}</span>
              </button>
            );
          })}
        </nav>

      </div>
      <div className="shrink-0 px-3 pb-4 pt-2">
        <p className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          {t("supportSection")}
        </p>
        <nav aria-label={t("supportSection")} className="space-y-0.5">
          <button
            className="group flex h-[30px] w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] active:scale-[0.99]"
            onClick={() => void openSupportLink("feedback").catch(() => undefined)}
            type="button"
          >
            <MessageSquareText aria-hidden="true" className="size-4 shrink-0 text-[var(--text-tertiary)] group-hover:text-[var(--text)]" />
            <span className="min-w-0 flex-1 truncate text-left">{t("feedback")}</span>
          </button>
          <button
            className="group flex h-[30px] w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] active:scale-[0.99]"
            onClick={() => void openSupportLink("github").catch(() => undefined)}
            type="button"
          >
            <svg aria-hidden="true" className="size-4 shrink-0 text-[var(--text-tertiary)] group-hover:text-[var(--text)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.69c-2.78.61-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 7c.85 0 1.71.11 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85V21c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
            </svg>
            <span className="min-w-0 flex-1 truncate text-left">{t("githubAuthor")}</span>
          </button>
        </nav>
      </div>
    </aside>
  );
}
