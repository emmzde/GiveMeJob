import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

const MAX_CURSOR_LENGTH = 2_048;
const MAX_FILTER_VALUE_LENGTH = 100;
const MAX_QUERY_LENGTH = 200;

function hasAtMostUnicodeScalars(value: string, maximum: number): boolean {
  return Array.from(value).length <= maximum;
}

function boundedTrimmedString(maximum: number) {
  return z
    .string()
    .trim()
    .min(1)
    .refine((value) => hasAtMostUnicodeScalars(value, maximum), {
      message: `Must contain at most ${maximum} Unicode characters`,
    });
}

const finiteNonnegativeSchema = z.number().finite().nonnegative();
const httpUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
});

export const remoteModeSchema = z.enum(["remote", "hybrid", "onsite"]);
export const senioritySchema = z.enum([
  "intern",
  "junior",
  "middle",
  "senior",
  "lead",
  "staff",
  "principal",
  "manager",
  "director",
  "executive",
]);
export const employmentTypeSchema = z.enum([
  "full_time",
  "contract",
  "part_time",
  "internship",
  "temporary",
  "volunteer",
  "other",
]);
export const searchSortSchema = z.enum(["relevance", "newest", "salary"]);
export const jobIdSchema = z.string().regex(/^[1-9]\d*$/).brand<"JobId">();
export const searchCursorSchema = z
  .string()
  .min(1)
  .max(MAX_CURSOR_LENGTH)
  .brand<"SearchCursor">();

export const autocompleteRequestSchema = z
  .object({
    query: z
      .string()
      .trim()
      .refine((value) => hasAtMostUnicodeScalars(value, MAX_FILTER_VALUE_LENGTH), {
        message: `Must contain at most ${MAX_FILTER_VALUE_LENGTH} Unicode characters`,
      }),
    limit: z.number().int().min(1).max(20),
  })
  .strict();

const filterValueSchema = boundedTrimmedString(MAX_FILTER_VALUE_LENGTH);
const searchTextSchema = z
  .string()
  .trim()
  .refine((value) => hasAtMostUnicodeScalars(value, MAX_QUERY_LENGTH), {
    message: `Must contain at most ${MAX_QUERY_LENGTH} Unicode characters`,
  });

export const searchQuerySchema = z
  .object({
    text: searchTextSchema,
    skills: z.array(filterValueSchema).max(50),
    locations: z.array(filterValueSchema).max(20),
    remoteModes: z.array(remoteModeSchema).max(3),
    seniorities: z.array(senioritySchema).max(10),
    employmentTypes: z.array(employmentTypeSchema).max(7),
    salaryMinUsdYear: finiteNonnegativeSchema.max(10_000_000).optional(),
    salaryKnownOnly: z.boolean(),
    sources: z.array(filterValueSchema).max(20),
    sort: searchSortSchema,
    limit: z.number().int().min(1).max(50),
    cursor: searchCursorSchema.optional(),
  })
  .strict();

export const catalogStatusSchema = z
  .object({
    state: z.enum(["ready", "missing", "error"]),
    catalogVersion: z.string().min(1).nullable(),
    sourceFrozenAt: z.string().min(1).nullable(),
    totalJobs: z.number().int().nonnegative(),
    message: z.string().nullable(),
  })
  .strict();

export const jobSummarySchema = z
  .object({
    id: jobIdSchema,
    title: z.string().min(1),
    company: z.string().min(1),
    locationText: z.string(),
    remoteMode: remoteModeSchema.nullable(),
    seniority: senioritySchema.nullable(),
    salaryMin: finiteNonnegativeSchema.nullable(),
    salaryMax: finiteNonnegativeSchema.nullable(),
    salaryCurrency: z.string().min(1).nullable(),
    salaryPeriod: z.string().min(1).nullable(),
    postedAt: z.string().min(1).nullable(),
    source: z.string().min(1),
    attribution: z.string().min(1),
  })
  .strict();

export const jobSearchPageSchema = z
  .object({
    items: z.array(jobSummarySchema).max(50),
    nextCursor: searchCursorSchema.nullable(),
    total: z.number().int().nonnegative().optional(),
    suggestion: searchTextSchema.optional(),
  })
  .strict();

