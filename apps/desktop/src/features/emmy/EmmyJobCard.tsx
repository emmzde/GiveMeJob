import { ArrowUpRight, BriefcaseBusiness, MapPin } from "lucide-react";

import {
  formatPostedDate,
  formatSalaryRange,
  normalizeJobTitle,
} from "@/features/feed/jobPresentation";
import type { JobSummary } from "@/lib/catalog";
import { t } from "@/lib/i18n";

export function EmmyJobCard({
  job,
  onOpen,
}: {
  job: JobSummary;
  onOpen(job: JobSummary): void;
}) {
  const salary = formatSalaryRange(job);
  const posted = formatPostedDate(job.postedAt);
  return (
    <article className="border-b border-[var(--border)] py-3 last:border-b-0">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-[var(--text-secondary)]">
          <BriefcaseBusiness aria-hidden="true" className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <button
            className="group flex w-full items-start gap-1 text-left text-[13px] font-semibold leading-5 text-[var(--text)] hover:text-[var(--accent)]"
            onClick={() => onOpen(job)}
            type="button"
          >
            <span className="min-w-0 flex-1">{normalizeJobTitle(job.title)}</span>
            <ArrowUpRight aria-hidden="true" className="mt-px size-3.5 shrink-0 text-[var(--text-tertiary)] group-hover:text-[var(--accent)]" />
          </button>
          <p className="mt-0.5 truncate text-xs leading-4 text-[var(--text-secondary)]">{job.company}</p>
        </div>
      </div>
      <div className="mt-2 grid gap-1 pl-9 text-[11px] leading-4 text-[var(--text-tertiary)]">
        <span className="flex min-w-0 items-center gap-1">
          <MapPin aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">{job.locationText || t("profileNoValue")}</span>
        </span>
        <span className="flex flex-wrap gap-x-1.5">
          <span className="ui-mono">{salary ?? t("salaryNotSpecified")}</span>
          {posted ? <><span aria-hidden="true">·</span><span className="ui-mono">{posted}</span></> : null}
          <span aria-hidden="true">·</span>
          <span>{job.attribution}</span>
        </span>
      </div>
    </article>
  );
}
