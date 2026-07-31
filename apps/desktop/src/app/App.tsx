import {
  Bot,
  BriefcaseBusiness,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  Database,
  MapPin,
  Search,
  SlidersHorizontal,
  UserRound,
  WifiOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { createSearchQuery, getCatalogStatus, searchLocalJobs } from "@/lib/catalog";
import type { CatalogStatus, JobId, JobSummary } from "@/lib/catalog";
import { t } from "@/lib/i18n";

type CatalogLoadState =
  | { kind: "loading" }
  | { kind: "loaded"; status: CatalogStatus }
  | { kind: "failed" };

const futureNavigationItems: ReadonlyArray<{ icon: LucideIcon; label: string }> = [
  { icon: UserRound, label: t("profile") },
  { icon: Bot, label: t("emmy") },
];

const skeletonRows = [0, 1, 2, 3, 4] as const;

function formatSalary(job: JobSummary): string | null {
  if (job.salaryMin === null && job.salaryMax === null) {
    return null;
  }
  const formatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
  const range = [job.salaryMin, job.salaryMax]
    .filter((value): value is number => value !== null)
    .map((value) => formatter.format(value))
    .join("–");
  return `${range} ${job.salaryCurrency ?? ""}`.trim();
}

function catalogStateLabel(state: CatalogLoadState): string {
  if (state.kind === "loading") return t("catalogChecking");
  if (state.kind === "failed" || state.status.state === "error") return t("catalogError");
  return state.status.state === "ready" ? t("offlineReady") : t("catalogMissing");
}

function isCatalogError(state: CatalogLoadState): boolean {
  return state.kind === "failed" || (state.kind === "loaded" && state.status.state === "error");
}

function CatalogStateIcon({ state }: { state: CatalogLoadState }) {
  if (state.kind === "loading") {
    return <Database aria-hidden="true" className="size-4" />;
  }
  if (state.kind === "failed" || state.status.state === "error") {
    return <CircleAlert aria-hidden="true" className="size-4" />;
  }
  return state.status.state === "ready" ? (
    <WifiOff aria-hidden="true" className="size-4" />
  ) : (
    <Database aria-hidden="true" className="size-4" />
  );
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

function JobDetailSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4" data-testid="initial-detail-skeleton">
      <div className="h-3 w-1/3 animate-pulse rounded-[var(--radius-sm)] bg-[var(--bg-active)]" />
      <div className="h-6 w-3/4 animate-pulse rounded-[var(--radius-sm)] bg-[var(--bg-active)]" />
      <div className="h-4 w-1/2 animate-pulse rounded-[var(--radius-sm)] bg-[var(--bg-active)]" />
    </div>
  );
}

