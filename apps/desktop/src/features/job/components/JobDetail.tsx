import {
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
import { MatchBreakdownCard } from "@/features/match/MatchBreakdownCard";
import { useJobMatch } from "@/features/match/hooks";
import { ShortlistButton } from "@/features/shortlist/ShortlistButton";
import { openOriginalJob } from "@/lib/catalog";
import type { JobId, JobSummary } from "@/lib/catalog";
import { isEditableTarget } from "@/lib/keyboard";
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
  const screen = useAppUiStore((state) => state.screen);
  const setScreen = useAppUiStore((state) => state.setScreen);
  const detail = useJobDetail(selectedId);
  const match = useJobMatch(selectedId);
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
      if (
        screen === "search" &&
        event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        event.key === "Enter" &&
        detail.data !== undefined &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        void openSelectedOriginal();
      }
    }

    window.addEventListener("keydown", handleOriginalShortcut);
    return () => window.removeEventListener("keydown", handleOriginalShortcut);
  }, [detail.data, openSelectedOriginal, screen]);

  const isLoading = isInitialSearchLoading || (selectedId !== null && detail.isPending);
  const salary = detail.data ? formatSalaryRange(detail.data) : null;

  return (
    <aside
      aria-hidden={!dataVisible}
      className="detail-panel scroll-region min-h-0 min-w-0 overflow-y-auto bg-[var(--panel-card)]"
      data-visible={dataVisible ? "true" : "false"}
      inert={!dataVisible}
    >
      {isLoading ? <div className="p-4"><JobDetailSkeleton /></div> : null}
      {!isLoading && detail.data ? (
        <article>
          <header className="border-b border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[var(--text-secondary)]">
                  {detail.data.company}
                </p>
                <h2 className="mt-1 text-[18px] font-semibold leading-[1.25] tracking-[-0.02em]">
                  {normalizeJobTitle(detail.data.title)}
                </h2>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                <ShortlistButton compact jobId={detail.data.id} />
                <Button
                  aria-label={t("closeDetails")}
                  className="size-8 shrink-0 px-0"
                  onClick={onClose}
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1 text-[11px] font-medium text-[var(--text-secondary)]">
              {detail.data.locationText ? (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel-card)] px-2 py-0.5">
                  <MapPin aria-hidden="true" className="size-4" />
                  {detail.data.locationText}
                </span>
              ) : null}
              {detail.data.remoteMode ? (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel-card)] px-2 py-0.5">
                  <Wifi aria-hidden="true" className="size-4" />
                  {remoteModeLabels[detail.data.remoteMode]}
                </span>
              ) : null}
              {detail.data.seniority ? (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel-card)] px-2 py-0.5">
                  <ChartNoAxesColumnIncreasing aria-hidden="true" className="size-4" />
                  {seniorityLabels[detail.data.seniority]}
                </span>
              ) : null}
              {detail.data.employmentType ? (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel-card)] px-2 py-0.5">
                  <BriefcaseBusiness aria-hidden="true" className="size-4" />
                  {employmentTypeLabels[detail.data.employmentType]}
                </span>
              ) : null}
              {salary ? (
                <span className="ui-mono inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel-card)] px-2 py-0.5 text-[10px]">
                  <CircleDollarSign aria-hidden="true" className="size-4" />
                  {salary}
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                aria-describedby="original-link-description"
                disabled={isOpeningOriginal}
                onClick={() => void openSelectedOriginal()}
                type="button"
                variant="default"
              >
                <ExternalLink aria-hidden="true" className="size-4" />
                {isOpeningOriginal ? t("openingOriginal") : t("openOriginal")}
              </Button>
              <span className="sr-only" id="original-link-description">
                {t("originalLinkDescription")}
              </span>
              {originalLinkError ? (
                <p
                  aria-live="assertive"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-card)] px-3 py-2 text-xs"
                  role="alert"
                >
                  {originalLinkError}
                </p>
              ) : null}
            </div>
          </header>

          <div className="px-4 pb-4">
            {!match.hasProfile ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] py-3 text-xs text-[var(--text-secondary)]">
                <span>{t("matchUnavailable")}</span>
                <Button aria-label={t("openProfileForMatch")} onClick={() => setScreen("profile")} type="button" variant="outline">
                  {t("openProfileForMatch")}
                </Button>
              </div>
            ) : null}
            {match.hasProfile && match.isPending ? (
              <div aria-label={t("matchLoading")} className="mt-6 h-28 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-1)]" role="status" />
            ) : null}
            {match.hasProfile && match.isError ? (
              <p className="alert-card mt-5" role="alert">{t("matchError")}</p>
            ) : null}
            {match.data ? <MatchBreakdownCard breakdown={match.data} /> : null}
          </div>

          {detail.data.skills.length > 0 ? (
            <section className="border-t border-[var(--border)] px-4 py-4" aria-labelledby="job-skills-heading">
              <h3 className="text-xs font-semibold" id="job-skills-heading">
                {t("skills")}
              </h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {detail.data.skills.map((skill) => (
                  <li
                    className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
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
            className="border-t border-[var(--border)] px-4 py-4"
          >
            <h3 className="text-xs font-semibold" id="job-description-heading">
              {t("description")}
            </h3>
            <JobDescription description={detail.data.description} />
          </section>

          <details className="group border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--text-secondary)]">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-[var(--radius-sm)] py-1 font-medium hover:text-[var(--text)]">
              <ChevronDown
                aria-hidden="true"
                className="size-4 transition-transform group-open:rotate-180"
              />
              {t("technicalDetails")}
            </summary>
            <dl className="mt-2 space-y-2 border-t border-[var(--border)] pt-3">
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
        </article>
      ) : null}
      {!isLoading && detail.isError && selectedJob ? (
        <article className="p-4">
          <div className="flex items-start gap-3">
            <div>
              <p className="text-sm font-medium">{selectedJob.company}</p>
              <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.025em]">
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
        <p className="p-4 text-xs text-[var(--text-secondary)]">{t("selectJob")}</p>
      ) : null}
    </aside>
  );
}
