import { createRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  FilterAutocomplete,
  SuggestionList,
} from "@/features/feed/components/FilterAutocomplete";
import type { FilterSuggestion } from "@/features/feed/components/FilterAutocomplete";
import { t } from "@/lib/i18n";

const suggestions: FilterSuggestion[] = [
  { count: 100, label: "Rust", value: "Rust" },
  { count: 90, label: "Ruby", value: "Ruby" },
];

describe("FilterAutocomplete", () => {
  it("shows popular IPC suggestions on focus before any text is entered", () => {
    render(
      <FilterAutocomplete
        isLoading={false}
        label="Навыки"
        onQueryChange={() => undefined}
        onSelect={() => undefined}
        placeholder="Навык"
        query=""
        suggestions={suggestions}
      />,
    );

    fireEvent.focus(screen.getByRole("combobox", { name: "Навыки" }));

    expect(screen.getByText(t("popularSuggestions"))).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

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

  it("forwards field error metadata and the input ref", () => {
    const inputRef = createRef<HTMLInputElement>();
    render(
      <FilterAutocomplete
        ariaDescribedBy="skills-error"
        ariaInvalid
        inputRef={inputRef}
        isLoading={false}
        label="Навыки"
        onQueryChange={() => undefined}
        onSelect={() => undefined}
        placeholder="Навык"
        query=""
        suggestions={[]}
      />,
    );

    expect(inputRef.current).toBe(screen.getByRole("combobox", { name: "Навыки" }));
    expect(inputRef.current).toHaveAttribute("aria-describedby", "skills-error");
    expect(inputRef.current).toHaveAttribute("aria-invalid", "true");
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
