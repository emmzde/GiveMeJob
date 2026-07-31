import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

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

const filterValueSchema = z.string().trim().min(1).max(100);

export const searchQuerySchema = z
  .object({
    text: z.string().trim().max(200),
    skills: z.array(filterValueSchema).max(50),
    locations: z.array(filterValueSchema).max(20),
    remoteModes: z.array(remoteModeSchema).max(3),
    seniorities: z.array(senioritySchema).max(10),
    employmentTypes: z.array(employmentTypeSchema).max(7),
    salaryMinUsdYear: z.number().finite().min(0).max(10_000_000).optional(),
    salaryKnownOnly: z.boolean(),
    sources: z.array(filterValueSchema).max(20),
    sort: searchSortSchema,
    limit: z.number().int().min(1).max(50),
  })
  .strict();

const catalogStatusSchema = z.object({
  state: z.enum(["ready", "missing", "error"]),
  catalogVersion: z.string().nullable(),
  sourceFrozenAt: z.string().nullable(),
  totalJobs: z.number().int().nonnegative(),
  message: z.string().nullable(),
});

const jobSummarySchema = z.object({
  id: jobIdSchema,
  title: z.string().min(1),
  company: z.string().min(1),
  locationText: z.string(),
  remoteMode: remoteModeSchema.nullable(),
  seniority: senioritySchema.nullable(),
  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
  salaryCurrency: z.string().nullable(),
  salaryPeriod: z.string().nullable(),
  postedAt: z.string().nullable(),
  source: z.string().min(1),
  attribution: z.string().min(1),
});

export type CatalogStatus = z.infer<typeof catalogStatusSchema>;
export type EmploymentType = z.infer<typeof employmentTypeSchema>;
export type JobId = z.infer<typeof jobIdSchema>;
export type JobSummary = z.infer<typeof jobSummarySchema>;
export type RemoteMode = z.infer<typeof remoteModeSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SearchSort = z.infer<typeof searchSortSchema>;
export type Seniority = z.infer<typeof senioritySchema>;

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

export async function getCatalogStatus(): Promise<CatalogStatus> {
  if (!isTauriRuntime()) {
    return {
      state: "missing",
      catalogVersion: null,
      sourceFrozenAt: null,
      totalJobs: 0,
      message: "Каталог доступен в Windows-приложении.",
    };
  }
  return catalogStatusSchema.parse(await invoke<unknown>("catalog_status"));
}

export function createSearchQuery(overrides: Partial<SearchQuery> = {}): SearchQuery {
  return searchQuerySchema.parse({ ...defaultSearchQuery, ...overrides });
}

export async function searchLocalJobs(input: SearchQuery): Promise<JobSummary[]> {
  const request = searchQuerySchema.parse(input);
  if (!isTauriRuntime()) {
    return [];
  }
  const response = await invoke<unknown>("search_jobs", {
    request,
  });
  return z.array(jobSummarySchema).parse(response);
}