export function App() {
  const [catalogState, setCatalogState] = useState<CatalogLoadState>({ kind: "loading" });
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [searchTotal, setSearchTotal] = useState<number>();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<JobId | null>(null);
  const [isInitialSearchLoading, setIsInitialSearchLoading] = useState(true);
  const [isSubmittingSearch, setIsSubmittingSearch] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void getCatalogStatus()
      .then((status) => {
        if (active) setCatalogState({ kind: "loaded", status });
      })
      .catch(() => {
        if (active) setCatalogState({ kind: "failed" });
      });

    void searchLocalJobs(createSearchQuery())
      .then((page) => {
        if (!active) return;
        setJobs(page.items);
        setSearchTotal(page.total);
        setSelectedId(page.items[0]?.id ?? null);
      })
      .catch(() => {
        if (active) setSearchError(t("initialSearchError"));
      })
      .finally(() => {
        if (active) setIsInitialSearchLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedId) ?? null,
    [jobs, selectedId],
  );
  const isSearchLoading = isInitialSearchLoading || isSubmittingSearch;

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSearchLoading) return;

    setIsSubmittingSearch(true);
    setSearchError(null);
    try {
      const page = await searchLocalJobs(createSearchQuery({ text: query }));
      setJobs(page.items);
      setSearchTotal(page.total);
      setSelectedId(page.items[0]?.id ?? null);
    } catch {
      setSearchError(t("submitSearchError"));
    } finally {
      setIsSubmittingSearch(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="flex h-14 items-center justify-between border-b border-[var(--border)] px-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-7 place-items-center rounded-[var(--radius-md)] bg-[var(--text)] text-xs text-[var(--bg)]">
            G
          </span>
          GiveMeJob!
          <span className="hidden text-xs font-normal text-[var(--text-secondary)] xl:inline">
            {t("appDescription")}
          </span>
        </div>
        <span
          aria-atomic="true"
          aria-live={isCatalogError(catalogState) ? "assertive" : "polite"}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"
          role={isCatalogError(catalogState) ? "alert" : "status"}
        >
          <CatalogStateIcon state={catalogState} />
          {catalogStateLabel(catalogState)}
        </span>
      </header>

      <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-[190px_minmax(360px,1fr)_minmax(300px,0.85fr)]">
        <aside className="border-r border-[var(--border)] bg-[var(--bg-secondary)] p-3">
          <nav aria-label="Основная навигация" className="space-y-1">
            <div
              aria-current="page"
              className="flex w-full items-center gap-2 rounded-[var(--radius-md)] bg-[var(--bg-active)] px-2.5 py-2 text-left text-sm font-medium"
            >
              <BriefcaseBusiness aria-hidden="true" className="size-4" />
              {t("jobs")}
            </div>
            {futureNavigationItems.map(({ icon: Icon, label }) => (
              <button
                aria-label={`${label} — ${t("later")}`}
                className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-sm text-[var(--text-secondary)] disabled:opacity-70"
                disabled
                key={label}
                type="button"
              >
                <Icon aria-hidden="true" className="size-4" />
                <span>{label}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wide">{t("later")}</span>
              </button>
            ))}
          </nav>

          <div className="mt-8 border-t border-[var(--border)] pt-4">
            <p className="flex items-center gap-2 px-2 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              {t("filters")}
            </p>
            <div className="mt-3 space-y-2">
              {[t("allLocations"), t("remoteOnly"), t("allGrades")].map((label) => (
                <button
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-2 text-left text-xs text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2"
                  key={label}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-w-0 border-r border-[var(--border)]">
          <div className="border-b border-[var(--border)] p-4">
            <h1 className="text-lg font-semibold">{t("searchTitle")}</h1>
            <form className="mt-3 flex gap-2" onSubmit={submitSearch}>
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-raised)] px-3">
                <Search aria-hidden="true" className="size-4 text-[var(--text-secondary)]" />
                <span className="sr-only">{t("searchPlaceholder")}</span>
                <input
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm placeholder:text-[var(--text-tertiary)]"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("searchPlaceholder")}
                  value={query}
                />
              </label>
              <Button disabled={isSearchLoading} type="submit">
                {t("search")}
              </Button>
            </form>
            {catalogState.kind === "loaded" && catalogState.status.state === "ready" ? (
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                {catalogState.status.totalJobs.toLocaleString("ru-RU")} {t("jobsFound")}
                {catalogState.status.sourceFrozenAt
                  ? ` · ${catalogState.status.sourceFrozenAt.slice(0, 10)}`
                  : ""}
              </p>
            ) : null}
            <p
              aria-atomic="true"
              aria-live="polite"
              className="mt-1 text-xs text-[var(--text-secondary)]"
              role="status"
            >
              {isSearchLoading
                ? t("resultsLoading")
                : `${searchTotal ?? jobs.length} ${t("resultsFound")}`}
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

          <div aria-busy={isSearchLoading} className="divide-y divide-[var(--border)]">
            {isInitialSearchLoading && jobs.length === 0 ? <JobListSkeleton /> : null}
            {!isSearchLoading && !searchError && jobs.length === 0 ? (
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
                  onClick={() => setSelectedId(job.id)}
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
        </section>

        <aside className="min-w-0 p-5">
          {isInitialSearchLoading && !selectedJob ? <JobDetailSkeleton /> : null}
          {!isInitialSearchLoading && selectedJob ? (
            <article>
              <p className="text-xs text-[var(--text-secondary)]">{selectedJob.company}</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">
                {selectedJob.title}
              </h2>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                {selectedJob.locationText ? <span>{selectedJob.locationText}</span> : null}
                {selectedJob.remoteMode ? <span>· {selectedJob.remoteMode}</span> : null}
                {selectedJob.seniority ? <span>· {selectedJob.seniority}</span> : null}
              </div>
              <div className="mt-6">
                <Button aria-describedby="original-link-pending" disabled>
                  {t("openOriginal")}
                </Button>
                <span className="sr-only" id="original-link-pending">
                  {t("originalLinkPending")}
                </span>
              </div>
              <dl className="mt-8 border-t border-[var(--border)] pt-5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--text-secondary)]">{t("source")}</dt>
                  <dd>{selectedJob.attribution}</dd>
                </div>
              </dl>
              <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border)] p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Bot aria-hidden="true" className="size-4" />
                  Emmy
                </p>
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                  {t("emmyHint")}
                </p>
              </div>
            </article>
          ) : null}
          {!isInitialSearchLoading && !selectedJob && !searchError ? (
            <p className="text-sm text-[var(--text-secondary)]">{t("selectJob")}</p>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
