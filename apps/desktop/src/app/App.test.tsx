import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/app/App";
import { jobIdSchema } from "@/lib/catalog";
import type { CatalogStatus, JobSummary } from "@/lib/catalog";
import { defaultLocale, t } from "@/lib/i18n";

const catalogMocks = vi.hoisted(() => ({
  getCatalogStatus: vi.fn(),
  searchLocalJobs: vi.fn(),
}));

vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return {
    ...actual,
    getCatalogStatus: catalogMocks.getCatalogStatus,
    searchLocalJobs: catalogMocks.searchLocalJobs,
  };
});

const readyStatus: CatalogStatus = {
  state: "ready",
  catalogVersion: "catalog-v1",
  sourceFrozenAt: "2026-07-31T00:00:00Z",
  totalJobs: 78_719,
  message: null,
};

const sampleJob: JobSummary = {
  id: jobIdSchema.parse("1"),
  title: "Senior Rust Engineer",
  company: "Local Systems",
  locationText: "Remote",
  remoteMode: "remote",
  seniority: "senior",
  salaryMin: 120_000,
  salaryMax: 150_000,
  salaryCurrency: "USD",
  salaryPeriod: "year",
  postedAt: "2026-07-30T00:00:00Z",
  source: "greenhouse",
  attribution: "Greenhouse",
};

describe("App", () => {
  beforeEach(() => {
    catalogMocks.getCatalogStatus.mockReset();
    catalogMocks.searchLocalJobs.mockReset();
    catalogMocks.getCatalogStatus.mockResolvedValue(readyStatus);
    catalogMocks.searchLocalJobs.mockResolvedValue({
      items: [sampleJob],
      nextCursor: null,
      total: 1,
    });
  });

  it("shows the shell and an initial skeleton while the search is pending", () => {
    catalogMocks.searchLocalJobs.mockReturnValue(new Promise(() => undefined));

    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Поиск по локальному каталогу",
    );
    expect(screen.getByRole("navigation", { name: "Основная навигация" })).toBeInTheDocument();
    expect(screen.getByTestId("initial-search-skeleton")).toBeInTheDocument();
    expect(screen.getByText(t("resultsLoading"))).toHaveAttribute("aria-live", "polite");
  });

  it("keeps successful search results when initial catalog status rejects", async () => {
    catalogMocks.getCatalogStatus.mockRejectedValue(new Error("status IPC failed"));

    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 2, name: sampleJob.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(t("catalogError"))).toHaveAttribute("role", "alert");
    expect(screen.getByText(`1 ${t("resultsFound")}`)).toBeInTheDocument();
  });

  it("keeps ready catalog status visible when the initial search rejects", async () => {
    catalogMocks.searchLocalJobs.mockRejectedValue(new Error("search IPC failed"));

    render(<App />);

    expect(await screen.findByText(t("initialSearchError"))).toHaveAttribute("role", "alert");
    expect(screen.getByText(t("offlineReady"))).toBeInTheDocument();
    expect(screen.queryByText(t("empty"))).not.toBeInTheDocument();
  });

  it.each([
    ["ready", t("offlineReady")],
    ["missing", t("catalogMissing")],
    ["error", t("catalogError")],
  ] as const)("renders the %s catalog state distinctly", async (state, label) => {
    catalogMocks.getCatalogStatus.mockResolvedValue({
      ...readyStatus,
      state,
      totalJobs: state === "ready" ? readyStatus.totalJobs : 0,
    });

    render(<App />);

    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it("reports submit errors without discarding previous results", async () => {
    catalogMocks.searchLocalJobs
      .mockResolvedValueOnce({ items: [sampleJob], nextCursor: null, total: 1 })
      .mockRejectedValueOnce(new Error("search failed"));

    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });

    fireEvent.change(screen.getByRole("textbox", { name: t("searchPlaceholder") }), {
      target: { value: "rust" },
    });
    fireEvent.submit(screen.getByRole("button", { name: t("search") }).closest("form")!);

    expect(await screen.findByText(t("submitSearchError"))).toHaveAttribute("role", "alert");
    expect(screen.getAllByText(sampleJob.title)).toHaveLength(2);
    expect(screen.getByText(`1 ${t("resultsFound")}`)).toHaveAttribute("aria-live", "polite");
    expect(catalogMocks.searchLocalJobs).toHaveBeenCalledTimes(2);
  });

  it("hides shortlist, marks future navigation, and disables the original link", async () => {
    render(<App />);

    await screen.findByRole("heading", { level: 2, name: sampleJob.title });

    expect(screen.queryByText(t("shortlist"))).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `${t("profile")} — ${t("later")}` }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: `${t("emmy")} — ${t("later")}` }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: t("openOriginal") })).toBeDisabled();
  });

  it("renders through the configured Russian i18n layer", () => {
    expect(defaultLocale).toBe("ru");
    expect(t("offlineReady")).toBe("Работает без сети");
  });

  it("settles the loading announcement after a successful search", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText(t("resultsLoading"))).not.toBeInTheDocument();
    });
    expect(screen.getByText(`1 ${t("resultsFound")}`)).toHaveAttribute("role", "status");
  });

  it("shows the loaded item count when exact total is absent", async () => {
    catalogMocks.searchLocalJobs.mockResolvedValue({
      items: [sampleJob],
      nextCursor: null,
    });

    render(<App />);

    expect(await screen.findByText(`1 ${t("resultsFound")}`)).toBeInTheDocument();
  });
});
