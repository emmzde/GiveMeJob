import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FilterSection } from "@/components/ui/filter-section";

describe("FilterSection", () => {
  it("gives its controls an accessible fieldset name and optional description", () => {
    render(
      <FilterSection description="Можно выбрать несколько" title="Формат работы">
        <label>
          <input type="checkbox" /> Удалённо
        </label>
      </FilterSection>,
    );

    const group = screen.getByRole("group", { name: "Формат работы" });
    expect(group).toContainElement(screen.getByRole("checkbox", { name: "Удалённо" }));
    expect(screen.getByText("Можно выбрать несколько")).toBeInTheDocument();
  });
});
