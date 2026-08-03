import { X } from "lucide-react";

import { getActiveFilterChips } from "@/features/feed/activeFilterChips";
import type { SearchDraft } from "@/features/feed/searchDraft";
import { resetSearchFilters } from "@/features/feed/searchDraft";
import { t } from "@/lib/i18n";

interface ActiveFilterChipsProps {
  draft: SearchDraft;
  onChange(draft: SearchDraft): void;
}

export function ActiveFilterChips({ draft, onChange }: ActiveFilterChipsProps) {
  const chips = getActiveFilterChips(draft);
  if (chips.length === 0) return null;

  return (
    <div
      aria-label={t("selectedFilters")}
      className="mt-2.5 flex flex-wrap items-center gap-1.5"
      role="group"
    >
      {chips.map((chip) => (
        <button
          aria-label={`${t("removeFilter")}: ${chip.label}`}
          className="inline-flex min-h-7 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-0)] px-2 text-[11px] hover:bg-[var(--bg-hover)]"
          key={chip.id}
          onClick={() => onChange(chip.remove(draft))}
          type="button"
        >
          <span>{chip.label}</span>
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ))}
      <button
        className="min-h-7 px-2 text-[11px] text-[var(--text-secondary)] underline-offset-2 hover:underline"
        onClick={() => onChange(resetSearchFilters(draft))}
        title={t("clearAllFiltersHint")}
        type="button"
      >
        {t("clearAllFilters")}
      </button>
    </div>
  );
}
