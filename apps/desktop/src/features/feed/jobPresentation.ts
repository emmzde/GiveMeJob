import type { JobSummary } from "@/lib/catalog";
import { getLocaleTag, t } from "@/lib/i18n";

const localeTag = getLocaleTag();
const countFormatter = new Intl.NumberFormat(localeTag);
const salaryNumberFormatter = new Intl.NumberFormat(localeTag, {
  maximumFractionDigits: 0,
});
const snapshotDateFormatter = new Intl.DateTimeFormat(localeTag, {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});
const postedDateFormatter = new Intl.DateTimeFormat(localeTag, {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const salaryPeriodLabels: Readonly<Record<string, string>> = {
  day: t("salaryPerDay"),
  hour: t("salaryPerHour"),
  month: t("salaryPerMonth"),
  week: t("salaryPerWeek"),
  year: t("salaryPerYear"),
};

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
  return countFormatter.format(value);
}

function formatDate(formatter: Intl.DateTimeFormat, date: Date): string {
  return formatter
    .formatToParts(date)
    .filter(({ type }) => type === "day" || type === "month" || type === "year")
    .map(({ value }) => value.trim())
    .filter(Boolean)
    .join(" ");
}

export function formatSnapshotDate(value: string | null): string | null {
  if (value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatDate(snapshotDateFormatter, date);
}

export function formatPostedDate(value: string | null): string | null {
  if (value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatDate(postedDateFormatter, date);
}

export function formatSalaryPeriod(value: string | null | undefined): string {
  if (!value) return "";
  return salaryPeriodLabels[value.trim().toLocaleLowerCase("en-US")] ?? "";
}

export function formatSalaryRange(
  job: Pick<JobSummary, "salaryCurrency" | "salaryMax" | "salaryMin"> & {
    salaryPeriod?: string | null;
  },
): string | null {
  const minimum = job.salaryMin;
  const maximum = job.salaryMax;
  if (minimum === null && maximum === null) return null;
  let amount: string;
  if (minimum !== null && maximum !== null) {
    amount =
      minimum === maximum
        ? salaryNumberFormatter.format(minimum)
        : `${salaryNumberFormatter.format(minimum)}–${salaryNumberFormatter.format(maximum)}`;
  } else if (minimum !== null) {
    amount = `${t("salaryFrom")} ${salaryNumberFormatter.format(minimum)}`;
  } else if (maximum !== null) {
    amount = `${t("salaryTo")} ${salaryNumberFormatter.format(maximum)}`;
  } else {
    return null;
  }

  const currency = job.salaryCurrency?.trim();
  const normalizedCurrency =
    currency && /^[a-z]{3}$/iu.test(currency)
      ? currency.toLocaleUpperCase("en-US")
      : currency;
  const period = formatSalaryPeriod(job.salaryPeriod);
  return `${amount}${normalizedCurrency ? ` ${normalizedCurrency}` : ""}${period}`;
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
