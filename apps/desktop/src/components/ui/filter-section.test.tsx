import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FilterSection } from "@/components/ui/filter-section";

describe("FilterSection", () => {
  it("is keyboard-accessible, collapsible, and reports its active value count", () => {
    render(
      <FilterSection activeCount={2} title="Грейд">
        <button type="button">Senior</button>
      </FilterSection>,
    );

    const title = screen.getAllByText("Грейд")[0]!;
    const disclosure = title.closest("details");
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByLabelText("Выбрано: Грейд")).toHaveTextContent("2");

    fireEvent.click(title.closest("summary")!);
    expect(disclosure).not.toHaveAttribute("open");
  });
});
