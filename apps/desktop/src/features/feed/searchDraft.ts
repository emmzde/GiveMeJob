import { createSearchQuery } from "@/lib/catalog";
import type {
  EmploymentType,
  RemoteMode,
  SearchQuery,
  SearchSort,
  Seniority,
} from "@/lib/catalog";

export interface SearchDraft {
  text: string;
  skills: readonly string[];
  locations: readonly string[];
  remoteModes: readonly RemoteMode[];
  seniorities: readonly Seniority[];
  employmentTypes: readonly EmploymentType[];
  salaryMinUsdYear: number | undefined;
  salaryKnownOnly: boolean;
  sources: readonly string[];
  sort: SearchSort;
}

const emptySearchDraft: SearchDraft = {
  text: "",
  skills: [],
  locations: [],
  remoteModes: [],
  seniorities: [],
  employmentTypes: [],
  salaryMinUsdYear: undefined,
  salaryKnownOnly: false,
  sources: [],
  sort: "relevance",
};

const filterResetDraft: Omit<SearchDraft, "text"> = {
  skills: [],
  locations: [],
  remoteModes: [],
  seniorities: [],
  employmentTypes: [],
  salaryMinUsdYear: undefined,
  salaryKnownOnly: false,
  sources: [],
  sort: "relevance",
};

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function normalizeValues<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean) as T[])].sort(
    compareStrings,
  );
}

export function createSearchDraft(overrides: Partial<SearchDraft> = {}): SearchDraft {
  return { ...emptySearchDraft, ...overrides };
}

/** Clears every filter and restores the default sort while preserving search text. */
export function resetSearchFilters(draft: SearchDraft): SearchDraft {
  return { text: draft.text, ...filterResetDraft };
}

export function searchDraftToQuery(draft: SearchDraft): SearchQuery {
  return createSearchQuery({
    text: draft.text,
    skills: normalizeValues(draft.skills),
    locations: normalizeValues(draft.locations),
    remoteModes: normalizeValues(draft.remoteModes),
    seniorities: normalizeValues(draft.seniorities),
    employmentTypes: normalizeValues(draft.employmentTypes),
    salaryMinUsdYear: draft.salaryMinUsdYear,
    salaryKnownOnly: draft.salaryKnownOnly,
    sources: normalizeValues(draft.sources),
    sort: draft.sort,
  });
}
