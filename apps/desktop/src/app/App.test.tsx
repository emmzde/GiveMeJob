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
import { resetAppUiStore, useAppUiStore } from "@/app/store/appUiStore";
import { formatCount } from "@/features/feed/jobPresentation";
import {
  createSearchQuery,
  jobIdSchema,
  searchCursorSchema,
} from "@/lib/catalog";
import type {
  CatalogStatus,
  FilterOptions,
  JobDetail,
  JobSearchPage,
  JobSummary,
  SearchQuery,
} from "@/lib/catalog";
import { defaultLocale, t } from "@/lib/i18n";
import type { UserProfile } from "@/lib/profile";

const catalogMocks = vi.hoisted(() => ({
  autocompleteLocations: vi.fn(),
  autocompleteSkills: vi.fn(),
  getCatalogStatus: vi.fn(),
  getFilterOptions: vi.fn(),
  getLocalJob: vi.fn(),
  openOriginalJob: vi.fn(),
  recoverLocalCatalog: vi.fn(),
  searchLocalJobs: vi.fn(),
  watchCatalogStatus: vi.fn(),
}));

const profileMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}));
const shortlistMocks = vi.hoisted(() => ({
  isShortlisted: vi.fn(),
  listShortlist: vi.fn(),
  setShortlist: vi.fn(),
}));
const matchMocks = vi.hoisted(() => ({
  getMatchBreakdown: vi.fn(),
  getMatchBreakdowns: vi.fn(),
}));

vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return {
    ...actual,
    autocompleteLocations: catalogMocks.autocompleteLocations,
    autocompleteSkills: catalogMocks.autocompleteSkills,
    getCatalogStatus: catalogMocks.getCatalogStatus,
    getFilterOptions: catalogMocks.getFilterOptions,
    getLocalJob: catalogMocks.getLocalJob,
    openOriginalJob: catalogMocks.openOriginalJob,
    recoverLocalCatalog: catalogMocks.recoverLocalCatalog,
    searchLocalJobs: catalogMocks.searchLocalJobs,
    watchCatalogStatus: catalogMocks.watchCatalogStatus,
  };
});

vi.mock("@/lib/profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/profile")>();
  return {
    ...actual,
    getProfile: profileMocks.getProfile,
    saveProfile: profileMocks.saveProfile,
  };
});

vi.mock("@/lib/shortlist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/shortlist")>();
  return {
    ...actual,
    isShortlisted: shortlistMocks.isShortlisted,
    listShortlist: shortlistMocks.listShortlist,
    setShortlist: shortlistMocks.setShortlist,
  };
});

