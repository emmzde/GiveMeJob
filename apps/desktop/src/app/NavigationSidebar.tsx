import { Bookmark, BriefcaseBusiness, MessageSquareText, Settings, Sparkles, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

const groups: readonly (readonly NavItem[])[] = [
  [
    { key: "search", labelKey: "jobs", icon: BriefcaseBusiness },
    { key: "shortlist", labelKey: "shortlist", icon: Bookmark },
    { key: "profile", labelKey: "profile", icon: UserRound },
  ],
  [
    { key: "emmy", labelKey: "emmy", icon: Sparkles },
    { key: "settings", labelKey: "settings", icon: Settings },
  ],
];

function GithubGlyph() {
  return (
    <svg aria-hidden="true" className="size-[18px] shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.69c-2.78.61-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 7c.85 0 1.71.11 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85V21c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

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
    <aside className="navigation-sidebar">
      <nav aria-label={t("navigationPrimary")} className="sidebar-nav scroll-region">
        {groups.map((group, groupIndex) => (
          <div className="sidebar-group" key={groupIndex}>
            {group.map(({ icon: Icon, key, labelKey }) => {
              const active = key !== "emmy" && key === screen;
              const pressed = key === "emmy" && panel === "emmy";
              const label = t(labelKey);
              return (
                <button
                  aria-current={key !== "emmy" && active ? "page" : undefined}
                  aria-label={label}
                  aria-pressed={key === "emmy" ? pressed : undefined}
                  className={cn("sidebar-nav-item", (active || pressed) && "is-active")}
                  key={key}
                  onClick={() => select(key)}
                  type="button"
                >
                  <Icon aria-hidden="true" className="size-[18px] shrink-0" />
                  <span className="sidebar-nav-label">{label}</span>
                  {active || pressed ? <span aria-hidden="true" className="sidebar-nav-dot" /> : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <nav aria-label={t("supportSection")} className="sidebar-group sidebar-support">
        <button
          className="sidebar-nav-item"
          onClick={() => void openSupportLink("feedback").catch(() => undefined)}
          type="button"
        >
          <MessageSquareText aria-hidden="true" className="size-[18px] shrink-0" />
          <span className="sidebar-nav-label">{t("feedback")}</span>
        </button>
        <button
          className="sidebar-nav-item"
          onClick={() => void openSupportLink("github").catch(() => undefined)}
          type="button"
        >
          <GithubGlyph />
          <span className="sidebar-nav-label">{t("githubAuthor")}</span>
        </button>
      </nav>
    </aside>
  );
}
