import { describe, expect, it } from "vitest";

import {
  employmentTypeLabels,
  formatSourceLabel,
  locationKindLabels,
  remoteModeLabels,
  searchSortLabels,
  seniorityLabels,
} from "@/features/feed/searchLabels";

describe("localized search labels", () => {
  it("defines user-facing labels for every closed enum value", () => {
    expect(Object.keys(searchSortLabels)).toEqual(["relevance", "newest", "salary"]);
    expect(Object.keys(remoteModeLabels)).toEqual(["remote", "hybrid", "onsite"]);
    expect(Object.keys(seniorityLabels)).toHaveLength(10);
    expect(Object.keys(employmentTypeLabels)).toHaveLength(7);
    expect(Object.keys(locationKindLabels)).toEqual(["country", "city", "location_text"]);
    expect(Object.values(searchSortLabels).every((label) => label.length > 0)).toBe(true);
  });

  it("formats opaque source identifiers without treating them as enums", () => {
    expect(formatSourceLabel("greenhouse")).toBe("Greenhouse");
    expect(formatSourceLabel("")).toBe("");
  });
});
