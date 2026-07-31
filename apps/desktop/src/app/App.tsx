import {
  Bookmark,
  Bot,
  BriefcaseBusiness,
  ChevronRight,
  CircleDollarSign,
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

const initialStatus: CatalogStatus = {
  state: "missing",
  catalogVersion: null,
  sourceFrozenAt: null,
  totalJobs: 0,
  message: null,
};

const navigationItems: ReadonlyArray<{ icon: LucideIcon; label: string }> = [
  { icon: BriefcaseBusiness, label: t("jobs") },
  { icon: Bookmark, label: t("shortlist") },
  { icon: UserRound, label: t("profile") },
  { icon: Bot, label: t("emmy") },
];

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

export function App() {
  const [status, setStatus] = useState<CatalogStatus>(initialStatus);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<JobId | null>(null);
  const [savedIds, setSavedIds] = useState<ReadonlySet<JobId>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.all([getCatalogStatus(), searchLocalJobs(createSearchQuery())])
      .then(([catalogStatus, initialJobs]) => {
        if (!active) return;
        setStatus(catalogStatus);
        setJobs(initialJobs);
        setSelectedId(initialJobs[0]?.id ?? null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedId) ?? null,
    [jobs, selectedId],
  );

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    try {
      const nextJobs = await searchLocalJobs(createSearchQuery({ text: query }));
      setJobs(nextJobs);
      setSelectedId(nextJobs[0]?.id ?? null);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleSaved(jobId: JobId) {
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
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
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <WifiOff aria-hidden="true" className="size-4" />
          {status.state === "ready" ? t("offlineReady") : t("catalogMissing")}
        </span>
      </header>

      <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-[190px_minmax(360px,1fr)_minmax(300px,0.85fr)]">
        <aside className="border-r border-[var(--border)] p-3">
          <nav aria-label="Основная навигация" className="space-y-1">
            {navigationItems.map(({ icon: Icon, label }, index) => (
              <button
                key={label}
                className={`flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  index === 0 ? "bg-[var(--surface-muted)] font-medium" : "text-[var(--text-secondary)]"
                }`}
                type="button"
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
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
                  key={label}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-2 text-left text-xs text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2"
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
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3">
                <Search aria-hidden="true" className="size-4 text-[var(--text-secondary)]" />
                <span className="sr-only">{t("searchPlaceholder")}</span>
                <input
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-tertiary)]"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("searchPlaceholder")}
                  value={query}
                />
              </label>
              <Button type="submit">{t("search")}</Button>
            </form>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              {status.totalJobs.toLocaleString("ru-RU")} {t("jobsFound")}
              {status.sourceFrozenAt ? ` · ${status.sourceFrozenAt.slice(0, 10)}` : ""}
            </p>
          </div>

          <div aria-busy={isLoading} className="divide-y divide-[var(--border)]">
            {!isLoading && jobs.length === 0 ? (
              <p className="p-6 text-sm text-[var(--text-secondary)]">{t("empty")}</p>
            ) : null}
            {jobs.map((job) => {
              const salary = formatSalary(job);
              return (
                <button
                  key={job.id}
                  className={`block w-full px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${
                    selectedId === job.id ? "bg-[var(--surface-muted)]" : "hover:bg-[var(--surface)]"
                  }`}
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
                    <ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--text-tertiary)]" />
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
          {selectedJob ? (
            <article>
              <p className="text-xs text-[var(--text-secondary)]">{selectedJob.company}</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">{selectedJob.title}</h2>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                {selectedJob.locationText ? <span>{selectedJob.locationText}</span> : null}
                {selectedJob.remoteMode ? <span>· {selectedJob.remoteMode}</span> : null}
                {selectedJob.seniority ? <span>· {selectedJob.seniority}</span> : null}
              </div>
              <div className="mt-6 flex gap-2">
                <Button onClick={() => toggleSaved(selectedJob.id)} variant="outline">
                  <Bookmark aria-hidden="true" className="size-4" />
                  {savedIds.has(selectedJob.id) ? t("saved") : t("save")}
                </Button>
                <Button>{t("openOriginal")}</Button>
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
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">{t("selectJob")}</p>
          )}
        </aside>
      </div>
    </main>
  );
}
