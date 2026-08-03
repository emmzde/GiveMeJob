import { useId } from "react";

import { searchSortLabels } from "@/features/feed/searchLabels";
import { searchSortSchema } from "@/lib/catalog";
import type { SearchSort } from "@/lib/catalog";
import { t } from "@/lib/i18n";

interface SortControlProps {
  disabled: boolean;
  onChange(sort: SearchSort): void;
  value: SearchSort;
}

export function SortControl({ disabled, onChange, value }: SortControlProps) {
  const name = useId();
  return (
    <fieldset>
      <legend className="sr-only">{t("sort")}</legend>
      <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-0)] p-0.5">
        {searchSortSchema.options.map((sort) => (
          <label className="cursor-pointer" key={sort}>
            <input
              checked={value === sort}
              className="peer sr-only"
              disabled={disabled}
              name={name}
              onChange={() => onChange(sort)}
              type="radio"
              value={sort}
            />
            <span className="flex min-h-7 items-center rounded-[var(--radius-sm)] px-2.5 text-[11px] text-[var(--text-secondary)] peer-checked:bg-[var(--text)] peer-checked:font-medium peer-checked:text-[var(--bg)] peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--focus)] peer-focus-visible:outline-offset-1">
              {searchSortLabels[sort]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
