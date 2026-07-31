import { useQuery } from "@tanstack/react-query";
import { Bot, BriefcaseBusiness, SlidersHorizontal, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useId, useState } from "react";
import type { KeyboardEvent } from "react";

import { useAppUiStore } from "@/app/store/appUiStore";
import { FilterSection } from "@/components/ui/filter-section";
import { FilterAutocomplete } from "@/features/feed/components/FilterAutocomplete";
import type { FilterSuggestion } from "@/features/feed/components/FilterAutocomplete";
import type { SearchDraft } from "@/features/feed/searchDraft";
import {
  employmentTypeLabels,
  formatSourceLabel,
  locationKindLabels,
  remoteModeLabels,
  searchSortLabels,
  seniorityLabels,
} from "@/features/feed/searchLabels";
import {
  autocompleteLocations,
  autocompleteSkills,
  employmentTypeSchema,
  getFilterOptions,
  remoteModeSchema,
  searchSortSchema,
  senioritySchema,
} from "@/lib/catalog";
import type {
  EmploymentType,
  RemoteMode,
  Seniority,
} from "@/lib/catalog";
import { t } from "@/lib/i18n";

interface FiltersProps {
  disabled: boolean;
  draft: SearchDraft;
  onChange(draft: SearchDraft): void;
}

interface CheckboxOption<T extends string> {
  label: string;
  meta?: string;
  value: T;
}

interface CheckboxListProps<T extends string> {
  disabled: boolean;
  onChange(values: readonly T[]): void;
  options: readonly CheckboxOption<T>[];
  values: readonly T[];
}

const MAX_SALARY_USD_YEAR = 10_000_000;

const futureNavigationItems: ReadonlyArray<{ icon: LucideIcon; label: string }> = [
  { icon: UserRound, label: t("profile") },
  { icon: Bot, label: t("emmy") },
];

