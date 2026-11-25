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
      <h4 className="match-reason-label text-xs font-semibold">
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

function MatchGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const angle = Math.PI * (1 - clamped / 100);
  const markerX = 100 + 80 * Math.cos(angle);
  const markerY = 100 - 80 * Math.sin(angle);
  return (
    <div aria-hidden="true" className="match-gauge">
      <svg fill="none" viewBox="0 0 200 112">
        <defs>
          <linearGradient gradientUnits="userSpaceOnUse" id="match-gauge-gradient" x1="20" x2="180" y1="0" y2="0">
            <stop offset="0" stopColor="#A78BFA" />
            <stop offset="0.6" stopColor="#4ADE80" />
            <stop offset="1" stopColor="#5EEAD4" />
          </linearGradient>
        </defs>
        <path className="match-gauge-track" d="M20 100a80 80 0 0 1 160 0" pathLength={100} />
        <path
          className="match-gauge-value"
          d="M20 100a80 80 0 0 1 160 0"
          pathLength={100}
          stroke="url(#match-gauge-gradient)"
          strokeDasharray={`${clamped} 100`}
        />
        <g transform={`translate(${markerX.toFixed(2)} ${markerY.toFixed(2)})`}>
          <circle className="match-gauge-marker-halo" r="9" />
          <path className="match-gauge-marker" d="M0-6.5 1.6-1.6 6.5 0 1.6 1.6 0 6.5-1.6 1.6-6.5 0-1.6-1.6Z" />
        </g>
      </svg>
      <span className="match-gauge-value-text">{clamped}</span>
      <span className="match-gauge-caption">{t("matchLabel")}</span>
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
      className="match-card mt-4"
    >
      <h3 className="match-card-title" id="match-breakdown-heading">
        {t("matchBreakdown")}
      </h3>
      <p className="sr-only">
        {breakdown.score}% {t("matchLabel")}
      </p>
      <MatchGauge score={breakdown.score} />
      <div className="match-components">
        {entries.map(([component, score]) => (
          <div className="match-component" key={component}>
            <span className="match-component-label">{componentLabels[component]}</span>
            <span className="match-component-track">
              {score === null ? null : (
                <span aria-hidden="true" className="match-component-fill" style={{ width: `${score}%` }} />
              )}
            </span>
            <span className="match-component-value">
              {score === null ? t("matchUnknown") : `${score}%`}
            </span>
          </div>
        ))}
      </div>
      {breakdown.strengths.length > 0 || breakdown.gaps.length > 0 ? (
        <div className="match-reasons">
          <ReasonList kind="strength" reasons={breakdown.strengths} />
          <ReasonList kind="gap" reasons={breakdown.gaps} />
        </div>
      ) : null}
    </section>
  );
}
