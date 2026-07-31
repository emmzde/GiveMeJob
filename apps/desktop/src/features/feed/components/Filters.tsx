import { Bot, BriefcaseBusiness, SlidersHorizontal, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useAppUiStore } from "@/app/store/appUiStore";
import type { SearchDraft } from "@/features/feed/searchDraft";
import { t } from "@/lib/i18n";

interface FiltersProps {
  draft: SearchDraft;
  onChange(draft: SearchDraft): void;
}

const futureNavigationItems: ReadonlyArray<{ icon: LucideIcon; label: string }> = [
  { icon: UserRound, label: t("profile") },
  { icon: Bot, label: t("emmy") },
];

export function Filters({ draft, onChange }: FiltersProps) {
  const screen = useAppUiStore((state) => state.screen);
  const remoteOnly = draft.remoteModes.includes("remote");

  return (
    <aside className="border-r border-[var(--border)] bg-[var(--bg-secondary)] p-3">
      <nav aria-label="Основная навигация" className="space-y-1">
        <div
          aria-current={screen === "search" ? "page" : undefined}
          className="flex w-full items-center gap-2 rounded-[var(--radius-md)] bg-[var(--bg-active)] px-2.5 py-2 text-left text-sm font-medium"
        >
          <BriefcaseBusiness aria-hidden="true" className="size-4" />
          {t("jobs")}
        </div>
        {futureNavigationItems.map(({ icon: Icon, label }) => (
          <button
            aria-label={`${label} — ${t("later")}`}
            className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-sm text-[var(--text-secondary)] disabled:opacity-70"
            disabled
            key={label}
            type="button"
          >
            <Icon aria-hidden="true" className="size-4" />
            <span>{label}</span>
            <span className="ml-auto text-[10px] uppercase tracking-wide">{t("later")}</span>
          </button>
        ))}
      </nav>

      <div className="mt-8 border-t border-[var(--border)] pt-4">
        <p className="flex items-center gap-2 px-2 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          {t("filters")}
        </p>
        <div className="mt-3 space-y-2">
          <button
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-2 text-left text-xs text-[var(--text-secondary)] disabled:opacity-70"
            disabled
            type="button"
          >
            {t("allLocations")}
          </button>
          <button
            aria-pressed={remoteOnly}
            className={`w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-left text-xs focus-visible:outline-2 focus-visible:outline-offset-2 ${
              remoteOnly
                ? "border-[var(--text)] bg-[var(--bg-active)] text-[var(--text)]"
                : "border-[var(--border)] text-[var(--text-secondary)]"
            }`}
            onClick={() =>
              onChange({ ...draft, remoteModes: remoteOnly ? [] : ["remote"] })
            }
            type="button"
          >
            {t("remoteOnly")}
          </button>
          <button
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-2 text-left text-xs text-[var(--text-secondary)] disabled:opacity-70"
            disabled
            type="button"
          >
            {t("allGrades")}
          </button>
        </div>
      </div>
    </aside>
  );
}
