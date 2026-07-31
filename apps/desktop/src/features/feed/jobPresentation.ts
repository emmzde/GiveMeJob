import type { JobSummary } from "@/lib/catalog";

const shortTechnologyLabels: Readonly<Record<string, string>> = {
  ai: "AI",
  api: "API",
  aws: "AWS",
  css: "CSS",
  gcp: "GCP",
  html: "HTML",
  js: "JS",
  qa: "QA",
  sql: "SQL",
  ui: "UI",
  ux: "UX",
};

export function formatCount(value: number): string {
  return value.toLocaleString("ru-RU");
}

export function formatSnapshotDate(value: string | null): string | null {
  if (value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  })
    .format(date)
    .replace(/\sг\.$/, "");
}

export function formatSalaryRange(
  job: Pick<JobSummary, "salaryCurrency" | "salaryMax" | "salaryMin"> & {
    salaryPeriod?: string | null;
  },
): string | null {
  if (job.salaryMin === null && job.salaryMax === null) return null;
  const formatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
  const values = [job.salaryMin, job.salaryMax].filter(
    (value): value is number => value !== null,
  );
  const range =
    values.length === 2 && values[0] === values[1]
      ? formatter.format(values[0]!)
      : values.map((value) => formatter.format(value)).join("–");
  const period = job.salaryPeriod === "year" ? "/год" : "";
  return `${range} ${job.salaryCurrency ?? ""}${period}`.trim();
}

export function normalizeJobTitle(title: string): string {
  const withoutSourceSuffix = title.split(/\s*(?:\/\s*){2,}/u, 1)[0] ?? title;
  return withoutSourceSuffix
    .trim()
    .replace(/\s*\/{1,}\s*/g, " / ")
    .replace(/\s+/g, " ");
}

export function normalizeSkillLabel(skill: string): string {
  const trimmed = skill.trim().replace(/\s+/g, " ");
  const knownLabel = shortTechnologyLabels[trimmed.toLocaleLowerCase("en-US")];
  if (knownLabel) return knownLabel;
  if (trimmed !== trimmed.toLocaleLowerCase("en-US")) return trimmed;
  return trimmed.replace(/(^|[\s(])\p{L}/gu, (letter) => letter.toLocaleUpperCase("en-US"));
}
