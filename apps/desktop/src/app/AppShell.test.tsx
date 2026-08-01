import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/app/AppShell";
import { resetAppUiStore, useAppUiStore } from "@/app/store/appUiStore";
import type { CatalogViewState } from "@/features/catalog/catalogStatus";

const readyCatalog: CatalogViewState = {
  isError: false,
  isPending: false,
  status: {
    state: "ready",
    stage: null,
    progress: 100,
    catalogVersion: "1",
    sourceFrozenAt: "2026-07-31T00:00:00Z",
    totalJobs: 78_719,
    message: null,
  },
};

describe("AppShell themes", () => {
  beforeEach(resetAppUiStore);

  afterEach(() => {
    delete document.documentElement.dataset.theme;
    vi.unstubAllGlobals();
  });

  it("tracks system color changes and always sets the resolved data-theme", () => {
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    let systemPrefersDark = false;
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        get matches() {
          return systemPrefersDark;
        },
        addEventListener: (_type: string, next: (event: MediaQueryListEvent) => void) => {
          listener = next;
        },
        removeEventListener: vi.fn(),
      })),
    );

    render(
      <AppShell catalog={readyCatalog}>
        <p>content</p>
      </AppShell>,
    );

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    act(() => {
      systemPrefersDark = true;
      listener?.({ matches: true } as MediaQueryListEvent);
    });
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("applies an explicit session theme from UI state", () => {
    render(
      <AppShell catalog={readyCatalog}>
        <p>content</p>
      </AppShell>,
    );

    act(() => useAppUiStore.getState().setTheme("dark"));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});
