import { describe, expect, it } from "vitest";

import {
  formatCount,
  formatPostedDate,
  formatSalaryRange,
  formatSalaryPeriod,
  formatSnapshotDate,
  normalizeJobTitle,
  normalizeSkillLabel,
} from "@/features/feed/jobPresentation";

describe("job presentation formatting", () => {
  it("uses one locale-aware number formatter for ranges and one-sided salaries", () => {
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
    ).toBe("от 75 000 USD");
    expect(
      formatSalaryRange({ salaryMin: null, salaryMax: 90_000, salaryCurrency: "eur" }),
    ).toBe("до 90 000 EUR");
    expect(
      formatSalaryRange({
        salaryMin: 50,
        salaryMax: 50,
        salaryCurrency: "USD",
        salaryPeriod: "hour",
      }),
    ).toBe("50 USD/час");
  });

  it("localizes every salary period present in the frozen catalog", () => {
    expect(formatSalaryPeriod("year")).toBe("/год");
    expect(formatSalaryPeriod("month")).toBe("/месяц");
    expect(formatSalaryPeriod("week")).toBe("/неделю");
    expect(formatSalaryPeriod("hour")).toBe("/час");
    expect(formatSalaryPeriod(null)).toBe("");
    expect(formatSalaryPeriod("unknown")).toBe("");
  });

  it("localizes a valid snapshot date and rejects invalid values", () => {
    expect(formatSnapshotDate("2026-07-29T20:30:03Z")).toBe("29 июля 2026");
    expect(formatSnapshotDate("not-a-date")).toBeNull();
    expect(formatSnapshotDate(null)).toBeNull();
  });

  it("localizes posted dates without depending on the system timezone", () => {
    expect(formatPostedDate("2026-07-30T23:30:00-07:00")).toBe("31 июл. 2026");
    expect(formatPostedDate("not-a-date")).toBeNull();
    expect(formatPostedDate(null)).toBeNull();
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