export const jobDetailSchema = jobSummarySchema
  .extend({
    description: z.string(),
    skills: z.array(boundedTrimmedString(MAX_FILTER_VALUE_LENGTH)).max(100),
    employmentType: employmentTypeSchema.nullable(),
    salaryUsdYear: finiteNonnegativeSchema.nullable(),
    sourceUrl: httpUrlSchema,
    applyUrl: httpUrlSchema.nullable(),
    snapshotVersion: z.string().min(1),
  })
  .strict();

export const skillFacetSchema = z
  .object({
    skill: boundedTrimmedString(MAX_FILTER_VALUE_LENGTH),
    count: z.number().int().nonnegative(),
  })
  .strict();
export const locationFacetSchema = z
  .object({
    location: z.string().trim().min(1),
    count: z.number().int().nonnegative(),
  })
  .strict();
export const sourceFacetSchema = z
  .object({
    source: boundedTrimmedString(MAX_FILTER_VALUE_LENGTH),
    count: z.number().int().nonnegative(),
  })
  .strict();
export const filterOptionsSchema = z
  .object({
    sources: z.array(sourceFacetSchema).max(20),
    remoteModes: z.tuple([
      z.literal("remote"),
      z.literal("hybrid"),
      z.literal("onsite"),
    ]),
    seniorities: z.tuple([
      z.literal("intern"),
      z.literal("junior"),
      z.literal("middle"),
      z.literal("senior"),
      z.literal("lead"),
      z.literal("staff"),
      z.literal("principal"),
      z.literal("manager"),
      z.literal("director"),
      z.literal("executive"),
    ]),
    employmentTypes: z.tuple([
      z.literal("full_time"),
      z.literal("contract"),
      z.literal("part_time"),
      z.literal("internship"),
      z.literal("temporary"),
      z.literal("volunteer"),
      z.literal("other"),
    ]),
  })
  .strict();
export const skillSuggestionSchema = z
  .object({
    label: boundedTrimmedString(MAX_FILTER_VALUE_LENGTH),
    canonicalName: boundedTrimmedString(MAX_FILTER_VALUE_LENGTH),
    count: z.number().int().nonnegative(),
  })
  .strict();
export const locationKindSchema = z.enum(["country", "city", "location_text"]);
export const locationSuggestionSchema = z
  .object({
    label: boundedTrimmedString(MAX_FILTER_VALUE_LENGTH),
    canonicalValue: boundedTrimmedString(MAX_FILTER_VALUE_LENGTH),
    kind: locationKindSchema,
    count: z.number().int().nonnegative(),
  })
  .strict();
export const skillSuggestionsSchema = z.array(skillSuggestionSchema).max(20);
export const locationSuggestionsSchema = z.array(locationSuggestionSchema).max(20);
export const searchFacetsSchema = z
  .object({
    skills: z.array(skillFacetSchema).max(100),
    locations: z.array(locationFacetSchema).max(100),
    sources: z.array(sourceFacetSchema).max(100),
  })
  .strict();

export const ipcErrorSchema = z.discriminatedUnion(
  "code",
  [
    z.object({ code: z.literal("catalog_missing") }).strict(),
    z.object({ code: z.literal("catalog_corrupt") }).strict(),
    z.object({ code: z.literal("invalid_query") }).strict(),
    z.object({ code: z.literal("not_found") }).strict(),
    z.object({ code: z.literal("open_failed") }).strict(),
    z.object({ code: z.literal("internal") }).strict(),
  ],
);

