import { useVirtualizer } from "@tanstack/react-virtual";
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CircleDollarSign,
  MapPin,
  Wifi,
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { useAppUiStore } from "@/app/store/appUiStore";
import {
  formatPostedDate,
  formatSalaryRange,
  normalizeJobTitle,
} from "@/features/feed/jobPresentation";
import {
  remoteModeLabels,
  seniorityLabels,
} from "@/features/feed/searchLabels";
import { CompanyAvatar } from "@/components/ui/company-avatar";
import { MatchBadge } from "@/features/match/MatchBadge";
import { useJobMatches } from "@/features/match/hooks";
import { ShortlistButton } from "@/features/shortlist/ShortlistButton";
import type { JobSummary, SearchCursor } from "@/lib/catalog";
import { isEditableTarget } from "@/lib/keyboard";
import { t } from "@/lib/i18n";

interface FeedProps {
  jobs: readonly JobSummary[];
  isCatalogReady: boolean;
  isInitialLoading: boolean;
  isFetching: boolean;
  errorMessage: string | null;
  nextCursor: SearchCursor | null;
  isFetchingNextPage: boolean;
  canLoadNextPage: boolean;
  onLoadMore(): void;
}

const initialSkeletonRows = [0, 1, 2, 3, 4] as const;
const nextPageSkeletonRows = 3;
const feedOverscan = 4;
const loadMoreThreshold = 4;
const virtualizationThreshold = 50;
const jobRowEstimate = 116;

function SkeletonRow({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`space-y-2 px-4 ${compact ? "py-2.5" : "py-3"}`}>
      <div className="h-4 w-2/3 animate-pulse rounded-[var(--radius-sm)] bg-[var(--bg-active)]" />
      <div className="h-3 w-1/3 animate-pulse rounded-[var(--radius-sm)] bg-[var(--bg-active)]" />
      <div className="h-3 w-1/2 animate-pulse rounded-[var(--radius-sm)] bg-[var(--bg-active)]" />
    </div>
  );
}

function JobListSkeleton() {
  return (
    <div aria-hidden="true" data-testid="initial-search-skeleton">
      {initialSkeletonRows.map((row) => (
        <div className="px-1.5 py-px" key={row}>
          <SkeletonRow />
        </div>
      ))}
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="grid min-h-48 place-content-center px-6 text-center">
      <p className="text-sm font-medium">{t("empty")}</p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">{t("emptyHint")}</p>
    </div>
  );
}

