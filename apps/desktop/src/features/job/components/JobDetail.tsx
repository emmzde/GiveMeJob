import { Bot, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAppUiStore } from "@/app/store/appUiStore";
import { Button } from "@/components/ui/button";
import { useJobDetail } from "@/features/job/hooks/useJobDetail";
import { openOriginalJob } from "@/lib/catalog";
import type { JobId, JobSummary } from "@/lib/catalog";
import { t } from "@/lib/i18n";

interface JobDetailProps {
  selectedJob: JobSummary | null;
  isInitialSearchLoading: boolean;
  hasSearchError: boolean;
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
  selectedJob,
  isInitialSearchLoading,
  hasSearchError,
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

  return (
    <aside className="min-w-0 overflow-y-auto p-5">
      {isLoading ? <JobDetailSkeleton /> : null}
      {!isLoading && detail.data ? (
        <article>
          <p className="text-xs text-[var(--text-secondary)]">{detail.data.company}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">
            {detail.data.title}
          </h2>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
            {detail.data.locationText ? <span>{detail.data.locationText}</span> : null}
            {detail.data.remoteMode ? (
              <span>· {detail.data.remoteMode.replaceAll("_", " ")}</span>
            ) : null}
            {detail.data.seniority ? <span>· {detail.data.seniority}</span> : null}
            {detail.data.employmentType ? (
              <span>· {detail.data.employmentType.replaceAll("_", " ")}</span>
            ) : null}
          </div>
          <div className="mt-6">
            <Button
              aria-describedby="original-link-shortcut"
              disabled={isOpeningOriginal}
              onClick={() => void openSelectedOriginal()}
              type="button"
            >
              <ExternalLink aria-hidden="true" className="size-4" />
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
          <dl className="mt-8 space-y-3 border-t border-[var(--border)] pt-5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--text-secondary)]">{t("source")}</dt>
              <dd>{detail.data.source}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--text-secondary)]">{t("attribution")}</dt>
              <dd>{detail.data.attribution}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--text-secondary)]">{t("snapshotVersion")}</dt>
              <dd>{detail.data.snapshotVersion}</dd>
            </div>
          </dl>

          {detail.data.skills.length > 0 ? (
            <section className="mt-8" aria-labelledby="job-skills-heading">
              <h3 className="text-sm font-medium" id="job-skills-heading">
                {t("skills")}
              </h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {detail.data.skills.map((skill) => (
                  <li
                    className="rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
                    key={skill}
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section
            aria-labelledby="job-description-heading"
            className="mt-8 border-t border-[var(--border)] pt-5"
          >
            <h3 className="text-sm font-medium" id="job-description-heading">
              {t("description")}
            </h3>
            <p
              className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-secondary)]"
              data-testid="job-description"
            >
              {detail.data.description}
            </p>
          </section>

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
      {!isLoading && detail.isError && selectedJob ? (
        <article>
          <p className="text-xs text-[var(--text-secondary)]">{selectedJob.company}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">
            {selectedJob.title}
          </h2>
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