vi.mock("@/lib/match", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/match")>();
  return {
    ...actual,
    getMatchBreakdown: matchMocks.getMatchBreakdown,
    getMatchBreakdowns: matchMocks.getMatchBreakdowns,
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

const filterOptions: FilterOptions = {
  sources: [
    { source: "greenhouse", count: 7_918 },
    { source: "ashby", count: 1_204 },
  ],
  remoteModes: ["remote", "hybrid", "onsite"],
  seniorities: [
    "intern",
    "junior",
    "middle",
    "senior",
    "lead",
    "staff",
    "principal",
    "manager",
    "director",
    "executive",
  ],
  employmentTypes: [
    "full_time",
    "contract",
    "part_time",
    "internship",
    "temporary",
    "volunteer",
    "other",
  ],
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

const savedProfile: UserProfile = {
  preferredRoles: ["Rust Engineer"],
  seniority: "senior",
  skills: ["Rust (programming language)"],
  country: "Azerbaijan",
  city: "Baku",
  remoteModes: ["remote"],
  salaryMinUsdYear: 100_000,
  version: 1,
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-01T10:00:00.000Z",
};

const sampleMatch = {
  score: 88,
  components: {
    skills: 100,
    role: 100,
    seniority: 100,
    location: 75,
    salary: 60,
  },
  strengths: [
    { component: "skills" as const, code: "skills_overlap" as const, values: ["Rust"] },
  ],
  gaps: [
    { component: "salary" as const, code: "salary_below" as const, values: ["90000", "100000"] },
  ],
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

async function expectLatestSearchPayload(overrides: Partial<SearchQuery>): Promise<void> {
  await waitFor(() => {
    expect(catalogMocks.searchLocalJobs.mock.calls.at(-1)?.[0]).toEqual(
      createSearchQuery(overrides),
    );
  });
}

describe("App", () => {
  beforeEach(() => {
    resetAppUiStore();
    catalogMocks.autocompleteLocations.mockReset();
    catalogMocks.autocompleteSkills.mockReset();
    catalogMocks.getCatalogStatus.mockReset();
    catalogMocks.getFilterOptions.mockReset();
    catalogMocks.getLocalJob.mockReset();
    catalogMocks.openOriginalJob.mockReset();
    catalogMocks.recoverLocalCatalog.mockReset();
    catalogMocks.searchLocalJobs.mockReset();
    catalogMocks.watchCatalogStatus.mockReset();
    profileMocks.getProfile.mockReset();
    profileMocks.saveProfile.mockReset();
    shortlistMocks.isShortlisted.mockReset();
    shortlistMocks.listShortlist.mockReset();
    shortlistMocks.setShortlist.mockReset();
    matchMocks.getMatchBreakdown.mockReset();
    matchMocks.getMatchBreakdowns.mockReset();
    catalogMocks.autocompleteLocations.mockResolvedValue([]);
    catalogMocks.autocompleteSkills.mockResolvedValue([]);
    catalogMocks.getCatalogStatus.mockResolvedValue(readyStatus);
    catalogMocks.getFilterOptions.mockResolvedValue(filterOptions);
    catalogMocks.getLocalJob.mockResolvedValue(sampleDetail);
    catalogMocks.openOriginalJob.mockResolvedValue(null);
    catalogMocks.recoverLocalCatalog.mockResolvedValue(readyStatus);
    catalogMocks.searchLocalJobs.mockResolvedValue({
      items: [sampleJob],
      nextCursor: null,
      total: 1,
    });
    catalogMocks.watchCatalogStatus.mockResolvedValue(() => undefined);
    profileMocks.getProfile.mockResolvedValue(null);
    profileMocks.saveProfile.mockResolvedValue(savedProfile);
    shortlistMocks.isShortlisted.mockResolvedValue(false);
    shortlistMocks.listShortlist.mockResolvedValue([]);
    shortlistMocks.setShortlist.mockImplementation(async ({ jobId, saved }) => ({
      jobId,
      saved,
      catalogVersion: "1",
      savedAt: saved ? "2026-08-01T12:00:00.000Z" : null,
    }));
    matchMocks.getMatchBreakdown.mockResolvedValue(null);
    matchMocks.getMatchBreakdowns.mockResolvedValue([]);
  });

  it("opens Emmy as an honest offline panel without simulated chat", async () => {
    render(<App />);
    await screen.findByRole(
      "heading",
      { level: 2, name: sampleJob.title },
      { timeout: 5_000 },
    );

    fireEvent.click(screen.getByRole("button", { name: t("emmy") }));

    const panel = await screen.findByRole("complementary", { name: t("emmyPanelLabel") });
    expect(within(panel).getByText(t("emmyOfflineTitle"))).toBeInTheDocument();
    expect(within(panel).getByRole("textbox", { name: t("emmyUnavailable") })).toBeDisabled();
    expect(within(panel).queryByText(/searching|thinking/i)).not.toBeInTheDocument();
  });

  it("creates a real local profile with canonical catalog skills", async () => {
    catalogMocks.autocompleteSkills.mockResolvedValue([
      { label: "Rust", canonicalName: "Rust (programming language)", count: 1_240 },
    ]);
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });
    fireEvent.click(screen.getByRole("button", { name: t("profile") }));

    expect(await screen.findByRole("heading", { level: 1, name: t("profileTitle") })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: t("createProfile") }));
    fireEvent.change(screen.getByRole("textbox", { name: t("preferredRoles") }), { target: { value: "Rust Engineer" } });
    fireEvent.click(screen.getByRole("button", { name: t("addRole") }));

    const skillInput = screen.getByRole("combobox", { name: t("skills") });
    fireEvent.change(skillInput, { target: { value: "Rust" } });
    await screen.findByRole("option", { name: /Rust/ });
    fireEvent.keyDown(skillInput, { key: "ArrowDown" });
    fireEvent.keyDown(skillInput, { key: "Enter" });

    fireEvent.change(screen.getByRole("combobox", { name: t("seniority") }), { target: { value: "senior" } });
    fireEvent.change(screen.getByRole("textbox", { name: t("country") }), { target: { value: "Azerbaijan" } });
    fireEvent.change(screen.getByRole("textbox", { name: t("city") }), { target: { value: "Baku" } });
    fireEvent.click(screen.getByRole("checkbox", { name: t("remoteModeRemote") }));
    fireEvent.change(screen.getByRole("textbox", { name: t("minimumSalary") }), { target: { value: "100000" } });
    fireEvent.click(screen.getByRole("button", { name: t("saveProfile") }));

    await waitFor(() => {
      expect(profileMocks.saveProfile.mock.calls[0]?.[0]).toEqual({
        preferredRoles: ["Rust Engineer"],
        seniority: "senior",
        skills: ["Rust (programming language)"],
        country: "Azerbaijan",
        city: "Baku",
        remoteModes: ["remote"],
        salaryMinUsdYear: 100_000,
      });
    });
    expect(await screen.findByText("Rust Engineer")).toBeInTheDocument();
    expect(screen.getByText("Rust (programming language)")).toBeInTheDocument();
  });

  it("preserves an unsaved profile draft while switching screens", async () => {
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });
    fireEvent.click(screen.getByRole("button", { name: t("profile") }));
    fireEvent.click(await screen.findByRole("button", { name: t("createProfile") }));
    const country = screen.getByRole("textbox", { name: t("country") });
    fireEvent.change(country, { target: { value: "Azerbaijan" } });

    fireEvent.click(screen.getByRole("button", { name: t("jobs") }));
    fireEvent.click(screen.getByRole("button", { name: t("profile") }));

    expect(screen.getByRole("textbox", { name: t("country") })).toHaveValue("Azerbaijan");
  });

  it("shows a field error and focuses the first invalid profile field", async () => {
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });
    fireEvent.click(screen.getByRole("button", { name: t("profile") }));
    fireEvent.click(await screen.findByRole("button", { name: t("createProfile") }));
    const salary = screen.getByRole("textbox", { name: t("minimumSalary") });
    fireEvent.change(salary, { target: { value: "not-a-number" } });
    fireEvent.click(screen.getByRole("button", { name: t("saveProfile") }));

    expect(await screen.findByText(t("profileSalaryError"))).toHaveAttribute("role", "alert");
    await waitFor(() => expect(salary).toHaveFocus());
    expect(salary).toHaveAttribute("aria-invalid", "true");
    expect(profileMocks.saveProfile).not.toHaveBeenCalled();
  });

  it("retries a failed profile load without restarting the application", async () => {
    profileMocks.getProfile.mockRejectedValue(new Error("user.sqlite unavailable"));
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });
    fireEvent.click(screen.getByRole("button", { name: t("profile") }));

    expect(await screen.findByText(t("profileLoadError"))).toBeInTheDocument();
    profileMocks.getProfile.mockResolvedValue(null);
    fireEvent.click(screen.getByRole("button", { name: t("profileRetry") }));
    expect(await screen.findByRole("button", { name: t("createProfile") })).toBeInTheDocument();
    expect(profileMocks.getProfile.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("saves a vacancy, opens the shortlist, and removes it with the S shortcut", async () => {
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });

    fireEvent.click(screen.getAllByRole("button", { name: t("saveToShortlist") })[0]!);
    await waitFor(() => {
      expect(shortlistMocks.setShortlist).toHaveBeenLastCalledWith({
        jobId: sampleJob.id,
        saved: true,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: t("shortlist") }));
    expect(await screen.findByRole("heading", { level: 1, name: t("shortlistTitle") })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Senior Rust Engineer/ })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "s" });
    await waitFor(() => {
      expect(shortlistMocks.setShortlist).toHaveBeenLastCalledWith({
        jobId: sampleJob.id,
        saved: false,
      });
    });
    expect(await screen.findByText(t("shortlistEmpty"))).toBeInTheDocument();
  });

  it("shows the deterministic match score on the card and in job details", async () => {
    profileMocks.getProfile.mockResolvedValue(savedProfile);
    matchMocks.getMatchBreakdowns.mockResolvedValue([
      { jobId: sampleJob.id, breakdown: sampleMatch },
    ]);
    matchMocks.getMatchBreakdown.mockResolvedValue(sampleMatch);

    render(<App />);

    const breakdownHeading = await screen.findByRole("heading", {
      level: 3,
      name: t("matchBreakdown"),
    });
    const breakdown = breakdownHeading.closest("section");
    expect(breakdown).not.toBeNull();
    expect(within(breakdown!).getByText(`88% ${t("matchLabel")}`)).toBeInTheDocument();
    expect(screen.getAllByText(/88%/).length).toBeGreaterThan(1);
    expect(matchMocks.getMatchBreakdowns).toHaveBeenCalledWith([sampleJob.id]);
    expect(matchMocks.getMatchBreakdown).toHaveBeenCalledWith(sampleJob.id);
  });

  it("keeps search-only shortcuts inactive on the profile screen", async () => {
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });
    const selectedBeforeNavigation = useAppUiStore.getState().selectedId;

    fireEvent.click(screen.getByRole("button", { name: t("profile") }));
    const createButton = await screen.findByRole("button", { name: t("createProfile") });
    createButton.focus();
    fireEvent.keyDown(window, { key: "/" });
    fireEvent.keyDown(window, { key: "j" });
    fireEvent.keyDown(window, { ctrlKey: true, key: "Enter" });

    expect(createButton).toHaveFocus();
    expect(useAppUiStore.getState().selectedId).toBe(selectedBeforeNavigation);
    expect(catalogMocks.openOriginalJob).not.toHaveBeenCalled();
  });

  it("shows the shell and an initial skeleton while the search is pending", () => {
    catalogMocks.searchLocalJobs.mockReturnValue(new Promise(() => undefined));

    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(t("searchTitle"));
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

    expect((await screen.findByText(t("catalogError"))).closest('[role="alert"]')).not.toBeNull();
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

    fireEvent.click(screen.getByRole("checkbox", { name: t("remoteModeRemote") }));
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
    fireEvent.click(screen.getByRole("checkbox", { name: t("remoteModeRemote") }));
    await waitFor(() => expect(catalogMocks.searchLocalJobs).toHaveBeenCalledTimes(2));

    fireEvent.change(input, { target: { value: "fast" } });
    fireEvent.click(screen.getByRole("checkbox", { name: t("remoteModeRemote") }));
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

  it("loads source choices from IPC and renders every filter as an accessible group", async () => {
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });

    expect(catalogMocks.getFilterOptions).toHaveBeenCalledTimes(1);
    for (const name of [
      t("sort"),
      t("workMode"),
      t("skillsFilter"),
      t("locationsFilter"),
      t("seniority"),
      t("employment"),
      t("salary"),
      t("sources"),
    ]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }
    expect(
      await screen.findByRole("checkbox", { name: /^Greenhouse/ }),
    ).toBeInTheDocument();
  });

  const checkboxPayloadCases: Array<{
    expected: Partial<SearchQuery>;
    label: string;
    name: string;
  }> = [
    {
      expected: { remoteModes: ["remote"] },
      label: "remote multi-select",
      name: t("remoteModeRemote"),
    },
    {
      expected: { seniorities: ["senior"] },
      label: "seniority multi-select",
      name: t("senioritySenior"),
    },
    {
      expected: { employmentTypes: ["full_time"] },
      label: "employment multi-select",
      name: t("employmentFullTime"),
    },
    {
      expected: { salaryKnownOnly: true },
      label: "known-salary toggle",
      name: t("salaryKnownOnly"),
    },
  ];

  it.each(checkboxPayloadCases)(
    "sends the exact search payload for $label",
    async ({ expected, name }) => {
      render(<App />);
      await screen.findByRole("heading", { level: 2, name: sampleJob.title });

      fireEvent.click(screen.getByRole("checkbox", { name }));

      await expectLatestSearchPayload(expected);
    },
  );

  it("sends the exact search payload for the sort control", async () => {
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });

    fireEvent.click(screen.getByRole("radio", { name: t("sortSalary") }));

    await expectLatestSearchPayload({ sort: "salary" });
  });

  it("commits a valid minimum salary as the exact numeric payload", async () => {
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });
    const input = screen.getByRole("textbox", { name: t("salaryMinimum") });

    fireEvent.change(input, { target: { value: "125000" } });
    fireEvent.blur(input);

    await expectLatestSearchPayload({ salaryMinUsdYear: 125_000 });
  });

  it.each(["-1", "NaN", "10000001"])(
    "does not commit invalid minimum salary %s",
    async (value) => {
      render(<App />);
      await screen.findByRole("heading", { level: 2, name: sampleJob.title });
      const input = screen.getByRole("textbox", { name: t("salaryMinimum") });

      fireEvent.change(input, { target: { value } });
      fireEvent.blur(input);

      expect(await screen.findByText(t("salaryInvalid"))).toHaveAttribute("role", "alert");
      expect(catalogMocks.searchLocalJobs).toHaveBeenCalledTimes(1);
    },
  );

  it("sends the exact source value supplied by filter-options IPC", async () => {
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });

    fireEvent.click(await screen.findByRole("checkbox", { name: /^Greenhouse/ }));

    await expectLatestSearchPayload({ sources: ["greenhouse"] });
  });

  it("sends the canonical skill selected from IPC autocomplete", async () => {
    catalogMocks.autocompleteSkills.mockResolvedValue([
      {
        label: "Python",
        canonicalName: "Python (computer programming)",
        count: 9_302,
      },
    ]);
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });
    const input = screen.getByRole("combobox", { name: t("skillsFilter") });

    fireEvent.change(input, { target: { value: "Python" } });
    await waitFor(() => {
      expect(catalogMocks.autocompleteSkills).toHaveBeenCalledWith("Python", 20);
    });
    await screen.findByRole("option", { name: /Python/ });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    await expectLatestSearchPayload({ skills: ["Python (computer programming)"] });
  });

  it("sends the canonical location selected from IPC autocomplete", async () => {
    catalogMocks.autocompleteLocations.mockResolvedValue([
      { label: "Berlin", canonicalValue: "Berlin", kind: "city", count: 16 },
    ]);
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });
    const input = screen.getByRole("combobox", { name: t("locationsFilter") });

    fireEvent.change(input, { target: { value: "Ber" } });
    await waitFor(() => {
      expect(catalogMocks.autocompleteLocations).toHaveBeenCalledWith("Ber", 20);
    });
    await screen.findByRole("option", { name: /Berlin/ });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    await expectLatestSearchPayload({ locations: ["Berlin"] });
  });

  it("removes one active chip and keeps the remaining exact payload", async () => {
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });
    fireEvent.click(screen.getByRole("checkbox", { name: t("remoteModeRemote") }));
    fireEvent.click(screen.getByRole("checkbox", { name: t("senioritySenior") }));
    await expectLatestSearchPayload({
      remoteModes: ["remote"],
      seniorities: ["senior"],
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: `${t("removeFilter")}: ${t("remoteModeRemote")}`,
      }),
    );

    await expectLatestSearchPayload({ seniorities: ["senior"] });
  });

  it("combines filters and sort, then resets them while preserving search text", async () => {
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });
    fireEvent.change(screen.getByRole("textbox", { name: t("searchPlaceholder") }), {
      target: { value: "rust platform" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: t("remoteModeHybrid") }));
    fireEvent.click(screen.getByRole("checkbox", { name: t("employmentContract") }));
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: t("sortNewest") })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole("radio", { name: t("sortNewest") }));

    await expectLatestSearchPayload({
      text: "rust platform",
      remoteModes: ["hybrid"],
      employmentTypes: ["contract"],
      sort: "newest",
    });
    fireEvent.click(screen.getByRole("button", { name: t("clearAllFilters") }));

    await expectLatestSearchPayload({ text: "rust platform", sort: "newest" });
    expect(screen.getByRole("textbox", { name: t("searchPlaceholder") })).toHaveValue(
      "rust platform",
    );
  });

  it("loads detail separately and opens the original by job ID", async () => {
    render(<App />);

    await screen.findByRole("heading", { level: 2, name: sampleJob.title });

    expect(catalogMocks.getLocalJob).toHaveBeenCalledWith(sampleJob.id);
    const selectedFeedItem = screen.getByRole("button", {
      name: /Senior Rust Engineer/,
    });
    expect(selectedFeedItem).toHaveAttribute("aria-current", "true");
    expect(selectedFeedItem).toHaveAttribute("data-selected", "true");
    expect(screen.queryByTestId("company-monogram")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("shortlist") })).toBeEnabled();
    expect(screen.getByRole("button", { name: t("profile") })).toBeEnabled();
    expect(screen.getByRole("button", { name: t("emmy") })).toBeEnabled();
    const originalButton = screen.getByRole("button", { name: t("openOriginal") });
    expect(originalButton).toHaveClass("bg-[var(--text)]", "text-[var(--bg)]");
    fireEvent.click(originalButton);
    expect(catalogMocks.openOriginalJob).toHaveBeenCalledWith(sampleJob.id);
  });

  it("keeps technical provenance collapsed until the user requests it", async () => {
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: sampleJob.title });

    const summary = screen.getByText(t("technicalDetails"));
    const disclosure = summary.closest("details");
    expect(disclosure).not.toBeNull();
    expect(disclosure).not.toHaveAttribute("open");

    fireEvent.click(summary);

    expect(disclosure).toHaveAttribute("open");
    const provenanceValues = within(disclosure!).getAllByText("Greenhouse");
    expect(provenanceValues).toHaveLength(2);
    for (const value of provenanceValues) expect(value).toBeVisible();
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

  it("focuses search with / and ignores the shortcut inside editable controls", async () => {
    render(<App />);
    await screen.findByTestId("job-description");
    const searchInput = screen.getByRole("textbox", { name: t("searchPlaceholder") });
    const searchButton = screen.getByRole("button", { name: t("search") });
    searchButton.focus();

    fireEvent.keyDown(window, { key: "/" });
    expect(searchInput).toHaveFocus();

    const salaryInput = screen.getByRole("textbox", { name: t("salaryMinimum") });
    salaryInput.focus();
    fireEvent.keyDown(salaryInput, { key: "/" });
    expect(salaryInput).toHaveFocus();
  });

  it("does not open the original for Ctrl+Enter inside an editable control", async () => {
    render(<App />);
    await screen.findByTestId("job-description");
    const searchInput = screen.getByRole("textbox", { name: t("searchPlaceholder") });

    fireEvent.keyDown(searchInput, { ctrlKey: true, key: "Enter" });

    expect(catalogMocks.openOriginalJob).not.toHaveBeenCalled();
  });

  it("renders through the configured Russian i18n layer", () => {
    expect(defaultLocale).toBe("ru");
    expect(t("offlineReady")).toBe("Офлайн");
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

  it("shows the result count separately from the full catalog size", async () => {
    render(<App />);

    expect(await screen.findByText(`1 ${t("resultsFound")}`)).toBeInTheDocument();
    const catalogTotal = `${t("catalogTotal")}: ${formatCount(readyStatus.totalJobs)} ${t("jobsFound")}`;
    expect(
      screen.getByText((_, element) => element?.textContent === catalogTotal),
    ).toBeInTheDocument();
  });

  it("offers a typo suggestion as a button and applies it only after confirmation", async () => {
    catalogMocks.searchLocalJobs.mockImplementation((query: SearchQuery) =>
      Promise.resolve(
        query.text === "python developer"
          ? { items: [sampleJob], nextCursor: null, total: 1 }
          : {
              items: [],
              nextCursor: null,
              suggestion: "python developer",
              total: 0,
            },
      ),
    );

    render(<App />);

    const suggestion = await screen.findByRole("button", { name: "python developer" });
    expect(catalogMocks.searchLocalJobs).toHaveBeenCalledTimes(1);
    fireEvent.click(suggestion);

    await expectLatestSearchPayload({ text: "python developer" });
    expect(screen.getByRole("textbox", { name: t("searchPlaceholder") })).toHaveValue(
      "python developer",
    );
  });

  it("loads the next cursor page with the exact IPC payload", async () => {
    const cursor = searchCursorSchema.parse("next-page");
    const secondJob: JobSummary = {
      ...sampleJob,
      id: jobIdSchema.parse("2"),
      title: "Second local job",
    };
    catalogMocks.searchLocalJobs
      .mockResolvedValueOnce({ items: [sampleJob], nextCursor: cursor, total: 2 })
      .mockResolvedValueOnce({ items: [secondJob], nextCursor: null, total: 2 });

    render(<App />);

    expect(await screen.findByText(secondJob.title)).toBeInTheDocument();
    expect(catalogMocks.searchLocalJobs.mock.calls[1]?.[0]).toEqual({
      ...createSearchQuery(),
      cursor,
    });
  });

  it("does not request the same cursor twice while its page is pending", async () => {
    const cursor = searchCursorSchema.parse("pending-page");
    const pendingPage = deferred<JobSearchPage>();
    catalogMocks.searchLocalJobs
      .mockResolvedValueOnce({ items: [sampleJob], nextCursor: cursor, total: 2 })
      .mockReturnValueOnce(pendingPage.promise);

    render(<App />);
    await waitFor(() => expect(catalogMocks.searchLocalJobs).toHaveBeenCalledTimes(2));
    const feed = screen.getByRole("region", { name: t("searchResults") });
    fireEvent.scroll(feed, { target: { scrollTop: 10_000 } });
    fireEvent.scroll(feed, { target: { scrollTop: 10_000 } });

    expect(catalogMocks.searchLocalJobs).toHaveBeenCalledTimes(2);
    await act(async () => {
      pendingPage.resolve({ items: [], nextCursor: null });
      await pendingPage.promise;
    });
  });

  it("deduplicates a job repeated at a cursor boundary", async () => {
    const cursor = searchCursorSchema.parse("overlap-page");
    const secondJob: JobSummary = {
      ...sampleJob,
      id: jobIdSchema.parse("2"),
      title: "Unique second job",
    };
    catalogMocks.searchLocalJobs
      .mockResolvedValueOnce({ items: [sampleJob], nextCursor: cursor, total: 2 })
      .mockResolvedValueOnce({ items: [sampleJob, secondJob], nextCursor: null });

    render(<App />);

    expect(await screen.findByText(secondJob.title)).toBeInTheDocument();
    expect(document.querySelectorAll(`[data-job-id="${sampleJob.id}"]`)).toHaveLength(1);
  });

  it("keeps selection during background refetch and falls back when it disappears", async () => {
    const secondJob: JobSummary = {
      ...sampleJob,
      id: jobIdSchema.parse("2"),
      title: "Selected second job",
    };
    const refreshedPage = deferred<JobSearchPage>();
    catalogMocks.searchLocalJobs
      .mockResolvedValueOnce({ items: [sampleJob, secondJob], nextCursor: null, total: 2 })
      .mockReturnValueOnce(refreshedPage.promise);
    catalogMocks.getLocalJob.mockImplementation((id: JobSummary["id"]) =>
      Promise.resolve({ ...sampleDetail, ...(id === secondJob.id ? secondJob : sampleJob) }),
    );

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Selected second job/ }));
    expect(useAppUiStore.getState().selectedId).toBe(secondJob.id);

    fireEvent.click(screen.getByRole("button", { name: t("search") }));
    await waitFor(() => expect(catalogMocks.searchLocalJobs).toHaveBeenCalledTimes(2));
    expect(useAppUiStore.getState().selectedId).toBe(secondJob.id);
    expect(screen.getByRole("button", { name: /Selected second job/ })).toHaveAttribute(
      "aria-current",
      "true",
    );

    await act(async () => {
      refreshedPage.resolve({ items: [sampleJob], nextCursor: null, total: 1 });
      await refreshedPage.promise;
    });
    await waitFor(() => expect(useAppUiStore.getState().selectedId).toBe(sampleJob.id));
  });
});
