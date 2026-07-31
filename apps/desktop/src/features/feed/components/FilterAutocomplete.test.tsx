import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  FilterAutocomplete,
  SuggestionList,
} from "@/features/feed/components/FilterAutocomplete";
import type { FilterSuggestion } from "@/features/feed/components/FilterAutocomplete";

const suggestions: FilterSuggestion[] = [
  { count: 100, label: "Rust", value: "Rust" },
  { count: 90, label: "Ruby", value: "Ruby" },
];

describe("FilterAutocomplete", () => {
  it("supports Arrow keys and Enter while keeping focus in the combobox", () => {
    const onSelect = vi.fn();
    render(
      <FilterAutocomplete
        isLoading={false}
        label="Навыки"
        onQueryChange={() => undefined}
        onSelect={onSelect}
        placeholder="Навык"
        query="ru"
        suggestions={suggestions}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Навыки" });
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", expect.stringContaining("option-1"));
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(suggestions[1]);
    expect(input).toHaveFocus();
  });

  it("virtualizes suggestion collections longer than 50 items", async () => {
    const heightSpy = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(220);
    const widthSpy = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockReturnValue(260);
    const manySuggestions = Array.from({ length: 51 }, (_, index) => ({
      count: 51 - index,
      label: `Навык ${index}`,
      value: `skill-${index}`,
    }));

    render(
      <SuggestionList
        activeIndex={-1}
        id="large-list"
        onSelect={() => undefined}
        suggestions={manySuggestions}
      />,
    );

    expect(screen.getByRole("listbox")).toHaveAttribute("data-virtualized", "true");
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
    expect(screen.getAllByRole("option").length).toBeLessThan(manySuggestions.length);
    heightSpy.mockRestore();
    widthSpy.mockRestore();
  });
});
