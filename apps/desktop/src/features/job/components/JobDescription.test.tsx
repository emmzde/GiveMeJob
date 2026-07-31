import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JobDescription } from "@/features/job/components/JobDescription";
import { parseJobDescription } from "@/features/job/jobDescription";
import { t } from "@/lib/i18n";

describe("JobDescription", () => {
  it("turns source-style responsibility lines into an accessible list", () => {
    expect(
      parseJobDescription("Responsibilities:\nOwn the roadmap\nMentor engineers\nShip reliably"),
    ).toEqual([
      { kind: "heading", text: "Responsibilities" },
      { items: ["Own the roadmap", "Mentor engineers", "Ship reliably"], kind: "list" },
    ]);
  });

  it("separates NOTE content and keeps untrusted markup inert", () => {
    render(
      <JobDescription description={'NOTE: Apply locally\n\n<script>alert(1)</script> [x](javascript:alert(1))'} />,
    );

    expect(screen.getByText(t("note"))).toBeInTheDocument();
    const description = screen.getByTestId("job-description");
    expect(description).toHaveTextContent("<script>alert(1)</script>");
    expect(within(description).queryByRole("link")).not.toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });
});
