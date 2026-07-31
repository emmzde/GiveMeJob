import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

const catalogStatusSchema = z.object({
  state: z.enum(["ready", "missing", "error"]),
  catalogVersion: z.string().nullable(),
  snapshotDate: z.string().nullable(),
  totalJobs: z.number().int().nonnegative(),
  message: z.string().nullable(),
});

const jobSummarySchema = z.object({
  id: z.number().int(),
  title: z.string().min(1),
  company: z.string().min(1),
  locationText: z.string(),
  remoteMode: z.string().nullable(),
  seniority: z.string().nullable(),
  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
  salaryCurrency: z.string().nullable(),
  salaryPeriod: z.string().nullable(),
  postedAt: z.string().nullable(),
  source: z.string().min(1),
  attribution: z.string().min(1),
});

export type CatalogStatus = z.infer<typeof catalogStatusSchema>;
export type JobSummary = z.infer<typeof jobSummarySchema>;

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export async function getCatalogStatus(): Promise<CatalogStatus> {
  if (!isTauriRuntime()) {
    return {
      state: "missing",
      catalogVersion: null,
      snapshotDate: null,
      totalJobs: 0,
      message: "Каталог доступен в Windows-приложении.",
    };
  }
  return catalogStatusSchema.parse(await invoke<unknown>("catalog_status"));
}

export async function searchLocalJobs(
  query: string,
  limit = 40,
): Promise<JobSummary[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  const response = await invoke<unknown>("search_jobs", {
    request: { query, limit },
  });
  return z.array(jobSummarySchema).parse(response);
}
