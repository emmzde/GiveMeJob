import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SortControl } from "@/features/feed/components/SortControl";
import { searchSortLabels } from "@/features/feed/searchLabels";

describe("SortControl", () => {
  it("renders one accessible radio group and emits the selected backend value", () => {
    const onChange = vi.fn();
    render(<SortControl disabled={false} onChange={onChange} value="relevance" />);

    expect(screen.getByRole("group", { name: "Сортировка" })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: searchSortLabels.relevance }),
    ).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: searchSortLabels.salary }));
    expect(onChange).toHaveBeenCalledWith("salary");
  });
});
