import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render as testingLibraryRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/app/App";
import { createAppQueryClient } from "@/app/queryClient";
import { resetAppUiStore } from "@/app/store/appUiStore";
import { jobIdSchema } from "@/lib/catalog";
import type {
  CatalogStatus,
  JobDetail,
  JobSearchPage,
  JobSummary,
  SearchQuery,
} from "@/lib/catalog";
import { defaultLocale, t } from "@/lib/i18n";

const catalogMocks = vi.hoisted(() => ({
  getCatalogStatus: vi.fn(),
  getLocalJob: vi.fn(),
  openOriginalJob: vi.fn(),
  recoverLocalCatalog: vi.fn(),
  searchLocalJobs: vi.fn(),
  watchCatalogStatus: vi.fn(),
}));

vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return {
    ...actual,
    getCatalogStatus: catalogMocks.getCatalogStatus,
    getLocalJob: catalogMocks.getLocalJob,
    openOriginalJob: catalogMocks.openOriginalJob,
    recoverLocalCatalog: catalogMocks.recoverLocalCatalog,
    searchLocalJobs: catalogMocks.searchLocalJobs,
    watchCatalogStatus: catalogMocks.watchCatalogStatus,
  };
});

const readyStatus: CatalogStatus = {
  state: "ready",
  stage: null,
  progress: 100,
  catalogVersion: "1",
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

const sampleDetail: JobDetail = {
  ...sampleJob,
  description:
    "Build local systems.\n\n[Do not trust this](javascript:alert(1)) <script>alert(1)</script>",
  skills: ["Rust", "SQLite"],
  employmentType: "full_time",
  salaryUsdYear: 135_000,
  sourceUrl: "https://example.test/jobs/1",
  applyUrl: null,
  snapshotVersion: "1",
};

function render(ui: ReactElement) {
  return testingLibraryRender(
    <QueryClientProvider client={createAppQueryClient()}>
      {ui}
    </QueryClientProvider>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
}

describe("App", () => {
  beforeEach(() => {
    resetAppUiStore();
    catalogMocks.getCatalogStatus.mockReset();
    catalogMocks.getLocalJob.mockReset();
    catalogMocks.openOriginalJob.mockReset();
    catalogMocks.recoverLocalCatalog.mockReset();
    catalogMocks.searchLocalJobs.mockReset();
    catalogMocks.watchCatalogStatus.mockReset();
    catalogMocks.getCatalogStatus.mockResolvedValue(readyStatus);
    catalogMocks.getLocalJob.mockResolvedValue(sampleDetail);
    catalogMocks.openOriginalJob.mockResolvedValue(null);
    catalogMocks.recoverLocalCatalog.mockResolvedValue(readyStatus);
    catalogMocks.searchLocalJobs.mockResolvedValue({
      items: [sampleJob],
      nextCursor: null,
      total: 1,
    });
    catalogMocks.watchCatalogStatus.mockResolvedValue(() => undefined);
  });

  it("shows the shell and an initial skeleton while the search is pending", () => {
    catalogMocks.searchLocalJobs.mockReturnValue(new Promise(() => undefined));

    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Поиск по локальному каталогу",
    );
    expect(screen.getByRole("navigation", { name: "Основная навигация" })).toBeInTheDocument();
    expect(screen.getByTestId("initial-search-skeleton")).toBeInTheDocument();
    expect(screen.getByText(t("catalogPreparingSearch"))).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("does not query SQLite until catalog initialization reports ready", async () => {
    catalogMocks.getCatalogStatus.mockRejectedValue(new Error("status IPC failed"));

    render(<App />);

    expect(await screen.findByText(t("catalogError"))).toHaveAttribute("role", "alert");
    expect(catalogMocks.searchLocalJobs).not.toHaveBeenCalled();
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
    ["initializing", t("catalogInitializing")],
    ["verifying", t("catalogVerifying")],
    ["recovering", t("catalogRecovering")],
    ["missing", t("catalogMissing")],
    ["error", t("catalogError")],
  ] as const)("renders the %s catalog state distinctly", async (state, label) => {
    catalogMocks.getCatalogStatus.mockResolvedValue({
      ...readyStatus,
      state,
      stage: state === "ready" || state === "missing" || state === "error" ? null : "starting",
      progress: state === "ready" ? 100 : 10,
      totalJobs: state === "ready" ? readyStatus.totalJobs : 0,
    });

    render(<App />);

    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it("shows monotonic initialization progress and starts search after the ready event", async () => {
    let publishStatus: ((status: CatalogStatus) => void) | undefined;
    catalogMocks.getCatalogStatus.mockResolvedValue({
      ...readyStatus,
      state: "initializing",
      stage: "decompressing",
      progress: 42,
    });
    catalogMocks.watchCatalogStatus.mockImplementation(
      (listener: (status: CatalogStatus) => void) => {
        publishStatus = listener;
        return Promise.resolve(() => undefined);
      },
    );

    render(<App />);

    expect(await screen.findByText(t("catalogStageDecompressing"))).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(catalogMocks.searchLocalJobs).not.toHaveBeenCalled();

    publishStatus?.(readyStatus);

    expect(
      await screen.findByRole("heading", { level: 2, name: sampleJob.title }),
    ).toBeInTheDocument();
    expect(catalogMocks.searchLocalJobs).toHaveBeenCalledTimes(1);
  });

  it("offers a user-triggered catalog recovery", async () => {
    catalogMocks.getCatalogStatus.mockResolvedValue({
      ...readyStatus,
      state: "error",
      progress: 68,
      totalJobs: 0,
    });

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: t("catalogRetry") }));

    await waitFor(() => {
      expect(catalogMocks.recoverLocalCatalog).toHaveBeenCalledTimes(1);
    });
    expect(
      await screen.findByRole("heading", { level: 2, name: sampleJob.title }),
    ).toBeInTheDocument();
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

  it("keeps text changes in the draft until submit", async () => {
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });

    const input = screen.getByRole("textbox", { name: t("searchPlaceholder") });
    fireEvent.change(input, { target: { value: "r" } });
    fireEvent.change(input, { target: { value: "ru" } });
    fireEvent.change(input, { target: { value: "rust" } });

    expect(catalogMocks.searchLocalJobs).toHaveBeenCalledTimes(1);

    fireEvent.submit(screen.getByRole("button", { name: t("search") }).closest("form")!);
    await waitFor(() => expect(catalogMocks.searchLocalJobs).toHaveBeenCalledTimes(2));
    expect(catalogMocks.searchLocalJobs.mock.calls[1]?.[0]).toMatchObject({ text: "rust" });
  });

  it("keeps the previous page visible while a filter query is pending", async () => {
    const nextPage = deferred<JobSearchPage>();
    catalogMocks.searchLocalJobs
      .mockResolvedValueOnce({ items: [sampleJob], nextCursor: null, total: 1 })
      .mockReturnValueOnce(nextPage.promise);

    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });

    fireEvent.click(screen.getByRole("button", { name: t("remoteOnly") }));
    await waitFor(() => expect(catalogMocks.searchLocalJobs).toHaveBeenCalledTimes(2));

    expect(screen.getAllByText(sampleJob.title)).toHaveLength(2);
    expect(screen.getByText(t("resultsLoading"))).toBeInTheDocument();

    await act(async () => {
      nextPage.resolve({ items: [], nextCursor: null, total: 0 });
      await nextPage.promise;
    });
    expect(await screen.findByText(t("empty"))).toBeInTheDocument();
  });

  it("does not let a late old response replace the current query", async () => {
    const slowPage = deferred<JobSearchPage>();
    const slowJob: JobSummary = {
      ...sampleJob,
      id: jobIdSchema.parse("2"),
      title: "Slow response job",
    };
    const fastJob: JobSummary = {
      ...sampleJob,
      id: jobIdSchema.parse("3"),
      title: "Current response job",
    };
    catalogMocks.searchLocalJobs.mockImplementation((query: SearchQuery) => {
      if (query.text === "slow") return slowPage.promise;
      if (query.text === "fast") {
        return Promise.resolve({ items: [fastJob], nextCursor: null, total: 1 });
      }
      return Promise.resolve({ items: [sampleJob], nextCursor: null, total: 1 });
    });
    catalogMocks.getLocalJob.mockImplementation((id: JobSummary["id"]) => {
      const job = id === fastJob.id ? fastJob : id === slowJob.id ? slowJob : sampleJob;
      return Promise.resolve({
        ...sampleDetail,
        ...job,
        sourceUrl: `https://example.test/jobs/${id}`,
      });
    });

    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });
    const input = screen.getByRole("textbox", { name: t("searchPlaceholder") });

    fireEvent.change(input, { target: { value: "slow" } });
    fireEvent.click(screen.getByRole("button", { name: t("remoteOnly") }));
    await waitFor(() => expect(catalogMocks.searchLocalJobs).toHaveBeenCalledTimes(2));

    fireEvent.change(input, { target: { value: "fast" } });
    fireEvent.click(screen.getByRole("button", { name: t("remoteOnly") }));
    expect(
      await screen.findByRole("heading", { level: 2, name: fastJob.title }),
    ).toBeInTheDocument();

    await act(async () => {
      slowPage.resolve({ items: [slowJob], nextCursor: null, total: 1 });
      await slowPage.promise;
    });

    expect(screen.getAllByText(fastJob.title)).toHaveLength(2);
    expect(screen.queryByText(slowJob.title)).not.toBeInTheDocument();
  });

  it("loads detail separately and opens the original by job ID", async () => {
    render(<App />);

    await screen.findByRole("heading", { level: 2, name: sampleJob.title });

    expect(catalogMocks.getLocalJob).toHaveBeenCalledWith(sampleJob.id);
    expect(screen.queryByText(t("shortlist"))).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `${t("profile")} — ${t("later")}` }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: `${t("emmy")} — ${t("later")}` }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: t("openOriginal") }));
    expect(catalogMocks.openOriginalJob).toHaveBeenCalledWith(sampleJob.id);
  });

  it("renders untrusted descriptions as inert text without active links", async () => {
    render(<App />);

    const description = await screen.findByTestId("job-description");
    expect(description).toHaveTextContent("javascript:alert(1)");
    expect(description).toHaveTextContent("<script>alert(1)</script>");
    expect(within(description).queryByRole("link")).not.toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });

  it("keeps the local card available when the system browser cannot open", async () => {
    catalogMocks.openOriginalJob.mockRejectedValue({ code: "open_failed" });
    render(<App />);

    await screen.findByTestId("job-description");
    fireEvent.click(screen.getByRole("button", { name: t("openOriginal") }));

    expect(await screen.findByText(t("originalOpenError"))).toHaveAttribute("role", "alert");
    expect(screen.getByTestId("job-description")).toHaveTextContent("Build local systems");
    expect(screen.getByRole("heading", { level: 2, name: sampleJob.title })).toBeInTheDocument();
  });

  it("supports Ctrl+Enter for the selected original", async () => {
    render(<App />);

    await screen.findByTestId("job-description");
    fireEvent.keyDown(window, { ctrlKey: true, key: "Enter" });

    expect(catalogMocks.openOriginalJob).toHaveBeenCalledWith(sampleJob.id);
  });

  it("renders through the configured Russian i18n layer", () => {
    expect(defaultLocale).toBe("ru");
    expect(t("offlineReady")).toBe("Работает без сети");
  });

  it("settles the loading announcement after a successful search", async () => {
    render(<App />);

    expect(await screen.findByText(`1 ${t("resultsFound")}`)).toHaveAttribute("role", "status");
    expect(screen.queryByText(t("resultsLoading"))).not.toBeInTheDocument();
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