export function Feed({
  jobs,
  isCatalogReady,
  isInitialLoading,
  isFetching,
  errorMessage,
  nextCursor,
  isFetchingNextPage,
  canLoadNextPage,
  onLoadMore,
}: FeedProps) {
  const selectedId = useAppUiStore((state) => state.selectedId);
  const selectJob = useAppUiStore((state) => state.selectJob);
  const screen = useAppUiStore((state) => state.screen);
  const jobIds = useMemo(() => jobs.map((job) => job.id), [jobs]);
  const matches = useJobMatches(jobIds);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestedCursor = useRef<SearchCursor | null>(null);
  const skeletonCount = isFetchingNextPage ? nextPageSkeletonRows : 0;
  const rowCount = jobs.length + skeletonCount;
  const shouldVirtualize = jobs.length > virtualizationThreshold;
  // TanStack Virtual intentionally exposes mutable measurement methods.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rowCount,
    enabled: shouldVirtualize,
    estimateSize: () => jobRowEstimate,
    getItemKey: (index) => jobs[index]?.id ?? `next-page-skeleton-${index - jobs.length}`,
    getScrollElement: () => scrollRef.current,
    initialRect: { height: 640, width: 520 },
    overscan: feedOverscan,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const lastVirtualIndex = virtualRows.at(-1)?.index;

  useEffect(() => {
    if (
      !shouldVirtualize ||
      !canLoadNextPage ||
      nextCursor === null ||
      lastVirtualIndex === undefined ||
      lastVirtualIndex < jobs.length - loadMoreThreshold ||
      requestedCursor.current === nextCursor
    ) {
      return;
    }

    requestedCursor.current = nextCursor;
    onLoadMore();
  }, [canLoadNextPage, jobs.length, lastVirtualIndex, nextCursor, onLoadMore, shouldVirtualize]);

  useEffect(() => {
    if (shouldVirtualize || !canLoadNextPage || nextCursor === null) return;
    const scrollElement = scrollRef.current;
    if (scrollElement === null) return;

    function loadWhenNearStaticEnd(element: HTMLDivElement): void {
      const remaining =
        element.scrollHeight - element.scrollTop - element.clientHeight;
      if (
        remaining > jobRowEstimate * loadMoreThreshold ||
        requestedCursor.current === nextCursor
      ) {
        return;
      }
      requestedCursor.current = nextCursor;
      onLoadMore();
    }

    const handleScroll = () => loadWhenNearStaticEnd(scrollElement);
    handleScroll();
    scrollElement.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollElement.removeEventListener("scroll", handleScroll);
  }, [canLoadNextPage, nextCursor, onLoadMore, shouldVirtualize]);

  useEffect(() => {
    function handleNavigation(event: KeyboardEvent): void {
      if (
        screen !== "search" ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }
      const isArrow = event.key === "ArrowDown" || event.key === "ArrowUp";
      if (isArrow && !scrollRef.current?.contains(document.activeElement)) return;
      const delta =
        event.key === "j" || event.key === "ArrowDown"
          ? 1
          : event.key === "k" || event.key === "ArrowUp"
            ? -1
            : 0;
      if (delta === 0 || jobs.length === 0) return;
      event.preventDefault();
      const currentIndex = jobs.findIndex((job) => job.id === selectedId);
      const nextIndex = Math.max(0, Math.min(jobs.length - 1, currentIndex + delta));
      const nextJob = jobs[nextIndex];
      if (!nextJob) return;
      selectJob(nextJob.id);
      if (shouldVirtualize) virtualizer.scrollToIndex(nextIndex, { align: "auto" });
      requestAnimationFrame(() => {
        const nextRow = scrollRef.current?.querySelector<HTMLButtonElement>(
          `[data-job-id="${nextJob.id}"]`,
        );
        if (!shouldVirtualize) nextRow?.scrollIntoView?.({ block: "nearest" });
        nextRow?.focus();
      });
    }

    window.addEventListener("keydown", handleNavigation);
    return () => window.removeEventListener("keydown", handleNavigation);
  }, [jobs, screen, selectJob, selectedId, shouldVirtualize, virtualizer]);

  function renderJob(job: JobSummary, index: number) {
    const salary = formatSalaryRange(job);
    const postedDate = formatPostedDate(job.postedAt);
    const isSelected = selectedId === job.id;
    return (
      <div
        aria-posinset={index + 1}
        aria-setsize={jobs.length}
        className="job-feed-item relative"
        role="listitem"
      >
        <button
          aria-current={isSelected ? "true" : undefined}
          className={`job-feed-row group block w-full border px-5 py-4 pr-14 text-left transition-[background-color,border-color] duration-300 ease-[var(--ease)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${
            isSelected
              ? "border-[var(--border-strong)] bg-[var(--surface-active)]"
              : "border-transparent hover:bg-[var(--bg-hover)]"
          }`}
          data-job-id={job.id}
          data-selected={isSelected ? "true" : "false"}
          onClick={() => selectJob(job.id)}
          tabIndex={selectedId === job.id || (selectedId === null && index === 0) ? 0 : -1}
          type="button"
        >
          <span className="flex min-w-0 items-start gap-3">
            <CompanyAvatar className="job-company-avatar" name={job.company} />
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-start gap-2">
              <span className="min-w-0 flex-1">
                <span
                  className="job-feed-title block truncate text-[15px] font-semibold leading-5 tracking-[-0.015em] text-[var(--text)]"
                >
                  {normalizeJobTitle(job.title)}
                </span>
                <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] leading-4 text-[var(--text-secondary)]">
                  <span className="truncate">{job.company}</span>
                  <span aria-hidden="true" className="text-[var(--text-tertiary)]">·</span>
                  <MapPin aria-hidden="true" className="size-3 shrink-0" />
                  <span className="max-w-40 truncate">{job.locationText || "—"}</span>
                </span>
              </span>
              <MatchBadge
                breakdown={matches.byJobId.get(job.id)}
                hasProfile={matches.hasProfile}
                isLoading={matches.isPending}
              />
              </span>
              <span className="job-feed-secondary mt-3 flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-2 text-[12px] leading-4 text-[var(--text-tertiary)]">
              {job.remoteMode ? (
                <span className="job-mode-badge inline-flex items-center gap-1.5">
                  <Wifi aria-hidden="true" className="size-3 shrink-0" />
                  {remoteModeLabels[job.remoteMode]}
                </span>
              ) : null}
              {job.seniority ? (
                <span className="inline-flex items-center gap-1">
                  <ChartNoAxesColumnIncreasing aria-hidden="true" className="size-3.5 shrink-0" />
                  {seniorityLabels[job.seniority]}
                </span>
              ) : null}
              <span className="job-salary inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
                <CircleDollarSign aria-hidden="true" className="size-3.5 shrink-0" />
                {salary ?? t("salaryNotSpecified")}
              </span>
              {postedDate ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />
                  {t("posted")} {postedDate}
                </span>
              ) : null}
              </span>
            </span>
          </span>
        </button>
        <span className="absolute right-4 top-4">
          <ShortlistButton compact jobId={job.id} />
        </span>
      </div>
    );
  }

  const showEndState =
    isCatalogReady &&
    jobs.length > 0 &&
    nextCursor === null &&
    !isFetching &&
    errorMessage === null;

  return (
    <div
      aria-busy={isFetching}
      aria-label={t("searchResults")}
      className="job-feed-region scroll-region min-h-0 flex-1 overflow-y-auto overscroll-contain"
      ref={scrollRef}
      role="region"
    >
      {isInitialLoading && jobs.length === 0 ? <JobListSkeleton /> : null}
      {isCatalogReady && !isFetching && !errorMessage && jobs.length === 0 ? (
        <EmptyFeed />
      ) : null}
      {jobs.length > 0 ? (
        shouldVirtualize ? (
          <div
            aria-label={t("jobsList")}
            className="relative w-full"
            data-virtualized="true"
            role="list"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualRows.map((row) => {
              const job = jobs[row.index];
              return (
                <div
                  className="absolute left-0 top-0 w-full"
                  data-index={row.index}
                  key={row.key}
                  ref={virtualizer.measureElement}
                  role="presentation"
                  style={{ transform: `translateY(${row.start}px)` }}
                >
                  {job ? (
                    renderJob(job, row.index)
                  ) : (
                    <div aria-hidden="true" data-testid="next-page-skeleton">
                      <SkeletonRow compact />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div aria-label={t("jobsList")} role="list">
            {jobs.map((job, index) => (
              <div key={job.id} role="presentation">{renderJob(job, index)}</div>
            ))}
            {Array.from({ length: skeletonCount }, (_, index) => (
              <div
                aria-hidden="true"
                className="px-1.5 py-px"
                data-testid="next-page-skeleton"
                key={`fallback-skeleton-${index}`}
              >
                <SkeletonRow compact />
              </div>
            ))}
          </div>
        )
      ) : null}
      {isFetchingNextPage ? (
        <p aria-live="polite" className="sr-only" role="status">
          {t("nextPageLoading")}
        </p>
      ) : null}
      {showEndState ? (
        <p
          className="border-t border-[var(--border)] px-4 py-5 text-center text-xs text-[var(--text-tertiary)]"
          data-testid="end-of-results"
        >
          {t("endOfResults")}
        </p>
      ) : null}
    </div>
  );
}