function CheckboxList<T extends string>({
  disabled,
  onChange,
  options,
  values,
}: CheckboxListProps<T>) {
  return (
    <div className="max-h-48 space-y-0.5 overflow-y-auto pr-1">
      {options.map((option) => {
        const checked = values.includes(option.value);
        return (
          <label
            className="flex min-h-8 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-1.5 py-1 text-xs hover:bg-[var(--bg-hover)]"
            key={option.value}
          >
            <input
              checked={checked}
              className="size-3.5 accent-[var(--text)]"
              disabled={disabled}
              onChange={() =>
                onChange(
                  checked
                    ? values.filter((value) => value !== option.value)
                    : [...values, option.value],
                )
              }
              type="checkbox"
            />
            <span className="min-w-0 truncate">{option.label}</span>
            {option.meta ? (
              <span className="ml-auto text-[10px] text-[var(--text-tertiary)]">
                {option.meta}
              </span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}

interface SalaryMinimumInputProps {
  disabled: boolean;
  onCommit(value: number | undefined): void;
  value: number | undefined;
}

function SalaryMinimumInput({ disabled, onCommit, value }: SalaryMinimumInputProps) {
  const errorId = useId();
  const [rawValue, setRawValue] = useState(value?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);

  function commit(): void {
    const normalized = rawValue.trim().replace(",", ".");
    if (normalized === "") {
      setError(null);
      onCommit(undefined);
      return;
    }
    if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
      setError(t("salaryInvalid"));
      return;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_SALARY_USD_YEAR) {
      setError(t("salaryInvalid"));
      return;
    }
    setError(null);
    onCommit(parsed);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
    if (event.key === "Escape") {
      setRawValue(value?.toString() ?? "");
      setError(null);
    }
  }

  return (
    <div>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        aria-label={t("salaryMinimum")}
        className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-raised)] px-2 text-xs"
        disabled={disabled}
        inputMode="decimal"
        maxLength={16}
        onBlur={commit}
        onChange={(event) => setRawValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("salaryMinimumPlaceholder")}
        type="text"
        value={rawValue}
      />
      {error ? (
        <p className="mt-1 text-[11px] text-[var(--text-secondary)]" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Filters({ disabled, draft, onChange }: FiltersProps) {
  const screen = useAppUiStore((state) => state.screen);
  const [skillQuery, setSkillQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const filterOptions = useQuery({
    enabled: !disabled,
    queryFn: getFilterOptions,
    queryKey: ["catalog", "filter-options"],
    retry: false,
  });
  const skillSuggestions = useQuery({
    enabled: !disabled && skillQuery.trim().length > 0,
    queryFn: () => autocompleteSkills(skillQuery, 20),
    queryKey: ["catalog", "autocomplete", "skills", skillQuery],
    retry: false,
  });
  const locationSuggestions = useQuery({
    enabled: !disabled && locationQuery.trim().length > 0,
    queryFn: () => autocompleteLocations(locationQuery, 20),
    queryKey: ["catalog", "autocomplete", "locations", locationQuery],
    retry: false,
  });

  const remoteModes = filterOptions.data?.remoteModes ?? remoteModeSchema.options;
  const seniorities = filterOptions.data?.seniorities ?? senioritySchema.options;
  const employmentTypes =
    filterOptions.data?.employmentTypes ?? employmentTypeSchema.options;
  const remoteOptions = remoteModes.map((value) => ({
    label: remoteModeLabels[value],
    value,
  }));
  const seniorityOptions = seniorities.map((value) => ({
    label: seniorityLabels[value],
    value,
  }));
  const employmentOptions = employmentTypes.map((value) => ({
    label: employmentTypeLabels[value],
    value,
  }));
  const sourceOptions = (filterOptions.data?.sources ?? []).map(({ count, source }) => ({
    label: formatSourceLabel(source),
    meta: count.toLocaleString("ru-RU"),
    value: source,
  }));
  const availableSkillSuggestions: FilterSuggestion[] = (skillSuggestions.data ?? [])
    .filter((suggestion) => !draft.skills.includes(suggestion.canonicalName))
    .map((suggestion) => ({
      count: suggestion.count,
      label: suggestion.label,
      value: suggestion.canonicalName,
    }));
  const availableLocationSuggestions: FilterSuggestion[] = (
    locationSuggestions.data ?? []
  )
    .filter((suggestion) => !draft.locations.includes(suggestion.canonicalValue))
    .map((suggestion) => ({
      count: suggestion.count,
      label: suggestion.label,
      secondaryLabel: locationKindLabels[suggestion.kind],
      value: suggestion.canonicalValue,
    }));

  return (
    <aside className="h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-[var(--border)] bg-[var(--bg-secondary)] p-3">
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
        <p className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          {t("filters")}
        </p>

        <div className="mt-4 space-y-5">
          <FilterSection title={t("sort")}>
            <select
              aria-label={t("sort")}
              className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-raised)] px-2 text-xs"
              disabled={disabled}
              onChange={(event) =>
                onChange({ ...draft, sort: searchSortSchema.parse(event.target.value) })
              }
              value={draft.sort}
            >
              {searchSortSchema.options.map((sort) => (
                <option key={sort} value={sort}>
                  {searchSortLabels[sort]}
                </option>
              ))}
            </select>
          </FilterSection>

          <FilterSection
            description={t("multipleChoiceHint")}
            title={t("workMode")}
          >
            <CheckboxList<RemoteMode>
              disabled={disabled}
              onChange={(remoteModes) => onChange({ ...draft, remoteModes })}
              options={remoteOptions}
              values={draft.remoteModes}
            />
          </FilterSection>

          <FilterSection title={t("skillsFilter")}>
            <FilterAutocomplete
              disabled={disabled}
              isLoading={skillSuggestions.isFetching}
              label={t("skillsFilter")}
              onQueryChange={setSkillQuery}
              onSelect={(suggestion) => {
                onChange({ ...draft, skills: [...draft.skills, suggestion.value] });
                setSkillQuery("");
              }}
              placeholder={t("skillsPlaceholder")}
              query={skillQuery}
              suggestions={availableSkillSuggestions}
            />
          </FilterSection>

          <FilterSection title={t("locationsFilter")}>
            <FilterAutocomplete
              disabled={disabled}
              isLoading={locationSuggestions.isFetching}
              label={t("locationsFilter")}
              onQueryChange={setLocationQuery}
              onSelect={(suggestion) => {
                onChange({ ...draft, locations: [...draft.locations, suggestion.value] });
                setLocationQuery("");
              }}
              placeholder={t("locationsPlaceholder")}
              query={locationQuery}
              suggestions={availableLocationSuggestions}
            />
          </FilterSection>

          <FilterSection title={t("seniority")}>
            <CheckboxList<Seniority>
              disabled={disabled}
              onChange={(seniorities) => onChange({ ...draft, seniorities })}
              options={seniorityOptions}
              values={draft.seniorities}
            />
          </FilterSection>

          <FilterSection title={t("employment")}>
            <CheckboxList<EmploymentType>
              disabled={disabled}
              onChange={(employmentTypes) => onChange({ ...draft, employmentTypes })}
              options={employmentOptions}
              values={draft.employmentTypes}
            />
          </FilterSection>

          <FilterSection title={t("salary")}>
            <div className="space-y-2">
              <SalaryMinimumInput
                disabled={disabled}
                key={draft.salaryMinUsdYear ?? "empty"}
                onCommit={(salaryMinUsdYear) =>
                  onChange({ ...draft, salaryMinUsdYear })
                }
                value={draft.salaryMinUsdYear}
              />
              <label className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-sm)] px-1 py-1 text-xs hover:bg-[var(--bg-hover)]">
                <input
                  checked={draft.salaryKnownOnly}
                  className="mt-0.5 size-3.5 accent-[var(--text)]"
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({ ...draft, salaryKnownOnly: event.target.checked })
                  }
                  type="checkbox"
                />
                <span>{t("salaryKnownOnly")}</span>
              </label>
            </div>
          </FilterSection>

          <FilterSection title={t("sources")}>
            {disabled ? (
              <p className="text-xs text-[var(--text-secondary)]" role="status">
                {t("sourceOptionsUnavailable")}
              </p>
            ) : filterOptions.isPending ? (
              <p className="text-xs text-[var(--text-secondary)]" role="status">
                {t("sourceOptionsLoading")}
              </p>
            ) : filterOptions.isError ? (
              <p className="text-xs text-[var(--text-secondary)]" role="status">
                {t("sourceOptionsError")}
              </p>
            ) : (
              <CheckboxList<string>
                disabled={disabled}
                onChange={(sources) => onChange({ ...draft, sources })}
                options={sourceOptions}
                values={draft.sources}
              />
            )}
          </FilterSection>
        </div>
      </div>
    </aside>
  );
}
