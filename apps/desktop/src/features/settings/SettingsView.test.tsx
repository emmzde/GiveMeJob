import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CatalogViewState } from "@/features/catalog/catalogStatus";
import { SettingsView } from "@/features/settings/SettingsView";
import { t } from "@/lib/i18n";

vi.mock("@/features/emmy/EmmyProviderSettings", () => ({
  EmmyProviderSettings: () => <div data-testid="provider-route" />,
}));

const readyCatalog: CatalogViewState = {
  isError: false,
  isPending: false,
  status: {
    catalogVersion: "catalog-v1",
    message: null,
    progress: 100,
    sourceFrozenAt: "2026-07-31T00:00:00Z",
    stage: null,
    state: "ready",
    totalJobs: 78_719,
  },
};

describe("SettingsView", () => {
  it("uses a navigation rail and flat semantic sections", () => {
    render(<SettingsView catalog={readyCatalog} />);

    const navigation = screen.getByRole("navigation", { name: t("settingsTitle") });
    expect(within(navigation).getByRole("link", { name: t("appearance") })).toHaveAttribute(
      "href",
      "#appearance-heading",
    );
    expect(within(navigation).getByRole("link", { name: t("language") })).toHaveAttribute(
      "href",
      "#language-heading",
    );
    expect(screen.getByRole("region", { name: t("appearance") })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: t("language") })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: t("localCatalog") })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: t("emmyCredentials") })).toBeInTheDocument();
    expect(screen.getByTestId("provider-route")).toBeInTheDocument();
    expect(screen.getByText("catalog-v1")).toBeInTheDocument();
  });
});
