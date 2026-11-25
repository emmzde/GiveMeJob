import { render, screen } from "@testing-library/react";
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
  it("groups settings into Emmy, appearance and catalog sections", () => {
    render(<SettingsView catalog={readyCatalog} />);

    expect(screen.queryByRole("navigation", { name: t("settingsTitle") })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: t("appearance") })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: t("language") })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: t("localCatalog") })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: t("settingsGroupEmmy") })).toBeInTheDocument();
    expect(screen.getByTestId("provider-route")).toBeInTheDocument();
    expect(screen.getByText("catalog-v1")).toBeInTheDocument();
  });
});
