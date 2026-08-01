import { ArrowUpRight } from "lucide-react";

import { formatSalaryRange, normalizeJobTitle } from "@/features/feed/jobPresentation";
import type { EmmyComparison } from "@/lib/emmy";
import { t } from "@/lib/i18n";

export function EmmyComparisonTable({
  comparison,
  onOpen,
}: {
  comparison: EmmyComparison;
  onOpen(jobId: EmmyComparison["rows"][number]["job"]["summary"]["id"]): void;
}) {
  return (
    <div className="mt-2 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-0)]">
      <table className="min-w-[520px] border-collapse text-[11px] leading-4">
        <caption className="sr-only">{t("emmyComparison")}</caption>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-24 border-b border-r border-[var(--border)] bg-[var(--surface-1)] p-2 text-left font-medium text-[var(--text-tertiary)]" scope="col">
              {t("emmyComparisonCriterion")}
            </th>
            {comparison.rows.map(({ job }) => (
              <th className="min-w-32 border-b border-[var(--border)] bg-[var(--surface-1)] p-2 text-left align-top font-semibold" key={job.summary.id} scope="col">
                <button className="flex items-start gap-1 text-left hover:text-[var(--accent)]" onClick={() => onOpen(job.summary.id)} type="button">
                  <span>{normalizeJobTitle(job.summary.title)}</span>
                  <ArrowUpRight aria-hidden="true" className="mt-px size-3 shrink-0" />
                </button>
                <span className="mt-0.5 block font-normal text-[var(--text-tertiary)]">{job.summary.company}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <ComparisonRow label={t("location")} values={comparison.rows.map(({ job }) => job.summary.locationText || t("profileNoValue"))} />
          <ComparisonRow label={t("workMode")} values={comparison.rows.map(({ job }) => job.summary.remoteMode ? t(job.summary.remoteMode === "remote" ? "remoteModeRemote" : job.summary.remoteMode === "hybrid" ? "remoteModeHybrid" : "remoteModeOnsite") : t("profileNoValue"))} />
          <ComparisonRow label={t("seniority")} values={comparison.rows.map(({ job }) => seniorityLabel(job.summary.seniority))} />
          <ComparisonRow label={t("salary")} values={comparison.rows.map(({ job }) => formatSalaryRange(job.summary) ?? t("salaryNotSpecified"))} />
          <ComparisonRow label={t("matchLabel")} values={comparison.rows.map(({ matchBreakdown }) => matchBreakdown ? `${matchBreakdown.score}%` : t("matchUnknown"))} />
        </tbody>
      </table>
    </div>
  );
}

function seniorityLabel(value: EmmyComparison["rows"][number]["job"]["summary"]["seniority"]): string {
  switch (value) {
    case "intern": return t("seniorityIntern");
    case "junior": return t("seniorityJunior");
    case "middle": return t("seniorityMiddle");
    case "senior": return t("senioritySenior");
    case "lead": return t("seniorityLead");
    case "staff": return t("seniorityStaff");
    case "principal": return t("seniorityPrincipal");
    case "manager": return t("seniorityManager");
    case "director": return t("seniorityDirector");
    case "executive": return t("seniorityExecutive");
    case null: return t("profileNoValue");
  }
}

function ComparisonRow({ label, values }: { label: string; values: readonly string[] }) {
  return (
    <tr>
      <th className="sticky left-0 border-b border-r border-[var(--border)] bg-[var(--surface-0)] p-2 text-left align-top font-medium text-[var(--text-tertiary)] last:border-b-0" scope="row">
        {label}
      </th>
      {values.map((value, index) => (
        <td className="border-b border-[var(--border)] p-2 align-top text-[var(--text-secondary)] last:border-b-0" key={`${index}-${value}`}>
          {value}
        </td>
      ))}
    </tr>
  );
}