export type CatalogStatus = z.infer<typeof catalogStatusSchema>;
export type AutocompleteRequest = z.infer<typeof autocompleteRequestSchema>;
export type EmploymentType = z.infer<typeof employmentTypeSchema>;
export type FilterOptions = z.infer<typeof filterOptionsSchema>;
export type IpcError = z.infer<typeof ipcErrorSchema>;
export type JobDetail = z.infer<typeof jobDetailSchema>;
export type JobId = z.infer<typeof jobIdSchema>;
export type JobSearchPage = z.infer<typeof jobSearchPageSchema>;
export type JobSummary = z.infer<typeof jobSummarySchema>;
export type LocationFacet = z.infer<typeof locationFacetSchema>;
export type LocationKind = z.infer<typeof locationKindSchema>;
export type LocationSuggestion = z.infer<typeof locationSuggestionSchema>;
export type RemoteMode = z.infer<typeof remoteModeSchema>;
export type SearchCursor = z.infer<typeof searchCursorSchema>;
export type SearchFacets = z.infer<typeof searchFacetsSchema>;
export type SearchPage<T> = Omit<JobSearchPage, "items"> & { items: T[] };
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SearchSort = z.infer<typeof searchSortSchema>;
export type Seniority = z.infer<typeof senioritySchema>;
export type SkillFacet = z.infer<typeof skillFacetSchema>;
export type SkillSuggestion = z.infer<typeof skillSuggestionSchema>;
export type SourceFacet = z.infer<typeof sourceFacetSchema>;

const defaultSearchQuery: SearchQuery = {
  text: "",
  skills: [],
  locations: [],
  remoteModes: [],
  seniorities: [],
  employmentTypes: [],
  salaryKnownOnly: false,
  sources: [],
  sort: "relevance",
  limit: 40,
};

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

function asIpcError(error: unknown): IpcError {
  const parsed = ipcErrorSchema.safeParse(error);
  return parsed.success ? parsed.data : { code: "internal" };
}

async function invokeValidated<T>(
  command: string,
  schema: z.ZodType<T>,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return schema.parse(await invoke<unknown>(command, args));
  } catch (error) {
    if (error instanceof z.ZodError) throw error;
    throw asIpcError(error);
  }
}

export async function getCatalogStatus(): Promise<CatalogStatus> {
  if (!isTauriRuntime()) {
    return catalogStatusSchema.parse({
      state: "missing",
      catalogVersion: null,
      sourceFrozenAt: null,
      totalJobs: 0,
      message: "Каталог доступен в Windows-приложении.",
    });
  }
  return invokeValidated("catalog_status", catalogStatusSchema);
}

export function createSearchQuery(overrides: Partial<SearchQuery> = {}): SearchQuery {
  return searchQuerySchema.parse({ ...defaultSearchQuery, ...overrides });
}

export async function searchLocalJobs(input: SearchQuery): Promise<JobSearchPage> {
  const request = searchQuerySchema.parse(input);
  if (!isTauriRuntime()) {
    return jobSearchPageSchema.parse({ items: [], nextCursor: null, total: 0 });
  }
  return invokeValidated("search_jobs", jobSearchPageSchema, { request });
}

export async function getLocalJob(input: JobId): Promise<JobDetail> {
  const id = jobIdSchema.parse(input);
  if (!isTauriRuntime()) throw { code: "catalog_missing" } satisfies IpcError;
  return invokeValidated("get_job", jobDetailSchema, { id });
}

export async function getSearchFacets(): Promise<SearchFacets> {
  if (!isTauriRuntime()) {
    return searchFacetsSchema.parse({ skills: [], locations: [], sources: [] });
  }
  return invokeValidated("get_search_facets", searchFacetsSchema);
}

export async function getFilterOptions(): Promise<FilterOptions> {
  if (!isTauriRuntime()) {
    return filterOptionsSchema.parse({
      sources: [],
      remoteModes: remoteModeSchema.options,
      seniorities: senioritySchema.options,
      employmentTypes: employmentTypeSchema.options,
    });
  }
  return invokeValidated("get_filter_options", filterOptionsSchema);
}

export async function autocompleteSkills(
  query: string,
  limit = 10,
): Promise<SkillSuggestion[]> {
  const request = autocompleteRequestSchema.parse({ query, limit });
  if (!isTauriRuntime()) return skillSuggestionsSchema.parse([]);
  return invokeValidated("autocomplete_skills", skillSuggestionsSchema, { request });
}

export async function autocompleteLocations(
  query: string,
  limit = 10,
): Promise<LocationSuggestion[]> {
  const request = autocompleteRequestSchema.parse({ query, limit });
  if (!isTauriRuntime()) return locationSuggestionsSchema.parse([]);
  return invokeValidated("autocomplete_locations", locationSuggestionsSchema, { request });
}
