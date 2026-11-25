import { ArrowRight, Bookmark, Search, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { useAppUiStore } from "@/app/store/appUiStore";
import { Button } from "@/components/ui/button";
import { CornerArrow } from "@/components/ui/corner-arrow";
import { IconTile } from "@/components/ui/icon-tile";
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
import { formatCount } from "@/features/feed/jobPresentation";
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
import { EmmyMascot } from "@/features/emmy/EmmyMascot";
import { JobDetail } from "@/features/job/components/JobDetail";
import { useShortlistRecords } from "@/features/shortlist/hooks";
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const selectJob = useAppUiStore((state) => state.selectJob);
  const selectedId = useAppUiStore((state) => state.selectedId);
  const panel = useAppUiStore((state) => state.panel);
  const screen = useAppUiStore((state) => state.screen);
  const setPanel = useAppUiStore((state) => state.setPanel);
  const setScreen = useAppUiStore((state) => state.setScreen);
  const filtersVisible = useAppUiStore((state) => state.filtersVisible);
  const catalogReady = isCatalogReady(catalog);
  const shortlistCount = useShortlistRecords().data?.length ?? 0;
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
    if (!currentSelectionExists) {
      selectJob(jobs[0]?.id ?? null);
      if (selectedId === null && !hasCommittedInteraction) {
        setPanel(panel === "emmy" ? "emmy" : null);
      }
    }
  }, [hasCommittedInteraction, jobs, pages.length, panel, search.isError, search.isPlaceholderData, selectJob, selectedId, setPanel]);

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
      data-compact={hasCommittedInteraction || filtersVisible || panel !== null}
      data-detail-visible={detailVisible ? "true" : "false"}
      data-filters-visible={filtersVisible ? "true" : "false"}
    >
      <Filters
        disabled={!catalogReady}
        draft={draft}
        onChange={changeFilters}
        visible={filtersVisible}
      />

      <section className="job-workbench flex min-h-0 min-w-0 flex-col">
        <header className="search-page-header page-head shrink-0">
          <h1 className="search-title page-title">{t("searchTitle")}</h1>
          <div className="page-head-meta">
            {shortlistCount > 0 ? (
              <span className="meta-pill">
                <Bookmark aria-hidden="true" className="size-3.5" />
                <span className="meta-pill-key">{t("shortlist")}</span>
                <span className="meta-pill-value">{formatCount(shortlistCount)}</span>
              </span>
            ) : null}
          </div>
        </header>

        <div className="job-results-panel flex min-h-0 flex-1 flex-col">
          <div className="search-showcase">
            <div className="search-showcase-stack">
              <button className="notch-card showcase-tile" onClick={() => setScreen("shortlist")} type="button">
                <IconTile icon={Bookmark} size="lg" tone="gold" />
                <span className="showcase-copy">
                  <span className="showcase-kicker">{t("shortlist")}</span>
                  <span className="showcase-title">{t("careerShortlistCopy")}</span>
                </span>
                <CornerArrow />
              </button>
              <button className="notch-card showcase-tile" onClick={() => setScreen("profile")} type="button">
                <IconTile icon={UserRound} size="lg" tone="violet" />
                <span className="showcase-copy">
                  <span className="showcase-kicker">{t("profile")}</span>
                  <span className="showcase-title">{t("careerProfileCopy")}</span>
                </span>
                <CornerArrow />
              </button>
            </div>
            <div className="showcase-emmy">
              <div className="showcase-emmy-copy">
                <p className="showcase-emmy-title">Emmy</p>
                <p className="showcase-emmy-text">{t("careerEmmyCopy")}</p>
                <button className="pill-button-outline" onClick={() => setPanel("emmy")} type="button">
                  {t("careerAssistantAction")}
                </button>
              </div>
              <EmmyMascot className="showcase-emmy-mascot" interactive state="idle" trackPointer />
            </div>
          </div>

          <div className="search-controls-card shrink-0">
            <div className="search-controls-body">
              <form className="search-form" onSubmit={submitSearch}>
                <label className="search-input-shell">
                  <Search aria-hidden="true" className="size-[18px] shrink-0" />
                  <span className="sr-only">{t("searchPlaceholder")}</span>
                  <input
                    aria-describedby="search-syntax-hint"
                    disabled={!catalogReady}
                    id="catalog-search-input"
                    onChange={(event) => setDraft({ ...draft, text: event.target.value })}
                    placeholder={t("searchPlaceholder")}
                    ref={searchInputRef}
                    value={draft.text}
                  />
                  <kbd aria-hidden="true" className="search-input-key">/</kbd>
                </label>
                <button
                  className="pill-button-solid"
                  disabled={search.isFetching || !catalogReady}
                  type="submit"
                >
                  {t("search")}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </button>
              </form>
              <p className="sr-only" id="search-syntax-hint">
                {t("searchSyntaxHint")}
              </p>

              <ActiveFilterChips draft={draft} onChange={changeFilters} />

              {catalog.status && catalogWorking ? (
                <div
                  aria-atomic="true"
                  aria-live="polite"
                  className="inline-status"
                  role="status"
                >
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span>{catalogStageLabel(catalog.status)}</span>
                    <span className="tabular-nums">{catalog.status.progress}%</span>
                  </div>
                  <progress
                    aria-label={t("catalogProgress")}
                    className="slim-progress"
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
                <p aria-live="assertive" className="inline-status" role="alert">
                  {searchError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="results-head">
            <SortControl
              disabled={!catalogReady || search.isFetching}
              onChange={(sort) => changeFilters({ ...draft, sort })}
              value={draft.sort}
            />
            <div className="results-head-meta">
              {suggestion ? (
                <span className="results-suggestion">
                  <span>{t("typoSuggestion")}:</span>
                  <button
                    disabled={!catalogReady || search.isFetching}
                    onClick={applySuggestion}
                    type="button"
                  >
                    {suggestion}
                  </button>
                </span>
              ) : null}
              <p
                aria-atomic="true"
                aria-live="polite"
                className="results-count"
                role="status"
              >
                {catalogWorking || (search.isPending && jobs.length === 0)
                  ? t("catalogPreparingSearch")
                  : `${formatCount(firstPage?.total ?? jobs.length)} ${t("resultsFound")}`}
              </p>
              {search.isFetching && !search.isFetchingNextPage && jobs.length > 0 ? (
                <p className="sr-only">{t("resultsLoading")}</p>
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
