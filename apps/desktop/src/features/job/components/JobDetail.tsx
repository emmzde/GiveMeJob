import {
  Bot,
  BriefcaseBusiness,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  CircleDollarSign,
  ExternalLink,
  MapPin,
  Wifi,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAppUiStore } from "@/app/store/appUiStore";
import { Button } from "@/components/ui/button";
import {
  employmentTypeLabels,
  formatSourceLabel,
  remoteModeLabels,
  seniorityLabels,
} from "@/features/feed/searchLabels";
import {
  formatSalaryRange,
  normalizeJobTitle,
  normalizeSkillLabel,
} from "@/features/feed/jobPresentation";
import { JobDescription } from "@/features/job/components/JobDescription";
import { useJobDetail } from "@/features/job/hooks/useJobDetail";
import { openOriginalJob } from "@/lib/catalog";
import type { JobId, JobSummary } from "@/lib/catalog";
import { t } from "@/lib/i18n";

interface JobDetailProps {
  dataVisible: boolean;
  selectedJob: JobSummary | null;
  isInitialSearchLoading: boolean;
  hasSearchError: boolean;
  onClose(): void;
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

export function JobDetail({
  dataVisible,
  selectedJob,
  isInitialSearchLoading,
  hasSearchError,
  onClose,
}: JobDetailProps) {
  const selectedId = useAppUiStore((state) => state.selectedId);
  const detail = useJobDetail(selectedId);
  const [isOpeningOriginal, setIsOpeningOriginal] = useState(false);
  const [originalLinkError, setOriginalLinkError] = useState<string | null>(null);
  const openingOriginalFor = useRef<JobId | null>(null);

  const openSelectedOriginal = useCallback(async () => {
    if (detail.data === undefined || isOpeningOriginal) return;
    const id = detail.data.id;
    openingOriginalFor.current = id;
    setIsOpeningOriginal(true);
    setOriginalLinkError(null);
    try {
      await openOriginalJob(id);
    } catch {
      if (openingOriginalFor.current === id) setOriginalLinkError(t("originalOpenError"));
    } finally {
      if (openingOriginalFor.current === id) {
        openingOriginalFor.current = null;
        setIsOpeningOriginal(false);
      }
    }
  }, [detail.data, isOpeningOriginal]);

  useEffect(() => {
    function handleOriginalShortcut(event: KeyboardEvent) {
      if (event.ctrlKey && event.key === "Enter" && detail.data !== undefined) {
        event.preventDefault();
        void openSelectedOriginal();
      }
    }

    window.addEventListener("keydown", handleOriginalShortcut);
    return () => window.removeEventListener("keydown", handleOriginalShortcut);
  }, [detail.data, openSelectedOriginal]);

  const isLoading = isInitialSearchLoading || (selectedId !== null && detail.isPending);
  const salary = detail.data ? formatSalaryRange(detail.data) : null;

  return (
    <aside
      className="detail-panel scroll-region h-[calc(100vh-3.5rem)] min-w-0 overflow-y-auto p-5 pr-6"
      data-visible={dataVisible ? "true" : "false"}
    >
      {isLoading ? <JobDetailSkeleton /> : null}
      {!isLoading && detail.data ? (
        <article>
          <header className="border-b border-[var(--border)] pb-5">
            <div className="flex items-start gap-3">
              <div
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] text-base font-semibold"
                data-testid="company-monogram"
              >
                {detail.data.company.slice(0, 1).toLocaleUpperCase("ru-RU")}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--text)]">
                  {detail.data.company}
                </p>
                <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-[-0.025em]">
                  {normalizeJobTitle(detail.data.title)}
                </h2>
              </div>
              <Button
                aria-label={t("closeDetails")}
                className="ml-auto size-9 shrink-0 px-0"
                onClick={onClose}
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
              {detail.data.locationText ? (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-1">
                  <MapPin aria-hidden="true" className="size-3" />
                  {detail.data.locationText}
                </span>
              ) : null}
              {detail.data.remoteMode ? (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent-muted)] px-2 py-1 text-[var(--accent)]">
                  <Wifi aria-hidden="true" className="size-3" />
                  {remoteModeLabels[detail.data.remoteMode]}
                </span>
              ) : null}
              {detail.data.seniority ? (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-1">
                  <ChartNoAxesColumnIncreasing aria-hidden="true" className="size-3" />
                  {seniorityLabels[detail.data.seniority]}
                </span>
              ) : null}
              {detail.data.employmentType ? (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-1">
                  <BriefcaseBusiness aria-hidden="true" className="size-3" />
                  {employmentTypeLabels[detail.data.employmentType]}
                </span>
              ) : null}
              {salary ? (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-1">
                  <CircleDollarSign aria-hidden="true" className="size-3" />
                  {salary}
                </span>
              ) : null}
            </div>
            <div className="mt-4">
              <Button
                aria-describedby="original-link-shortcut"
                className="min-h-10 text-sm"
                disabled={isOpeningOriginal}
                onClick={() => void openSelectedOriginal()}
                type="button"
                variant="accent"
              >
                <ExternalLink aria-hidden="true" className="size-3.5" />
                {isOpeningOriginal ? t("openingOriginal") : t("openOriginal")}
              </Button>
              <span className="sr-only" id="original-link-shortcut">
                {t("originalLinkShortcut")}
              </span>
              {originalLinkError ? (
                <p
                  aria-live="assertive"
                  className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm"
                  role="alert"
                >
                  {originalLinkError}
                </p>
              ) : null}
            </div>
          </header>

          {detail.data.skills.length > 0 ? (
            <section className="mt-6" aria-labelledby="job-skills-heading">
              <h3 className="text-base font-semibold" id="job-skills-heading">
                {t("skills")}
              </h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {detail.data.skills.map((skill) => (
                  <li
                    className="rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
                    key={skill}
                  >
                    {normalizeSkillLabel(skill)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section
            aria-labelledby="job-description-heading"
            className="mt-7 border-t border-[var(--border)] pt-5"
          >
            <h3 className="text-base font-semibold" id="job-description-heading">
              {t("description")}
            </h3>
            <JobDescription description={detail.data.description} />
          </section>

          <details className="group mt-7 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-secondary)]">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-[var(--radius-sm)] py-1 font-medium hover:text-[var(--text)]">
              <ChevronDown
                aria-hidden="true"
                className="size-3.5 transition-transform group-open:rotate-180"
              />
              {t("technicalDetails")}
            </summary>
            <dl className="mt-2 space-y-2 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] p-3">
              <div className="flex justify-between gap-4">
                <dt>{t("source")}</dt>
                <dd className="text-right text-[var(--text)]">
                  {formatSourceLabel(detail.data.source)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>{t("attribution")}</dt>
                <dd className="text-right text-[var(--text)]">{detail.data.attribution}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>{t("snapshotVersion")}</dt>
                <dd className="text-right text-[var(--text)]">
                  {detail.data.snapshotVersion}
                </dd>
              </div>
            </dl>
          </details>

          <div className="mt-7 rounded-[var(--radius-lg)] border border-[var(--border)] p-4">
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
      {!isLoading && detail.isError && selectedJob ? (
        <article>
          <div className="flex items-start gap-3">
            <div
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)] text-base font-semibold"
            >
              {selectedJob.company.slice(0, 1).toLocaleUpperCase("ru-RU")}
            </div>
            <div>
              <p className="text-sm font-medium">{selectedJob.company}</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
                {normalizeJobTitle(selectedJob.title)}
              </h2>
            </div>
          </div>
          <p
            aria-live="assertive"
            className="mt-5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm"
            role="alert"
          >
            {t("detailLoadError")}
          </p>
        </article>
      ) : null}
      {!isLoading && selectedId === null && !hasSearchError ? (
        <p className="text-sm text-[var(--text-secondary)]">{t("selectJob")}</p>
      ) : null}
    </aside>
  );
}
