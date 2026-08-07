import {
  BriefcaseBusiness,
  Database,
  ListFilter,
  Rows3,
  Search,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { useAppUiStore } from "@/app/store/appUiStore";
import { Button } from "@/components/ui/button";
import {
  catalogStageLabel,
  isCatalogReady,
  isCatalogWorking,
} from "@/features/catalog/catalogStatus";
import type { CatalogViewState } from "@/features/catalog/catalogStatus";
import { ActiveFilterChips } from "@/features/feed/components/ActiveFilterChips";
import { Feed } from "@/features/feed/components/Feed";
import { Filters } from "@/features/feed/components/Filters";
import { SortControl } from "@/features/feed/components/SortControl";
import { formatCount, formatSnapshotDate } from "@/features/feed/jobPresentation";
import {
  searchPageQueryKey,
  useSearchPage,
} from "@/features/feed/hooks/useSearchPage";
import {
  createSearchDraft,
  searchDraftToQuery,
} from "@/features/feed/searchDraft";
import type { SearchDraft } from "@/features/feed/searchDraft";
import { flattenUniqueJobs } from "@/features/feed/searchPages";
import { JobDetail } from "@/features/job/components/JobDetail";
import type {
  CatalogStatus,
  JobSearchPage,
  SearchCursor,
  SearchQuery,
} from "@/lib/catalog";
import { isEditableTarget } from "@/lib/keyboard";
import { t } from "@/lib/i18n";

interface SearchScreenProps {
  catalog: CatalogViewState;
  recoverCatalog(): Promise<CatalogStatus>;
  isRecovering: boolean;
}

function MetricSparkline({ variant }: { variant: "primary" | "steady" | "signal" }) {
  const paths = {
    primary: "M2 29 10 12 18 20 27 6 36 25 46 13 56 21 66 9 78 18",
    steady: "M2 24 12 25 21 16 31 19 40 10 51 13 60 8 69 17 78 7",
    signal: "M2 27 12 22 22 24 32 13 42 18 52 10 63 14 70 8 78 12",
  } as const;
  return (
    <svg aria-hidden="true" className="metric-sparkline" fill="none" viewBox="0 0 80 34">
      <path className="metric-sparkline-base" d="M2 30H78" />
      <path className="metric-sparkline-value" d={paths[variant]} />
    </svg>
  );
}

function queriesEqual(left: SearchQuery, right: SearchQuery): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function SearchScreen({
  catalog,
  recoverCatalog,
  isRecovering,
}: SearchScreenProps) {
  const [draft, setDraft] = useState<SearchDraft>(() => createSearchDraft());
  const [committedQuery, setCommittedQuery] = useState<SearchQuery>(() =>
    searchDraftToQuery(createSearchDraft()),
  );
  const [retainedQuery, setRetainedQuery] = useState<SearchQuery | null>(null);
  const [hasCommittedInteraction, setHasCommittedInteraction] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const selectJob = useAppUiStore((state) => state.selectJob);
  const selectedId = useAppUiStore((state) => state.selectedId);
  const panel = useAppUiStore((state) => state.panel);
  const screen = useAppUiStore((state) => state.screen);
  const setPanel = useAppUiStore((state) => state.setPanel);
  const filtersVisible = useAppUiStore((state) => state.filtersVisible);
  const catalogReady = isCatalogReady(catalog);
  const search = useSearchPage(committedQuery, catalogReady);
  const retainedData =
    search.isError && retainedQuery
      ? queryClient.getQueryData<InfiniteData<JobSearchPage, SearchCursor | undefined>>(
          searchPageQueryKey(retainedQuery),
        )
      : undefined;
  const searchData = search.data ?? retainedData;
  const pages = useMemo(() => searchData?.pages ?? [], [searchData]);
  const firstPage = pages[0];
  const jobs = useMemo(() => flattenUniqueJobs(pages), [pages]);
  const nextCursor =
    search.isPlaceholderData || search.isError
      ? null
      : (pages.at(-1)?.nextCursor ?? null);
  const suggestion =
    search.isError || search.isPlaceholderData
      ? null
      : (firstPage?.suggestion ?? null);
  const fetchNextPageOnce = search.fetchNextPageOnce;
  const loadMore = useCallback(() => {
    void fetchNextPageOnce();
  }, [fetchNextPageOnce]);
  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);
  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent): void {
      if (
        event.key !== "/" ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        isEditableTarget(event.target) ||
        screen !== "search" ||
        !catalogReady
      ) {
        return;
      }
      event.preventDefault();
      focusSearch();
    }

    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, [catalogReady, focusSearch, screen]);

  useEffect(() => {
    if (pages.length === 0 || search.isPlaceholderData || search.isError) return;
    const currentSelectionExists = jobs.some((job) => job.id === selectedId);
    if (!currentSelectionExists) selectJob(jobs[0]?.id ?? null);
  }, [jobs, pages.length, search.isError, search.isPlaceholderData, selectJob, selectedId]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedId) ?? null,
    [jobs, selectedId],
  );
  const catalogWorking = isCatalogWorking(catalog);
  const isInitialSearchLoading =
    jobs.length === 0 && (catalogWorking || (catalogReady && search.isPending));
  const searchError = search.isError
    ? t(hasCommittedInteraction ? "submitSearchError" : "initialSearchError")
    : null;
  const snapshotDate =
    catalog.status?.state === "ready"
      ? formatSnapshotDate(catalog.status.sourceFrozenAt)
      : null;
  const totalResults = firstPage?.total ?? jobs.length;
  const catalogTotal =
    catalog.status?.state === "ready" ? catalog.status.totalJobs : jobs.length;
  const detailVisible = selectedId !== null && panel === "job_detail";

  function commit(nextDraft: SearchDraft, refetchEqualQuery: boolean): void {
    const nextQuery = searchDraftToQuery(nextDraft);
    setHasCommittedInteraction(true);
    if (queriesEqual(nextQuery, committedQuery)) {
      if (refetchEqualQuery) void search.refetch();
      return;
    }
    if (search.data !== undefined && !search.isPlaceholderData) {
      setRetainedQuery(committedQuery);
    }
    setCommittedQuery(nextQuery);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!catalogReady || search.isFetching) return;
    commit(draft, true);
  }

  function changeFilters(nextDraft: SearchDraft): void {
    setDraft(nextDraft);
    commit(nextDraft, false);
  }

  function applySuggestion(): void {
    if (suggestion === null) return;
    const nextDraft = { ...draft, text: suggestion };
    setDraft(nextDraft);
    commit(nextDraft, false);
  }

  return (
    <div
      className="search-layout"
      data-detail-visible={detailVisible ? "true" : "false"}
      data-filters-visible={filtersVisible ? "true" : "false"}
    >
      <Filters
        disabled={!catalogReady}
        draft={draft}
        onChange={changeFilters}
        visible={filtersVisible}
      />

      <section className="job-workbench flex min-h-0 min-w-0 flex-col border-r border-[var(--border)] bg-[var(--bg)]">
        <div className="search-page-header shrink-0 px-6 pb-5 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                {t("localCatalog")}
              </p>
              <h1 className="search-title text-[28px] font-extrabold leading-8 tracking-[-0.035em]">
                {t("searchTitle")}
              </h1>
            </div>
          </div>

          <div className="search-overview mt-5" aria-label={t("searchOverview")}>
            <article className="search-metric search-metric-primary" data-tone="primary">
              <div className="search-metric-header">
                <p className="truncate text-[12px] font-semibold text-[var(--text)]">
                  {t("resultMetric")}
                </p>
                <ListFilter aria-hidden="true" className="size-4 text-[var(--text-secondary)]" />
              </div>
              <p className="search-metric-value">{formatCount(totalResults)}</p>
              <MetricSparkline variant="primary" />
              <p className="mt-2 truncate text-[11px] leading-4 text-[var(--text-secondary)]">
                {t("resultMetricHint")}
              </p>
            </article>
            <article className="search-metric search-metric-context" data-tone="steady">
              <span className="sr-only">
                {t("catalogTotal")}: {formatCount(catalogTotal)} {t("jobsFound")}
              </span>
              <div className="search-metric-header">
                <p className="truncate text-[11px] font-medium text-[var(--text-secondary)]">
                  {t("catalogMetric")}
                </p>
                <Database aria-hidden="true" className="size-4 text-[var(--text-tertiary)]" />
              </div>
              <p className="search-metric-value">{formatCount(catalogTotal)}</p>
              <MetricSparkline variant="steady" />
              <p className="mt-2 truncate text-[10px] leading-4 text-[var(--text-tertiary)]">
                {snapshotDate ? `${t("catalogSnapshot")}: ${snapshotDate}` : t("localCatalog")}
              </p>
            </article>
            <article className="search-metric search-metric-secondary" data-tone="signal">
              <div className="search-metric-header">
                <p className="truncate text-[11px] font-medium text-[var(--text-tertiary)]">
                  {t("loadedMetric")}
                </p>
                <Rows3 aria-hidden="true" className="size-4 text-[var(--text-tertiary)]" />
              </div>
              <p className="search-metric-value">{formatCount(jobs.length)}</p>
              <MetricSparkline variant="signal" />
              <p className="mt-2 truncate text-[10px] leading-4 text-[var(--text-tertiary)]">
                {t("loadedMetricHint")}
              </p>
            </article>
          </div>
        </div>

        <div className="job-results-panel mx-6 mb-6 flex min-h-0 flex-1 flex-col gap-4">
          <div className="search-controls-card shrink-0">
          <div className="search-controls-header">
            <h2 className="flex min-w-0 items-center gap-2 text-[14px] font-bold">
              <span className="panel-glyph"><BriefcaseBusiness aria-hidden="true" className="size-3.5" /></span>
              {t("searchResults")}
            </h2>
            <span className="text-[12px] text-[var(--text-tertiary)]">
              {t("localCatalog")}
            </span>
          </div>

            <div className="search-controls-body">
              <form className="flex gap-2" onSubmit={submitSearch}>
            <label className="search-input-shell flex min-w-0 flex-1 items-center gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--sidebar-field)] px-4 focus-within:border-[var(--focus)]">
              <Search aria-hidden="true" className="size-[18px] text-[var(--text-tertiary)]" />
              <span className="sr-only">{t("searchPlaceholder")}</span>
              <input
                aria-describedby="search-syntax-hint"
                className="h-11 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--text-placeholder)]"
                disabled={!catalogReady}
                id="catalog-search-input"
                onChange={(event) => setDraft({ ...draft, text: event.target.value })}
                placeholder={t("searchPlaceholder")}
                ref={searchInputRef}
                value={draft.text}
              />
            </label>
            <Button
              disabled={search.isFetching || !catalogReady}
              type="submit"
              variant="default"
            >
              {t("search")}
            </Button>
              </form>
              <p className="mt-3 text-[12px] leading-5 text-[var(--text-tertiary)]" id="search-syntax-hint">
                {t("searchSyntaxHint")}
              </p>

          <ActiveFilterChips draft={draft} onChange={changeFilters} />

          {catalog.status && catalogWorking ? (
            <div
              aria-atomic="true"
              aria-live="polite"
              className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] p-3"
              role="status"
            >
              <div className="flex items-center justify-between gap-3 text-xs">
                <span>{catalogStageLabel(catalog.status)}</span>
                <span>{catalog.status.progress}%</span>
              </div>
              <progress
                aria-label={t("catalogProgress")}
                className="mt-2 h-1.5 w-full accent-[var(--text)]"
                max={100}
                value={catalog.status.progress}
              />
            </div>
          ) : null}
          {catalog.isError || catalog.status?.state === "missing" || catalog.status?.state === "error" ? (
            <div className="mt-3">
              <Button
                disabled={isRecovering}
                onClick={() => void recoverCatalog().catch(() => undefined)}
                type="button"
              >
                {isRecovering ? t("catalogRetrying") : t("catalogRetry")}
              </Button>
            </div>
          ) : null}
          {searchError ? (
            <p
              aria-live="assertive"
              className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm"
              role="alert"
            >
              {searchError}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
            <div>
              <p
                aria-atomic="true"
                aria-live="polite"
                className="text-[13px] font-bold leading-5"
                role="status"
              >
                {catalogWorking || (search.isPending && jobs.length === 0)
                  ? t("catalogPreparingSearch")
                  : `${formatCount(firstPage?.total ?? jobs.length)} ${t("resultsFound")}`}
              </p>
              {search.isFetching && !search.isFetchingNextPage && jobs.length > 0 ? (
                <p className="mt-0.5 text-[11px] leading-4 text-[var(--text-secondary)]">
                  {t("resultsLoading")}
                </p>
              ) : null}
            </div>
            <SortControl
              disabled={!catalogReady || search.isFetching}
              onChange={(sort) => changeFilters({ ...draft, sort })}
              value={draft.sort}
            />
          </div>
          {suggestion ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span>{t("typoSuggestion")}:</span>
              <Button
                className="h-8 px-2.5 text-xs"
                disabled={!catalogReady || search.isFetching}
                onClick={applySuggestion}
                type="button"
                variant="outline"
              >
                {suggestion}
              </Button>
            </div>
          ) : null}
            </div>
          </div>

            <Feed
              canLoadNextPage={
                catalogReady &&
                nextCursor !== null &&
                !search.isFetching &&
                !search.isFetchingNextPage
              }
              errorMessage={searchError}
              isCatalogReady={catalogReady}
              isFetching={search.isFetching}
              isFetchingNextPage={search.isFetchingNextPage}
              isInitialLoading={isInitialSearchLoading}
              jobs={jobs}
              nextCursor={nextCursor}
              onLoadMore={loadMore}
            />
        </div>
      </section>

      <JobDetail
        dataVisible={detailVisible}
        hasSearchError={searchError !== null}
        isInitialSearchLoading={isInitialSearchLoading}
        key={selectedId ?? "empty"}
        onClose={() => setPanel(null)}
        selectedJob={selectedJob}
      />
    </div>
  );
}
