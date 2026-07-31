import { Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { useAppUiStore } from "@/app/store/appUiStore";
import { Button } from "@/components/ui/button";
import {
  catalogStageLabel,
  isCatalogReady,
  isCatalogWorking,
} from "@/features/catalog/catalogStatus";
import type { CatalogViewState } from "@/features/catalog/catalogStatus";
import { Feed } from "@/features/feed/components/Feed";
import { Filters } from "@/features/feed/components/Filters";
import {
  searchPageQueryKey,
  useSearchPage,
} from "@/features/feed/hooks/useSearchPage";
import {
  createSearchDraft,
  searchDraftToQuery,
} from "@/features/feed/searchDraft";
import type { SearchDraft } from "@/features/feed/searchDraft";
import { JobDetail } from "@/features/job/components/JobDetail";
import type { CatalogStatus, JobSearchPage, SearchQuery } from "@/lib/catalog";
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
  const queryClient = useQueryClient();
  const selectJob = useAppUiStore((state) => state.selectJob);
  const selectedId = useAppUiStore((state) => state.selectedId);
  const catalogReady = isCatalogReady(catalog);
  const search = useSearchPage(committedQuery, catalogReady);
  const retainedPage =
    search.isError && retainedQuery
      ? queryClient.getQueryData<JobSearchPage>(searchPageQueryKey(retainedQuery))
      : undefined;
  const page = search.data ?? retainedPage;
  const jobs = useMemo(() => page?.items ?? [], [page]);

  useEffect(() => {
    if (page === undefined || search.isPlaceholderData || search.isError) return;
    const currentSelectionExists = page.items.some((job) => job.id === selectedId);
    if (!currentSelectionExists) selectJob(page.items[0]?.id ?? null);
  }, [page, search.isError, search.isPlaceholderData, selectJob, selectedId]);

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

  return (
    <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-[190px_minmax(360px,1fr)_minmax(300px,0.85fr)]">
      <Filters draft={draft} onChange={changeFilters} />

      <section className="min-w-0 border-r border-[var(--border)]">
        <div className="border-b border-[var(--border)] p-4">
          <h1 className="text-lg font-semibold">{t("searchTitle")}</h1>
          <form className="mt-3 flex gap-2" onSubmit={submitSearch}>
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-raised)] px-3">
              <Search aria-hidden="true" className="size-4 text-[var(--text-secondary)]" />
              <span className="sr-only">{t("searchPlaceholder")}</span>
              <input
                className="h-9 min-w-0 flex-1 bg-transparent text-sm placeholder:text-[var(--text-tertiary)]"
                disabled={!catalogReady}
                onChange={(event) => setDraft({ ...draft, text: event.target.value })}
                placeholder={t("searchPlaceholder")}
                value={draft.text}
              />
            </label>
            <Button disabled={search.isFetching || !catalogReady} type="submit">
              {t("search")}
            </Button>
          </form>

          {catalog.status?.state === "ready" ? (
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              {catalog.status.totalJobs.toLocaleString("ru-RU")} {t("jobsFound")}
              {catalog.status.sourceFrozenAt
                ? ` · ${catalog.status.sourceFrozenAt.slice(0, 10)}`
                : ""}
            </p>
          ) : null}
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
          <p
            aria-atomic="true"
            aria-live="polite"
            className="mt-1 text-xs text-[var(--text-secondary)]"
            role="status"
          >
            {catalogWorking
              ? t("catalogPreparingSearch")
              : search.isFetching
                ? t("resultsLoading")
                : `${page?.total ?? jobs.length} ${t("resultsFound")}`}
          </p>
          {searchError ? (
            <p
              aria-live="assertive"
              className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm"
              role="alert"
            >
              {searchError}
            </p>
          ) : null}
        </div>

        <Feed
          errorMessage={searchError}
          isCatalogReady={catalogReady}
          isFetching={search.isFetching}
          isInitialLoading={isInitialSearchLoading}
          jobs={jobs}
        />
      </section>

      <JobDetail
        hasSearchError={searchError !== null}
        isInitialSearchLoading={isInitialSearchLoading}
        key={selectedId ?? "empty"}
        selectedJob={selectedJob}
      />
    </div>
  );
}
