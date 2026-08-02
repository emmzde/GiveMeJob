import { z } from "zod";

import { tauriAdapter } from "@/lib/tauri/adapter";
import type { TauriAdapter, Unlisten } from "@/lib/tauri/adapter";
import { t } from "@/lib/i18n";

const MAX_CURSOR_LENGTH = 2_048;
const MAX_FILTER_VALUE_LENGTH = 100;
const MAX_JOB_DESCRIPTION_LENGTH = 64_000;
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
const httpsUrlSchema = z.url().refine((value) => new URL(value).protocol === "https:");

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

const catalogStatusKindSchema = z.enum([
  "initializing",
  "verifying",
  "ready",
  "missing",
  "recovering",
  "error",
]);
const catalogStageSchema = z.enum([
  "starting",
  "checking_seal",
  "checking_space",
  "checking_archive",
  "decompressing",
  "checking_catalog",
  "checking_sqlite",
  "activating",
  "opening",
  "cleaning_up",
]);
export const catalogStatusSchema = z
  .object({
    state: catalogStatusKindSchema,
    stage: catalogStageSchema.nullable(),
    progress: z.number().int().min(0).max(100),
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
    description: z
      .string()
      .refine((value) => hasAtMostUnicodeScalars(value, MAX_JOB_DESCRIPTION_LENGTH), {
        message: `Must contain at most ${MAX_JOB_DESCRIPTION_LENGTH} Unicode characters`,
      }),
    skills: z.array(boundedTrimmedString(MAX_FILTER_VALUE_LENGTH)).max(100),
    employmentType: employmentTypeSchema.nullable(),
    salaryUsdYear: finiteNonnegativeSchema.nullable(),
    sourceUrl: httpsUrlSchema,
    applyUrl: httpUrlSchema.nullable(),
    snapshotVersion: z.string().min(1),
  })
  .strict();

const skillFacetSchema = z
  .object({
    skill: boundedTrimmedString(MAX_FILTER_VALUE_LENGTH),
    count: z.number().int().nonnegative(),
  })
  .strict();
const locationFacetSchema = z
  .object({
    location: z.string().trim().min(1),
    count: z.number().int().nonnegative(),
  })
  .strict();
const sourceFacetSchema = z
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
const skillSuggestionSchema = z
  .object({
    label: boundedTrimmedString(MAX_FILTER_VALUE_LENGTH),
    canonicalName: boundedTrimmedString(MAX_FILTER_VALUE_LENGTH),
    count: z.number().int().nonnegative(),
  })
  .strict();
const locationKindSchema = z.enum(["country", "city", "location_text"]);
const locationSuggestionSchema = z
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
    z.object({ code: z.literal("catalog_busy") }).strict(),
    z.object({ code: z.literal("disk_full") }).strict(),
    z.object({ code: z.literal("invalid_query") }).strict(),
    z.object({ code: z.literal("not_found") }).strict(),
    z.object({ code: z.literal("open_failed") }).strict(),
    z.object({ code: z.literal("recovery_failed") }).strict(),
    z.object({ code: z.literal("user_data_unavailable") }).strict(),
    z.object({ code: z.literal("internal") }).strict(),
  ],
);

export type CatalogStatus = z.infer<typeof catalogStatusSchema>;
export type EmploymentType = z.infer<typeof employmentTypeSchema>;
export type FilterOptions = z.infer<typeof filterOptionsSchema>;
type IpcError = z.infer<typeof ipcErrorSchema>;
export type JobDetail = z.infer<typeof jobDetailSchema>;
export type JobId = z.infer<typeof jobIdSchema>;
export type JobSearchPage = z.infer<typeof jobSearchPageSchema>;
export type JobSummary = z.infer<typeof jobSummarySchema>;
export type LocationKind = z.infer<typeof locationKindSchema>;
type LocationSuggestion = z.infer<typeof locationSuggestionSchema>;
export type RemoteMode = z.infer<typeof remoteModeSchema>;
export type SearchCursor = z.infer<typeof searchCursorSchema>;
type SearchFacets = z.infer<typeof searchFacetsSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SearchSort = z.infer<typeof searchSortSchema>;
export type Seniority = z.infer<typeof senioritySchema>;
type SkillSuggestion = z.infer<typeof skillSuggestionSchema>;

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

function asIpcError(error: unknown): IpcError {
  const parsed = ipcErrorSchema.safeParse(error);
  return parsed.success ? parsed.data : { code: "internal" };
}

export function createSearchQuery(overrides: Partial<SearchQuery> = {}): SearchQuery {
  return searchQuerySchema.parse({ ...defaultSearchQuery, ...overrides });
}

