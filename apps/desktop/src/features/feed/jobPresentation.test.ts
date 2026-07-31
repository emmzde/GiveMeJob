import { describe, expect, it } from "vitest";

import {
  formatCount,
  formatSalaryRange,
  formatSnapshotDate,
  normalizeJobTitle,
  normalizeSkillLabel,
} from "@/features/feed/jobPresentation";

describe("job presentation formatting", () => {
  it("uses one locale-aware number and salary range format", () => {
    expect(formatCount(78_719)).toBe("78 719");
    expect(
      formatSalaryRange({
        salaryMin: 60_000,
        salaryMax: 65_000,
        salaryCurrency: "USD",
        salaryPeriod: "year",
      }),
    ).toBe("60 000–65 000 USD/год");
    expect(
      formatSalaryRange({ salaryMin: 75_000, salaryMax: null, salaryCurrency: "USD" }),
    ).toBe("75 000 USD");
  });

  it("localizes a valid snapshot date and rejects invalid values", () => {
    expect(formatSnapshotDate("2026-07-29T20:30:03Z")).toBe("29 июля 2026");
    expect(formatSnapshotDate("not-a-date")).toBeNull();
    expect(formatSnapshotDate(null)).toBeNull();
  });

  it("normalizes source title separators and lowercase skill labels for display", () => {
    expect(normalizeJobTitle(" Insurance Services Rep //Remote /Joplin ")).toBe(
      "Insurance Services Rep",
    );
    expect(normalizeJobTitle("Insurance Services Rep / / Remote / Joplin")).toBe(
      "Insurance Services Rep",
    );
    expect(normalizeSkillLabel("communication")).toBe("Communication");
    expect(normalizeSkillLabel("sql")).toBe("SQL");
    expect(normalizeSkillLabel("TypeScript")).toBe("TypeScript");
  });
});
