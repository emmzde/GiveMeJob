import type { JobSummary } from "@/lib/catalog";

const countFormatter = new Intl.NumberFormat("ru-RU");
const salaryNumberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});
const snapshotDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});
const postedDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const salaryPeriodLabels: Readonly<Record<string, string>> = {
  day: "/день",
  hour: "/час",
  month: "/месяц",
  week: "/неделю",
  year: "/год",
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

export function formatSnapshotDate(value: string | null): string | null {
  if (value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return snapshotDateFormatter
    .format(date)
    .replace(/\sг\.$/, "");
}

export function formatPostedDate(value: string | null): string | null {
  if (value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return postedDateFormatter.format(date).replace(/\sг\.$/, "");
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
    amount = `от ${salaryNumberFormatter.format(minimum)}`;
  } else if (maximum !== null) {
    amount = `до ${salaryNumberFormatter.format(maximum)}`;
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
