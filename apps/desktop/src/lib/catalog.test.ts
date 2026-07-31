import { describe, expect, it } from "vitest";

import contractFixtures from "../../../../tests/contracts/m2_ipc_contracts.json";

import {
  autocompleteLocations,
  autocompleteRequestSchema,
  autocompleteSkills,
  catalogStatusSchema,
  createSearchQuery,
  filterOptionsSchema,
  getCatalogStatus,
  getFilterOptions,
  getSearchFacets,
  ipcErrorSchema,
  jobDetailSchema,
  jobIdSchema,
  jobSearchPageSchema,
  locationSuggestionsSchema,
  searchCursorSchema,
  searchFacetsSchema,
  searchLocalJobs,
  searchQuerySchema,
  skillSuggestionsSchema,
} from "@/lib/catalog";

describe("catalog IPC boundary", () => {
  it("uses validated browser fallbacks outside Tauri", async () => {
    await expect(getCatalogStatus()).resolves.toMatchObject({
      state: "missing",
      totalJobs: 0,
    });
    await expect(searchLocalJobs(createSearchQuery({ text: "python" }))).resolves.toEqual({
      items: [],
      nextCursor: null,
      total: 0,
    });
    await expect(getSearchFacets()).resolves.toEqual({
      skills: [],
      locations: [],
      sources: [],
    });
    await expect(getFilterOptions()).resolves.toMatchObject({
      sources: [],
      remoteModes: ["remote", "hybrid", "onsite"],
    });
    await expect(autocompleteSkills("Python")).resolves.toEqual([]);
    await expect(autocompleteLocations("Berlin")).resolves.toEqual([]);
  });

  it("creates a normalized typed search query with an optional bounded cursor", () => {
    expect(
      createSearchQuery({
        text: "  Python backend  ",
        skills: ["Python (computer programming)"],
        locations: ["US"],
        remoteModes: ["remote"],
        seniorities: ["senior"],
        employmentTypes: ["full_time"],
        salaryMinUsdYear: 100_000,
        salaryKnownOnly: true,
        sources: ["greenhouse"],
        sort: "salary",
        cursor: searchCursorSchema.parse("opaque-cursor"),
      }),
    ).toMatchObject({
      text: "Python backend",
      sort: "salary",
      cursor: "opaque-cursor",
    });
  });

  it("accepts only positive decimal string job IDs on the wire", () => {
    expect(jobIdSchema.parse("78719")).toBe("78719");
    expect(() => jobIdSchema.parse(78719)).toThrow();
    expect(() => jobIdSchema.parse("078719")).toThrow();
    expect(() => jobIdSchema.parse("+1")).toThrow();
  });

  it("parses every shared valid Rust/TypeScript fixture", () => {
    expect(catalogStatusSchema.safeParse(contractFixtures.valid.catalogStatus).success).toBe(true);
    expect(searchQuerySchema.safeParse(contractFixtures.valid.searchQuery).success).toBe(true);
    expect(jobSearchPageSchema.safeParse(contractFixtures.valid.searchPage).success).toBe(true);
    expect(jobDetailSchema.safeParse(contractFixtures.valid.jobDetail).success).toBe(true);
    expect(searchFacetsSchema.safeParse(contractFixtures.valid.facets).success).toBe(true);
    expect(
      autocompleteRequestSchema.safeParse(contractFixtures.valid.autocompleteRequest).success,
    ).toBe(true);
    expect(filterOptionsSchema.safeParse(contractFixtures.valid.filterOptions).success).toBe(true);
    expect(skillSuggestionsSchema.safeParse(contractFixtures.valid.skillSuggestions).success).toBe(
      true,
    );
    expect(
      locationSuggestionsSchema.safeParse(contractFixtures.valid.locationSuggestions).success,
    ).toBe(true);
    for (const error of contractFixtures.valid.ipcErrors) {
      expect(ipcErrorSchema.safeParse(error).success).toBe(true);
    }
  });

  it("rejects invalid autocomplete requests before IPC", async () => {
    for (const fixture of contractFixtures.invalidAutocompleteRequests) {
      expect(autocompleteRequestSchema.safeParse(fixture.value).success, fixture.name).toBe(false);
    }
    await expect(autocompleteSkills("Python", 21)).rejects.toThrow();
  });

  it("rejects shared unknown fields, enums, array overflow, cursor overflow, and salary errors", () => {
    for (const fixture of contractFixtures.invalidSearchQueries) {
      expect(searchQuerySchema.safeParse(fixture.value).success, fixture.name).toBe(false);
    }
  });

  it("counts astral Unicode values by scalars at the shared boundary", () => {
    for (const fixture of contractFixtures.unicodeLengthCases) {
      const value = {
        ...contractFixtures.valid.searchQuery,
        text: fixture.scalar.repeat(fixture.count),
      };
      expect(searchQuerySchema.safeParse(value).success, fixture.name).toBe(fixture.valid);
    }
  });

  it("keeps every response object strict, including nested objects", () => {
    for (const fixture of contractFixtures.invalidResponses) {
      const result = (() => {
        switch (fixture.schema) {
          case "catalogStatus":
            return catalogStatusSchema.safeParse(fixture.value);
          case "searchPage":
            return jobSearchPageSchema.safeParse(fixture.value);
          case "jobDetail":
            return jobDetailSchema.safeParse(fixture.value);
          case "facets":
            return searchFacetsSchema.safeParse(fixture.value);
          case "filterOptions":
            return filterOptionsSchema.safeParse(fixture.value);
          case "skillSuggestions":
            return skillSuggestionsSchema.safeParse(fixture.value);
          case "locationSuggestions":
            return locationSuggestionsSchema.safeParse(fixture.value);
          case "ipcError":
            return ipcErrorSchema.safeParse(fixture.value);
          default:
            throw new Error(`Unknown fixture schema: ${fixture.schema}`);
        }
      })();
      expect(result.success, fixture.name).toBe(false);
    }
  });

  it("rejects invalid calls before crossing IPC", async () => {
    expect(() =>
      searchQuerySchema.parse({
        ...createSearchQuery(),
        sort: "match",
      }),
    ).toThrow();
    await expect(searchLocalJobs({ ...createSearchQuery(), limit: 0 })).rejects.toThrow();
  });
});
