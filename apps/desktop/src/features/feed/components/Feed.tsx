import { ChevronRight, CircleDollarSign, MapPin } from "lucide-react";

import { useAppUiStore } from "@/app/store/appUiStore";
import type { JobSummary } from "@/lib/catalog";
import { t } from "@/lib/i18n";

interface FeedProps {
  jobs: readonly JobSummary[];
  isCatalogReady: boolean;
  isInitialLoading: boolean;
  isFetching: boolean;
  errorMessage: string | null;
}

const skeletonRows = [0, 1, 2, 3, 4] as const;

function formatSalary(job: JobSummary): string | null {
  if (job.salaryMin === null && job.salaryMax === null) return null;
  const formatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
  const range = [job.salaryMin, job.salaryMax]
    .filter((value): value is number => value !== null)
    .map((value) => formatter.format(value))
    .join("–");
  return `${range} ${job.salaryCurrency ?? ""}`.trim();
}

function JobListSkeleton() {
  return (
    <div aria-hidden="true" data-testid="initial-search-skeleton">
      {skeletonRows.map((row) => (
        <div className="space-y-2 border-b border-[var(--border)] px-4 py-4" key={row}>
          <div className="h-4 w-2/3 animate-pulse rounded-[var(--radius-sm)] bg-[var(--bg-active)]" />
          <div className="h-3 w-1/3 animate-pulse rounded-[var(--radius-sm)] bg-[var(--bg-active)]" />
          <div className="h-3 w-1/2 animate-pulse rounded-[var(--radius-sm)] bg-[var(--bg-active)]" />
        </div>
      ))}
    </div>
  );
}

export function Feed({
  jobs,
  isCatalogReady,
  isInitialLoading,
  isFetching,
  errorMessage,
}: FeedProps) {
  const selectedId = useAppUiStore((state) => state.selectedId);
  const selectJob = useAppUiStore((state) => state.selectJob);

  return (
    <div aria-busy={isFetching} className="divide-y divide-[var(--border)]">
      {isInitialLoading && jobs.length === 0 ? <JobListSkeleton /> : null}
      {isCatalogReady && !isFetching && !errorMessage && jobs.length === 0 ? (
        <p className="p-6 text-sm text-[var(--text-secondary)]">{t("empty")}</p>
      ) : null}
      {jobs.map((job) => {
        const salary = formatSalary(job);
        return (
          <button
            className={`block w-full px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${
              selectedId === job.id
                ? "bg-[var(--bg-active)]"
                : "hover:bg-[var(--bg-raised)]"
            }`}
            key={job.id}
            onClick={() => selectJob(job.id)}
            type="button"
          >
            <span className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-sm font-medium">{job.title}</span>
                <span className="mt-1 block text-xs text-[var(--text-secondary)]">
                  {job.company}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-[var(--text-tertiary)]"
              />
            </span>
            <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
              {job.locationText ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden="true" className="size-3.5" />
                  {job.locationText}
                </span>
              ) : null}
              {salary ? (
                <span className="inline-flex items-center gap-1">
                  <CircleDollarSign aria-hidden="true" className="size-3.5" />
                  {salary}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
