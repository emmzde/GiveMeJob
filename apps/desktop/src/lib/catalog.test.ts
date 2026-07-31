import { describe, expect, it } from "vitest";

import {
  createSearchQuery,
  getCatalogStatus,
  searchLocalJobs,
  searchQuerySchema,
} from "@/lib/catalog";

describe("catalog IPC boundary", () => {
  it("uses a validated browser fallback outside Tauri", async () => {
    await expect(getCatalogStatus()).resolves.toMatchObject({
      state: "missing",
      totalJobs: 0,
    });
    await expect(searchLocalJobs(createSearchQuery({ text: "python" }))).resolves.toEqual([]);
  });

  it("creates a normalized typed search query", () => {
    expect(
      createSearchQuery({
        text: "  Python backend  ",
        skills: ["Python"],
        locations: ["US"],
        remoteModes: ["remote"],
        seniorities: ["senior"],
        employmentTypes: ["full_time"],
        salaryMinUsdYear: 100_000,
        salaryKnownOnly: true,
        sources: ["greenhouse"],
        sort: "salary",
      }),
    ).toMatchObject({
      text: "Python backend",
      skills: ["Python"],
      locations: ["US"],
      remoteModes: ["remote"],
      seniorities: ["senior"],
      employmentTypes: ["full_time"],
      salaryMinUsdYear: 100_000,
      salaryKnownOnly: true,
      sources: ["greenhouse"],
      sort: "salary",
    });
  });

  it("rejects unsupported sorts, unknown fields, and invalid limits", async () => {
    expect(() =>
      searchQuerySchema.parse({
        ...createSearchQuery(),
        sort: "match",
      }),
    ).toThrow();
    expect(() =>
      searchQuerySchema.parse({
        ...createSearchQuery(),
        rawSql: "DROP TABLE jobs",
      }),
    ).toThrow();
    await expect(
      searchLocalJobs({ ...createSearchQuery(), limit: 0 }),
    ).rejects.toThrow();
  });
});
