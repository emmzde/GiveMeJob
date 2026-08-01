import { describe, expect, it } from "vitest";

import { flattenUniqueJobs } from "@/features/feed/searchPages";
import { jobIdSchema } from "@/lib/catalog";
import type { JobSearchPage, JobSummary } from "@/lib/catalog";

function job(id: string, title = `Job ${id}`): JobSummary {
  return {
    id: jobIdSchema.parse(id),
    title,
    company: "Company",
    locationText: "",
    remoteMode: null,
    seniority: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    postedAt: null,
    source: "source",
    attribution: "Source",
  };
}

describe("flattenUniqueJobs", () => {
  it("preserves page order and keeps the first copy of a duplicate job ID", () => {
    const firstCopy = job("2", "First copy");
    const pages: JobSearchPage[] = [
      { items: [job("1"), firstCopy], nextCursor: null, total: 3 },
      { items: [job("2", "Duplicate"), job("3")], nextCursor: null },
    ];

    expect(flattenUniqueJobs(pages)).toEqual([pages[0]!.items[0], firstCopy, pages[1]!.items[1]]);
  });
});
