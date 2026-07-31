import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getActiveFilterChips } from "@/features/feed/activeFilterChips";
import { ActiveFilterChips } from "@/features/feed/components/ActiveFilterChips";
import { createSearchDraft } from "@/features/feed/searchDraft";
import { t } from "@/lib/i18n";

describe("ActiveFilterChips", () => {
  it("builds one removable chip per active value and one for non-default sort", () => {
    const draft = createSearchDraft({
      remoteModes: ["remote", "hybrid"],
      salaryKnownOnly: true,
      sort: "newest",
    });

    expect(getActiveFilterChips(draft).map((chip) => chip.id)).toEqual([
      "remote:remote",
      "remote:hybrid",
      "salary:known",
      "sort",
    ]);
  });

  it("removes one chip without changing the other filters", () => {
    const onChange = vi.fn();
    const draft = createSearchDraft({
      remoteModes: ["remote"],
      seniorities: ["senior"],
    });
    render(<ActiveFilterChips draft={draft} onChange={onChange} />);

    fireEvent.click(
      screen.getByRole("button", { name: `${t("removeFilter")}: Удалённая работа` }),
    );

    expect(onChange).toHaveBeenCalledWith(
      createSearchDraft({ seniorities: ["senior"] }),
    );
  });

  it("clears filters and sort but preserves text", () => {
    const onChange = vi.fn();
    const draft = createSearchDraft({
      text: "rust",
      skills: ["Rust"],
      sort: "salary",
    });
    render(<ActiveFilterChips draft={draft} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: t("clearAllFilters") }));

    expect(onChange).toHaveBeenCalledWith(createSearchDraft({ text: "rust" }));
  });
});
