import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/app/AppShell";
import { createAppQueryClient } from "@/app/queryClient";
import { resetAppUiStore, useAppUiStore } from "@/app/store/appUiStore";
import type { CatalogViewState } from "@/features/catalog/catalogStatus";
import { t } from "@/lib/i18n";

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
      <QueryClientProvider client={createAppQueryClient()}>
        <AppShell catalog={readyCatalog}>
          <p>content</p>
        </AppShell>
      </QueryClientProvider>,
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
      <QueryClientProvider client={createAppQueryClient()}>
        <AppShell catalog={readyCatalog}>
          <p>content</p>
        </AppShell>
      </QueryClientProvider>,
    );

    act(() => useAppUiStore.getState().setTheme("dark"));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("uses one Emmy trigger in the titlebar and toggles the chat panel", () => {
    const { container } = render(
      <QueryClientProvider client={createAppQueryClient()}>
        <AppShell catalog={readyCatalog}>
          <p>content</p>
        </AppShell>
      </QueryClientProvider>,
    );
    const titlebar = within(container.querySelector("header") as HTMLElement);
    const trigger = titlebar.getByRole("button", { name: t("openEmmy") });

    expect(trigger).toHaveAttribute("aria-pressed", "false");
    expect(titlebar.getByText(t("offlineReady"))).toHaveClass("sr-only");
    expect(titlebar.queryByText(t("aiReady"))).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(useAppUiStore.getState().panel).toBe("emmy");
    expect(screen.getByRole("button", { name: t("closeEmmy") })).toHaveAttribute("aria-pressed", "true");
  });
});
