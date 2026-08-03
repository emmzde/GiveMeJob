import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MatchBadge } from "@/features/match/MatchBadge";
import type { MatchBreakdown } from "@/lib/match";
import { t } from "@/lib/i18n";

function breakdown(score: number): MatchBreakdown {
  return {
    score,
    components: {
      skills: null,
      role: null,
      seniority: null,
      location: null,
      salary: null,
    },
    strengths: [],
    gaps: [],
  };
}

describe("MatchBadge", () => {
  it.each([
    [70, "strong"],
    [40, "medium"],
    [25, "weak"],
    [24, "low"],
  ] as const)("maps %i percent to the %s visual tone", (score, tone) => {
    render(<MatchBadge breakdown={breakdown(score)} hasProfile />);

    expect(screen.getByLabelText(`${score}% ${t("matchLabel")}`)).toHaveAttribute(
      "data-tone",
      tone,
    );
  });
});
