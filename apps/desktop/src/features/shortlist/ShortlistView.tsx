import { useQueries } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Bookmark, CalendarDays, MapPin } from "lucide-react";
import { useMemo, useRef } from "react";

import { useAppUiStore } from "@/app/store/appUiStore";
import { Button } from "@/components/ui/button";
import {
  formatSalaryRange,
  normalizeJobTitle,
} from "@/features/feed/jobPresentation";
import { MatchBadge } from "@/features/match/MatchBadge";
import { useJobMatches } from "@/features/match/hooks";
import { ShortlistButton } from "@/features/shortlist/ShortlistButton";
import { useShortlistRecords } from "@/features/shortlist/hooks";
import { jobDetailQueryKey } from "@/features/job/hooks/useJobDetail";
import { getLocalJob } from "@/lib/catalog";
import type { JobId } from "@/lib/catalog";
import { getLocaleTag, t } from "@/lib/i18n";

const VIRTUALIZATION_THRESHOLD = 50;
const ROW_ESTIMATE = 92;

export function ShortlistView({ catalogVersion }: { catalogVersion: string | null }) {
  const setScreen = useAppUiStore((state) => state.setScreen);
  const selectJob = useAppUiStore((state) => state.selectJob);
  const shortlist = useShortlistRecords();
  const records = useMemo(() => shortlist.data ?? [], [shortlist.data]);
  const currentRecords = useMemo(
    () => records.filter((record) => record.catalogVersion === catalogVersion),
    [catalogVersion, records],
  );
  const currentIds = useMemo(
    () => currentRecords.map((record) => record.jobId),
    [currentRecords],
  );
  const matches = useJobMatches(currentIds);
  const detailQueries = useQueries({
    queries: records.map((record) => ({
      enabled: record.catalogVersion === catalogVersion,
      queryFn: () => getLocalJob(record.jobId),
      queryKey: jobDetailQueryKey(record.jobId),
      retry: false,
      staleTime: Number.POSITIVE_INFINITY,
    })),
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = records.length > VIRTUALIZATION_THRESHOLD;
  // TanStack Virtual intentionally exposes mutable measurement methods.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: records.length,
    enabled: shouldVirtualize,
    estimateSize: () => ROW_ESTIMATE,
    getScrollElement: () => scrollRef.current,
    initialRect: { height: 640, width: 720 },
    overscan: 5,
  });

  function openJob(jobId: JobId): void {
    setScreen("search");
    selectJob(jobId);
  }

  function renderRow(index: number) {
    const record = records[index];
    if (!record) return null;
    const query = detailQueries[index];
    const isCurrentCatalog = record.catalogVersion === catalogVersion;
    const job = isCurrentCatalog ? query?.data : undefined;
    return (
      <div className="shortlist-row flex min-h-[88px] items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          {query?.isPending && isCurrentCatalog ? (
            <div aria-label={t("openShortlistJob")} className="space-y-2" role="status">
              <div className="h-4 w-2/3 animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface-active)]" />
              <div className="h-3 w-1/3 animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface-active)]" />
            </div>
          ) : job ? (
            <>
              <button
                className="block max-w-full text-left focus-visible:rounded-[var(--radius-sm)]"
                onClick={() => openJob(job.id)}
                type="button"
              >
                <span className="block break-words text-[13px] font-semibold leading-5">
                  {normalizeJobTitle(job.title)}
                </span>
                <span className="mt-0.5 block truncate text-xs text-[var(--text-secondary)]">
                  {job.company}
                </span>
              </button>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-tertiary)]">
                {job.locationText ? (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                    <span className="max-w-48 truncate">{job.locationText}</span>
                  </span>
                ) : null}
                <span>{formatSalaryRange(job) ?? t("salaryNotSpecified")}</span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays aria-hidden="true" className="size-3.5" />
                  {t("shortlistSavedAt")} {new Intl.DateTimeFormat(getLocaleTag(), { dateStyle: "medium" }).format(new Date(record.savedAt))}
                </span>
              </div>
            </>
          ) : (
            <div>
              <p className="text-[13px] font-medium">{t("shortlistJobUnavailable")}</p>
              <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                ID {record.jobId} · catalog {record.catalogVersion}
              </p>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {job ? (
            <MatchBadge
              breakdown={matches.byJobId.get(job.id)}
              hasProfile={matches.hasProfile}
              isLoading={matches.isPending}
            />
          ) : null}
          <ShortlistButton compact jobId={record.jobId} />
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-page shortlist-page">
      <section className="workspace-frame shortlist-workspace">
      <header className="workspace-header">
          <div className="flex min-w-0 items-start gap-3">
            <span aria-hidden="true" className="workspace-header-glyph"><Bookmark className="size-4" /></span>
            <div className="min-w-0">
            <h1 className="workspace-title">{t("shortlistTitle")}</h1>
            <p className="workspace-description">
              {t("shortlistDescription")}
            </p>
            </div>
          </div>
          {!shortlist.isPending && !shortlist.isError ? (
            <span className="workspace-count ui-mono mt-1 text-xs text-[var(--text-secondary)]">
              {records.length}
            </span>
          ) : null}
      </header>
      {shortlist.isPending ? (
        <div className="divide-y divide-[var(--border)]" role="status" aria-label={t("shortlistTitle")}>
          <div className="h-[88px] animate-pulse bg-[var(--surface-1)]" />
          <div className="h-[88px] animate-pulse bg-[var(--surface-1)]" />
          <div className="h-[88px] animate-pulse bg-[var(--surface-1)]" />
        </div>
      ) : null}
      {shortlist.isError ? (
        <div className="m-4 alert-card" role="alert">
          <p>{t("shortlistLoadError")}</p>
          <Button className="mt-3" onClick={() => void shortlist.refetch()} type="button" variant="outline">
            {t("shortlistRetry")}
          </Button>
        </div>
      ) : null}
      {!shortlist.isPending && !shortlist.isError && records.length === 0 ? (
        <div className="grid min-h-0 flex-1 place-content-center px-6 text-center">
          <span aria-hidden="true" className="empty-state-glyph mx-auto"><Bookmark className="size-5" /></span>
          <h2 className="mt-3 text-sm font-semibold">{t("shortlistEmpty")}</h2>
          <p className="mt-2 max-w-sm text-xs leading-5 text-[var(--text-secondary)]">
            {t("shortlistEmptyHint")}
          </p>
          <Button className="mx-auto mt-5" onClick={() => setScreen("search")} type="button">
            {t("jobs")}
          </Button>
        </div>
      ) : null}
      {!shortlist.isPending && !shortlist.isError && records.length > 0 ? (
        <div className="shortlist-list scroll-region min-h-0 flex-1 overflow-y-auto bg-[var(--panel-card)]" ref={scrollRef}>
          {shouldVirtualize ? (
            <div className="relative" data-virtualized="true" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((row) => (
                <div
                  className="absolute left-0 top-0 w-full border-b border-[var(--border)]"
                  data-index={row.index}
                  key={row.key}
                  ref={virtualizer.measureElement}
                  style={{ transform: `translateY(${row.start}px)` }}
                >
                  {renderRow(row.index)}
                </div>
              ))}
            </div>
          ) : (
            <div>
              {records.map((record, index) => (
                <div className="border-b border-[var(--border)]" key={record.jobId}>
                  {renderRow(index)}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
      </section>
    </div>
  );
}