interface CatalogApi {
  getCatalogStatus(): Promise<CatalogStatus>;
  watchCatalogStatus(onStatus: (status: CatalogStatus) => void): Promise<Unlisten>;
  recoverLocalCatalog(): Promise<CatalogStatus>;
  searchLocalJobs(input: SearchQuery): Promise<JobSearchPage>;
  getLocalJob(input: JobId): Promise<JobDetail>;
  openOriginalJob(input: JobId): Promise<void>;
  getSearchFacets(): Promise<SearchFacets>;
  getFilterOptions(): Promise<FilterOptions>;
  autocompleteSkills(query: string, limit?: number): Promise<SkillSuggestion[]>;
  autocompleteLocations(query: string, limit?: number): Promise<LocationSuggestion[]>;
}

export function createCatalogApi(adapter: TauriAdapter): CatalogApi {
  async function invokeValidated<T>(
    command: string,
    schema: z.ZodType<T>,
    args?: Record<string, unknown>,
  ): Promise<T> {
    try {
      return schema.parse(await adapter.invoke(command, args));
    } catch (error) {
      if (error instanceof z.ZodError) throw error;
      throw asIpcError(error);
    }
  }

  return {
    async getCatalogStatus() {
      if (!adapter.isAvailable()) {
        return catalogStatusSchema.parse({
          state: "missing",
          stage: null,
          progress: 0,
          catalogVersion: null,
          sourceFrozenAt: null,
          totalJobs: 0,
          message: t("catalogWindowsOnly"),
        });
      }
      return invokeValidated("catalog_status", catalogStatusSchema);
    },
    async watchCatalogStatus(onStatus) {
      if (!adapter.isAvailable()) return () => undefined;
      return adapter.listen("catalog://status", (payload) => {
        const status = catalogStatusSchema.safeParse(payload);
        if (status.success) onStatus(status.data);
      });
    },
    async recoverLocalCatalog() {
      if (!adapter.isAvailable()) throw { code: "catalog_missing" } satisfies IpcError;
      return invokeValidated("recover_catalog", catalogStatusSchema);
    },
    async searchLocalJobs(input) {
      const request = searchQuerySchema.parse(input);
      if (!adapter.isAvailable()) {
        return jobSearchPageSchema.parse({ items: [], nextCursor: null, total: 0 });
      }
      return invokeValidated("search_jobs", jobSearchPageSchema, { request });
    },
    async getLocalJob(input) {
      const id = jobIdSchema.parse(input);
      if (!adapter.isAvailable()) throw { code: "catalog_missing" } satisfies IpcError;
      return invokeValidated("get_job", jobDetailSchema, { id });
    },
    async openOriginalJob(input) {
      const jobId = jobIdSchema.parse(input);
      if (!adapter.isAvailable()) throw { code: "catalog_missing" } satisfies IpcError;
      await invokeValidated("open_original", z.null(), { jobId });
    },
    async getSearchFacets() {
      if (!adapter.isAvailable()) {
        return searchFacetsSchema.parse({ skills: [], locations: [], sources: [] });
      }
      return invokeValidated("get_search_facets", searchFacetsSchema);
    },
    async getFilterOptions() {
      if (!adapter.isAvailable()) {
        return filterOptionsSchema.parse({
          sources: [],
          remoteModes: remoteModeSchema.options,
          seniorities: senioritySchema.options,
          employmentTypes: employmentTypeSchema.options,
        });
      }
      return invokeValidated("get_filter_options", filterOptionsSchema);
    },
    async autocompleteSkills(query, limit = 10) {
      const request = autocompleteRequestSchema.parse({ query, limit });
      if (!adapter.isAvailable()) return skillSuggestionsSchema.parse([]);
      return invokeValidated("autocomplete_skills", skillSuggestionsSchema, { request });
    },
    async autocompleteLocations(query, limit = 10) {
      const request = autocompleteRequestSchema.parse({ query, limit });
      if (!adapter.isAvailable()) return locationSuggestionsSchema.parse([]);
      return invokeValidated("autocomplete_locations", locationSuggestionsSchema, { request });
    },
  };
}

const catalogApi = createCatalogApi(tauriAdapter);

export const getCatalogStatus = () => catalogApi.getCatalogStatus();
export const watchCatalogStatus = (onStatus: (status: CatalogStatus) => void) =>
  catalogApi.watchCatalogStatus(onStatus);
export const recoverLocalCatalog = () => catalogApi.recoverLocalCatalog();
export const searchLocalJobs = (input: SearchQuery) => catalogApi.searchLocalJobs(input);
export const getLocalJob = (input: JobId) => catalogApi.getLocalJob(input);
export const openOriginalJob = (input: JobId) => catalogApi.openOriginalJob(input);
export const getSearchFacets = () => catalogApi.getSearchFacets();
export const getFilterOptions = () => catalogApi.getFilterOptions();
export const autocompleteSkills = (query: string, limit = 10) =>
  catalogApi.autocompleteSkills(query, limit);
export const autocompleteLocations = (query: string, limit = 10) =>
  catalogApi.autocompleteLocations(query, limit);
