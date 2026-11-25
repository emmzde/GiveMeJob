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
    const choices = screen.getAllByRole("radio");
    const system = screen.getByRole("radio", { name: t("themeSystem") });
    const light = screen.getByRole("radio", { name: t("themeLight") });
    const dark = screen.getByRole("radio", { name: t("themeDark") });

    expect(screen.getByRole("group", { name: t("theme") })).toBeInTheDocument();
    expect(dark).toBeChecked();
    expect(choices.map((choice) => choice.getAttribute("value"))).toEqual([
      "system",
      "light",
      "dark",
    ]);

    fireEvent.click(system);
    expect(system).toBeChecked();
    expect(useAppUiStore.getState().theme).toBe("system");

    fireEvent.click(light);
    expect(light).toBeChecked();
    expect(useAppUiStore.getState().theme).toBe("light");
    expect(window.localStorage).toHaveLength(0);
  });
});
