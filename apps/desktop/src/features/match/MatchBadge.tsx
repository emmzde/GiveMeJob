import type { MatchBreakdown } from "@/lib/match";
import { t } from "@/lib/i18n";

export function MatchBadge({
  breakdown,
  hasProfile,
  isLoading = false,
}: {
  breakdown?: MatchBreakdown;
  hasProfile: boolean;
  isLoading?: boolean;
}) {
  if (!hasProfile) return null;
  if (isLoading && breakdown === undefined) {
    return (
      <span
        aria-label={t("matchLoading")}
        className="h-5 w-16 animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface-active)]"
        role="status"
      />
    );
  }
  if (breakdown === undefined) return null;
  const tone = breakdown.score >= 70
    ? "strong"
    : breakdown.score >= 40
      ? "medium"
      : breakdown.score >= 25
        ? "weak"
        : "low";
  return (
    <span
      aria-label={`${breakdown.score}% ${t("matchLabel")}`}
      className="match-badge ui-mono inline-flex h-5 shrink-0 items-center gap-1 rounded-[var(--radius-sm)] px-1.5 text-[10px] font-semibold"
      data-tone={tone}
    >
      {breakdown.score}% <span className="font-medium">{t("matchLabel")}</span>
    </span>
  );
}
