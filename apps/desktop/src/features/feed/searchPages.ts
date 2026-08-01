import type { JobSearchPage, JobSummary } from "@/lib/catalog";

/** Keeps backend order while making cursor-boundary overlap harmless in the UI. */
export function flattenUniqueJobs(pages: readonly JobSearchPage[]): JobSummary[] {
  const seenIds = new Set<JobSummary["id"]>();
  const jobs: JobSummary[] = [];

  for (const page of pages) {
    for (const job of page.items) {
      if (seenIds.has(job.id)) continue;
      seenIds.add(job.id);
      jobs.push(job);
    }
  }

  return jobs;
}
