import { useVirtualizer } from "@tanstack/react-virtual";
import { Building2, CircleDollarSign, MapPin } from "lucide-react";
import { useEffect, useRef } from "react";

import { useAppUiStore } from "@/app/store/appUiStore";
import { Button } from "@/components/ui/button";
import {
  formatSalaryRange,
  normalizeJobTitle,
} from "@/features/feed/jobPresentation";
import type { JobSummary } from "@/lib/catalog";
import { t } from "@/lib/i18n";

interface FeedProps {
  jobs: readonly JobSummary[];
  isCatalogReady: boolean;
  isInitialLoading: boolean;
  isFetching: boolean;
  errorMessage: string | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore(): void;
}

const skeletonRows = [0, 1, 2, 3, 4] as const;

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
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: FeedProps) {
  const selectedId = useAppUiStore((state) => state.selectedId);
  const selectJob = useAppUiStore((state) => state.selectJob);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowCount = jobs.length + (hasNextPage ? 1 : 0);
  // TanStack Virtual intentionally exposes mutable measurement methods.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rowCount,
    estimateSize: () => 94,
    getScrollElement: () => scrollRef.current,
    initialRect: { height: 640, width: 520 },
    overscan: 5,
  });

  useEffect(() => {
    function handleNavigation(event: KeyboardEvent): void {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      const isArrow = event.key === "ArrowDown" || event.key === "ArrowUp";
      if (isArrow && !scrollRef.current?.contains(document.activeElement)) return;
      const delta = event.key === "j" || event.key === "ArrowDown" ? 1 : event.key === "k" || event.key === "ArrowUp" ? -1 : 0;
      if (delta === 0 || jobs.length === 0) return;
      event.preventDefault();
      const currentIndex = jobs.findIndex((job) => job.id === selectedId);
      const nextIndex = Math.max(0, Math.min(jobs.length - 1, currentIndex + delta));
      const nextJob = jobs[nextIndex];
      if (!nextJob) return;
      selectJob(nextJob.id);
      virtualizer.scrollToIndex(nextIndex, { align: "auto" });
      requestAnimationFrame(() => {
        scrollRef.current
          ?.querySelector<HTMLButtonElement>(`[data-job-id="${nextJob.id}"]`)
          ?.focus();
      });
    }

    window.addEventListener("keydown", handleNavigation);
    return () => window.removeEventListener("keydown", handleNavigation);
  }, [jobs, selectJob, selectedId, virtualizer]);

  function renderJob(job: JobSummary) {
    const salary = formatSalaryRange(job);
    const isSelected = selectedId === job.id;
    return (
      <button
        aria-current={isSelected ? "true" : undefined}
        className={`block min-h-[94px] w-full border-l-[3px] px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${
          isSelected
            ? "border-l-[var(--accent)] bg-[var(--accent-muted)]"
            : "border-l-transparent hover:bg-[var(--bg-hover)]"
        }`}
        data-job-id={job.id}
        data-selected={isSelected ? "true" : "false"}
        key={job.id}
        onClick={() => selectJob(job.id)}
        type="button"
      >
        <span className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-raised)] text-xs font-semibold text-[var(--text-secondary)]"
          >
            {job.company.slice(0, 1).toLocaleUpperCase("ru-RU") || <Building2 className="size-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-sm ${isSelected ? "font-semibold" : "font-medium"}`}>
              {normalizeJobTitle(job.title)}
            </span>
            <span className="mt-0.5 block truncate text-xs font-medium text-[var(--text-secondary)]">
              {job.company}
            </span>
          </span>
        </span>
        <span className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 pl-12 text-xs text-[var(--text-secondary)]">
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{job.locationText || "—"}</span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <CircleDollarSign aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{salary ?? t("salaryNotSpecified")}</span>
          </span>
        </span>
      </button>
    );
  }

  function renderLoadMore() {
    return hasNextPage ? (
      <div className="flex min-h-[70px] items-center justify-center border-t border-[var(--border)] px-4 py-3">
        <Button disabled={isFetchingNextPage} onClick={onLoadMore} type="button" variant="outline">
          {isFetchingNextPage ? t("loadingMore") : t("loadMore")}
        </Button>
      </div>
    ) : null;
  }

  return (
    <div
      aria-busy={isFetching}
      className="scroll-region min-h-0 flex-1 overflow-y-auto"
      ref={scrollRef}
    >
      {isInitialLoading && jobs.length === 0 ? <JobListSkeleton /> : null}
      {isCatalogReady && !isFetching && !errorMessage && jobs.length === 0 ? (
        <p className="p-6 text-sm text-[var(--text-secondary)]">{t("empty")}</p>
      ) : null}
      {jobs.length <= 50 ? (
        <div className="divide-y divide-[var(--border)]">
          {jobs.map(renderJob)}
          {renderLoadMore()}
        </div>
      ) : (
        <div className="relative w-full" data-virtualized="true" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((row) => {
            const job = jobs[row.index];
            return (
              <div
                className="absolute left-0 top-0 w-full border-b border-[var(--border)]"
                key={row.key}
                style={{ height: row.size, transform: `translateY(${row.start}px)` }}
              >
                {job ? renderJob(job) : renderLoadMore()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
