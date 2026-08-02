import { CircleAlert, CircleCheck } from "lucide-react";

import type {
  MatchBreakdown,
  MatchComponentName,
  MatchReason,
} from "@/lib/match";
import { t } from "@/lib/i18n";
import { matchReasonLabel } from "@/features/match/matchPresentation";

const componentLabels: Readonly<Record<MatchComponentName, string>> = {
  skills: t("matchComponentSkills"),
  role: t("matchComponentRole"),
  seniority: t("matchComponentSeniority"),
  location: t("matchComponentLocation"),
  salary: t("matchComponentSalary"),
};

function ReasonList({
  kind,
  reasons,
}: {
  kind: "strength" | "gap";
  reasons: readonly MatchReason[];
}) {
  if (reasons.length === 0) return null;
  const Icon = kind === "strength" ? CircleCheck : CircleAlert;
  return (
    <div>
      <h4 className="text-xs font-semibold">
        {kind === "strength" ? t("matchStrengths") : t("matchGaps")}
      </h4>
      <ul className="mt-2 space-y-2">
        {reasons.map((reason) => (
          <li className="flex items-start gap-2 text-xs leading-5 text-[var(--text-secondary)]" key={reason.code}>
            <Icon
              aria-hidden="true"
              className={kind === "strength" ? "mt-0.5 size-3.5 shrink-0 text-[var(--positive)]" : "mt-0.5 size-3.5 shrink-0 text-[var(--warning)]"}
            />
            <span>
              {matchReasonLabel(reason)}
              {reason.values.length > 0 ? (
                <span className="block break-words text-[10px] text-[var(--text-tertiary)]">
                  {reason.values.join(" · ")}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MatchBreakdownCard({ breakdown }: { breakdown: MatchBreakdown }) {
  const entries = Object.entries(breakdown.components) as [
    MatchComponentName,
    number | null,
  ][];
  return (
    <section
      aria-labelledby="match-breakdown-heading"
      className="surface-card mt-5 p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold" id="match-breakdown-heading">
          {t("matchBreakdown")}
        </h3>
        <p className="text-sm font-semibold tabular-nums text-[var(--accent)]">
          {breakdown.score}% {t("matchLabel")}
        </p>
      </div>
      <div className="mt-4 space-y-2.5">
        {entries.map(([component, score]) => (
          <div className="grid grid-cols-[minmax(0,1fr)_96px_52px] items-center gap-2 text-xs" key={component}>
            <span className="truncate text-[var(--text-secondary)]">{componentLabels[component]}</span>
            <span className="h-1.5 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--surface-active)]">
              {score === null ? null : (
                <span
                  aria-hidden="true"
                  className="block h-full bg-[var(--accent)]"
                  style={{ width: `${score}%` }}
                />
              )}
            </span>
            <span className="text-right tabular-nums text-[var(--text-tertiary)]">
              {score === null ? t("matchUnknown") : `${score}%`}
            </span>
          </div>
        ))}
      </div>
      {breakdown.strengths.length > 0 || breakdown.gaps.length > 0 ? (
        <div className="mt-5 grid gap-4 border-t border-[var(--border)] pt-4 md:grid-cols-2">
          <ReasonList kind="strength" reasons={breakdown.strengths} />
          <ReasonList kind="gap" reasons={breakdown.gaps} />
        </div>
      ) : null}
    </section>
  );
}
