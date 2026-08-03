import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { LanguageControl } from "@/app/LanguageControl";
import { resetAppUiStore, useAppUiStore } from "@/app/store/appUiStore";
import { getActiveLocale, t } from "@/lib/i18n";

describe("LanguageControl", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetAppUiStore();
  });

  it("switches the active interface language and persists the choice", () => {
    render(<LanguageControl />);

    const russian = screen.getByRole("radio", { name: "Русский" });
    const english = screen.getByRole("radio", { name: "English" });
    expect(screen.getByRole("group", { name: t("language") })).toBeInTheDocument();
    expect(russian).toBeChecked();

    fireEvent.click(english);

    expect(english).toBeChecked();
    expect(useAppUiStore.getState().language).toBe("en");
    expect(getActiveLocale()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(window.localStorage.getItem("givemejob.ui-language")).toBe("en");
    expect(t("settingsTitle")).toBe("Settings");
  });
});
