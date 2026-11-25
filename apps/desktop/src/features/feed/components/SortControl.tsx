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
    <fieldset className="sort-control">
      <legend className="sr-only">{t("sort")}</legend>
      <div className="sort-tabs">
        {searchSortSchema.options.map((sort) => (
          <label className="sort-tab" key={sort}>
            <input
              checked={value === sort}
              className="peer sr-only"
              disabled={disabled}
              name={name}
              onChange={() => onChange(sort)}
              type="radio"
              value={sort}
            />
            <span className="sort-tab-label">{searchSortLabels[sort]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
