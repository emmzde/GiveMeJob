import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { resetAppUiStore, useAppUiStore } from "@/app/store/appUiStore";
import { ThemeControl } from "@/app/ThemeControl";
import { t } from "@/lib/i18n";

describe("ThemeControl", () => {
  beforeEach(() => {
    resetAppUiStore();
    window.localStorage.clear();
  });

  it("offers system, light, and dark and keeps the choice in session state", () => {
    render(<ThemeControl />);
    const control = screen.getByRole("combobox", { name: t("theme") });

    expect(control).toHaveValue("system");
    expect(screen.getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual([
      "system",
      "light",
      "dark",
    ]);

    fireEvent.change(control, { target: { value: "dark" } });
    expect(useAppUiStore.getState().theme).toBe("dark");
    expect(window.localStorage).toHaveLength(0);
  });
});
