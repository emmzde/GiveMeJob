import { Keyboard, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { useAppUiStore } from "@/app/store/appUiStore";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/features/commands/CommandPalette";
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
  const [filtersVisible, setFiltersVisible] = useState(() =>
    window.matchMedia("(min-width: 1180px)").matches,
  );
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const commandTriggerRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const selectJob = useAppUiStore((state) => state.selectJob);
  const selectedId = useAppUiStore((state) => state.selectedId);
  const panel = useAppUiStore((state) => state.panel);
  const setPanel = useAppUiStore((state) => state.setPanel);
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
  const toggleFilters = useCallback(() => {
    setFiltersVisible((current) => !current);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1180px)");
    const handleLayoutChange = (event: MediaQueryListEvent) => {
      setFiltersVisible(event.matches);
    };
    media.addEventListener("change", handleLayoutChange);
    return () => media.removeEventListener("change", handleLayoutChange);
  }, []);

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent): void {
      if (
        event.key !== "/" ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        isEditableTarget(event.target) ||
        !catalogReady
      ) {
        return;
      }
      event.preventDefault();
      focusSearch();
    }

    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, [catalogReady, focusSearch]);

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
  const detailVisible = panel === "job_detail" && selectedId !== null;

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

      <section className="flex h-[calc(100vh-3.5rem)] min-w-0 flex-col border-r border-[var(--border)]">
        <div className="shrink-0 border-b border-[var(--border)] p-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-semibold">{t("searchTitle")}</h1>
            <div className="flex items-center gap-1">
              <Button
                aria-expanded={commandPaletteOpen}
                aria-haspopup="dialog"
                aria-label={t("openCommandPalette")}
                className="h-9 gap-1.5 px-2"
                onClick={() => setCommandPaletteOpen(true)}
                ref={commandTriggerRef}
                type="button"
                variant="ghost"
              >
                <Keyboard aria-hidden="true" className="size-4" />
                <span className="hidden text-xs sm:inline">Ctrl+K</span>
              </Button>
              <Button
                aria-controls="search-filters"
                aria-expanded={filtersVisible}
                aria-label={filtersVisible ? t("hideFilters") : t("showFilters")}
                className="size-9 px-0"
                onClick={toggleFilters}
                type="button"
                variant="ghost"
              >
                {filtersVisible ? (
                  <PanelLeftClose aria-hidden="true" className="size-4" />
                ) : (
                  <PanelLeftOpen aria-hidden="true" className="size-4" />
                )}
              </Button>
            </div>
          </div>
          <form className="mt-3 flex gap-2" onSubmit={submitSearch}>
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-raised)] px-3">
              <Search aria-hidden="true" className="size-4 text-[var(--text-secondary)]" />
              <span className="sr-only">{t("searchPlaceholder")}</span>
              <input
                aria-describedby="search-syntax-hint"
                className="h-9 min-w-0 flex-1 bg-transparent text-sm placeholder:text-[var(--text-placeholder)]"
                disabled={!catalogReady}
                onChange={(event) => setDraft({ ...draft, text: event.target.value })}
                placeholder={t("searchPlaceholder")}
                ref={searchInputRef}
                value={draft.text}
              />
            </label>
            <Button
              disabled={search.isFetching || !catalogReady}
              type="submit"
              variant="accent"
            >
              {t("search")}
            </Button>
          </form>
          <p className="mt-1.5 text-xs leading-4 text-[var(--text-secondary)]" id="search-syntax-hint">
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
            <div>
              <p
                aria-atomic="true"
                aria-live="polite"
                className="text-sm font-semibold"
                role="status"
              >
                {catalogWorking || (search.isPending && jobs.length === 0)
                  ? t("catalogPreparingSearch")
                  : `${formatCount(firstPage?.total ?? jobs.length)} ${t("resultsFound")}`}
              </p>
              {search.isFetching && !search.isFetchingNextPage && jobs.length > 0 ? (
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  {t("resultsLoading")}
                </p>
              ) : null}
              {catalog.status?.state === "ready" ? (
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  {t("catalogTotal")}: {formatCount(catalog.status.totalJobs)} {t("jobsFound")}
                </p>
              ) : null}
              {snapshotDate ? (
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  {t("catalogSnapshot")}: {snapshotDate}
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
      </section>

      <JobDetail
        dataVisible={detailVisible}
        hasSearchError={searchError !== null}
        isInitialSearchLoading={isInitialSearchLoading}
        key={selectedId ?? "empty"}
        onClose={() => setPanel(null)}
        selectedJob={selectedJob}
      />
      <CommandPalette
        filtersVisible={filtersVisible}
        onFocusSearch={focusSearch}
        onOpenChange={setCommandPaletteOpen}
        onToggleFilters={toggleFilters}
        open={commandPaletteOpen}
        returnFocusRef={commandTriggerRef}
      />
    </div>
  );
}
