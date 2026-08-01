import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";
import type { KeyboardEvent } from "react";

import { FilterSection } from "@/components/ui/filter-section";
import { FilterAutocomplete } from "@/features/feed/components/FilterAutocomplete";
import type { FilterSuggestion } from "@/features/feed/components/FilterAutocomplete";
import { formatCount } from "@/features/feed/jobPresentation";
import type { SearchDraft } from "@/features/feed/searchDraft";
import {
  employmentTypeLabels,
  formatSourceLabel,
  locationKindLabels,
  remoteModeLabels,
  seniorityLabels,
} from "@/features/feed/searchLabels";
import {
  autocompleteLocations,
  autocompleteSkills,
  employmentTypeSchema,
  getFilterOptions,
  remoteModeSchema,
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
  visible: boolean;
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

function CheckboxList<T extends string>({
  disabled,
  onChange,
  options,
  values,
}: CheckboxListProps<T>) {
  return (
    <div className="scroll-region max-h-48 space-y-0.5 overflow-y-auto pr-1">
      {options.map((option) => {
        const checked = values.includes(option.value);
        return (
          <label
            className="flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-1.5 py-1 text-xs hover:bg-[var(--bg-hover)]"
            key={option.value}
          >
            <input
              checked={checked}
              className="size-4 accent-[var(--accent)]"
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
        className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-raised)] px-2 text-xs placeholder:text-[var(--text-placeholder)]"
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

export function Filters({ disabled, draft, onChange, visible }: FiltersProps) {
  const [skillQuery, setSkillQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const filterOptions = useQuery({
    enabled: !disabled,
    queryFn: getFilterOptions,
    queryKey: ["catalog", "filter-options"],
    retry: false,
  });
  const skillSuggestions = useQuery({
    enabled: !disabled,
    queryFn: () => autocompleteSkills(skillQuery, 20),
    queryKey: ["catalog", "autocomplete", "skills", skillQuery],
    retry: false,
  });
  const locationSuggestions = useQuery({
    enabled: !disabled,
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
    meta: formatCount(count),
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
  const activeFilterCount =
    draft.remoteModes.length +
    draft.skills.length +
    draft.locations.length +
    draft.seniorities.length +
    draft.employmentTypes.length +
    draft.sources.length +
    (draft.salaryMinUsdYear === undefined ? 0 : 1) +
    (draft.salaryKnownOnly ? 1 : 0);

  return (
    <aside
      className="filter-panel scroll-region min-h-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--surface-0)] p-3"
      data-visible={visible ? "true" : "false"}
      id="search-filters"
    >
      <div>
        <p className="flex min-h-9 items-center gap-2 px-1 text-xs font-semibold text-[var(--text)]">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          {t("filters")}
          {activeFilterCount > 0 ? (
            <span
              aria-label={`${t("activeFiltersCount")}: ${activeFilterCount}`}
              className="ml-auto rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-[10px] text-[var(--accent)]"
            >
              {activeFilterCount}
            </span>
          ) : null}
        </p>

        <div className="mt-2 space-y-1">
          <FilterSection
            activeCount={draft.remoteModes.length}
            defaultOpen
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

          <FilterSection activeCount={draft.skills.length} defaultOpen title={t("skillsFilter")}>
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

          <FilterSection activeCount={draft.locations.length} defaultOpen title={t("locationsFilter")}>
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

          <FilterSection activeCount={draft.seniorities.length} title={t("seniority")}>
            <CheckboxList<Seniority>
              disabled={disabled}
              onChange={(seniorities) => onChange({ ...draft, seniorities })}
              options={seniorityOptions}
              values={draft.seniorities}
            />
          </FilterSection>

          <FilterSection activeCount={draft.employmentTypes.length} title={t("employment")}>
            <CheckboxList<EmploymentType>
              disabled={disabled}
              onChange={(employmentTypes) => onChange({ ...draft, employmentTypes })}
              options={employmentOptions}
              values={draft.employmentTypes}
            />
          </FilterSection>

          <FilterSection
            activeCount={(draft.salaryMinUsdYear === undefined ? 0 : 1) + (draft.salaryKnownOnly ? 1 : 0)}
            title={t("salary")}
          >
            <div className="space-y-2">
              <SalaryMinimumInput
                disabled={disabled}
                key={draft.salaryMinUsdYear ?? "empty"}
                onCommit={(salaryMinUsdYear) =>
                  onChange({ ...draft, salaryMinUsdYear })
                }
                value={draft.salaryMinUsdYear}
              />
              <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-1 py-1 text-xs hover:bg-[var(--bg-hover)]">
                <input
                  checked={draft.salaryKnownOnly}
                  className="size-4 accent-[var(--accent)]"
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

          <FilterSection activeCount={draft.sources.length} title={t("sources")}>
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
