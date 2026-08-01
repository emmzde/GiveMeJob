import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MatchBreakdownCard } from "@/features/match/MatchBreakdownCard";

describe("MatchBreakdownCard", () => {
  it("renders known and unknown components with factual reasons", () => {
    render(
      <MatchBreakdownCard
        breakdown={{
          score: 82,
          components: {
            skills: 75,
            role: 100,
            seniority: 70,
            location: 75,
            salary: null,
          },
          strengths: [
            { component: "skills", code: "skills_overlap", values: ["Rust"] },
          ],
          gaps: [],
        }}
      />,
    );
    expect(screen.getByText(/82%/)).toBeInTheDocument();
    expect(screen.getByText("Нет данных")).toBeInTheDocument();
    expect(screen.getByText("Rust")).toBeInTheDocument();
  });
});
