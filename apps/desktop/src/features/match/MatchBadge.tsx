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
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--accent-border)] bg-[var(--accent-muted)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--accent)]">
      {breakdown.score}% <span className="font-medium">{t("matchLabel")}</span>
    </span>
  );
}
