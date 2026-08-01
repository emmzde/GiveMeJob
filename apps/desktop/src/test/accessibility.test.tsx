import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppErrorBoundary } from "@/app/AppErrorBoundary";
import { AppShell } from "@/app/AppShell";
import { createAppQueryClient } from "@/app/queryClient";
import { resetAppUiStore, useAppUiStore } from "@/app/store/appUiStore";
import type { CatalogViewState } from "@/features/catalog/catalogStatus";
import { CommandPalette } from "@/features/commands/CommandPalette";
import { EmmyPanel } from "@/features/emmy/EmmyPanel";
import { Feed } from "@/features/feed/components/Feed";
import { Filters } from "@/features/feed/components/Filters";
import { createSearchDraft } from "@/features/feed/searchDraft";
import { JobDetail } from "@/features/job/components/JobDetail";
import { ProfileView } from "@/features/profile/ProfileView";
import { ShortlistView } from "@/features/shortlist/ShortlistView";
import { jobIdSchema } from "@/lib/catalog";
import type { FilterOptions, JobDetail as JobDetailData, JobSummary } from "@/lib/catalog";

const catalogMocks = vi.hoisted(() => ({
  autocompleteLocations: vi.fn(),
  autocompleteSkills: vi.fn(),
  getFilterOptions: vi.fn(),
  getLocalJob: vi.fn(),
  openOriginalJob: vi.fn(),
}));
const profileMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return {
    ...actual,
    autocompleteLocations: catalogMocks.autocompleteLocations,
    autocompleteSkills: catalogMocks.autocompleteSkills,
    getFilterOptions: catalogMocks.getFilterOptions,
    getLocalJob: catalogMocks.getLocalJob,
    openOriginalJob: catalogMocks.openOriginalJob,
  };
});

vi.mock("@/lib/profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/profile")>();
  return { ...actual, getProfile: profileMocks.getProfile, saveProfile: profileMocks.saveProfile };
});

const job: JobSummary = {
  id: jobIdSchema.parse("1"),
  title: "Rust Engineer",
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

const detail: JobDetailData = {
  ...job,
  description: "Build safe local software.",
  skills: ["Rust", "SQLite"],
  employmentType: "full_time",
  salaryUsdYear: 135_000,
  sourceUrl: "https://example.test/jobs/1",
  applyUrl: null,
  snapshotVersion: "1",
};

const options: FilterOptions = {
  sources: [{ source: "greenhouse", count: 10 }],
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

function renderWithQuery(ui: ReactElement) {
  return render(
    <QueryClientProvider client={createAppQueryClient()}>{ui}</QueryClientProvider>,
  );
}

async function expectNoViolations(surface: string, root: Element): Promise<void> {
  const result = await axe.run(root, {
    rules: {
      // jsdom has no layout engine; token contrast is covered by custom-properties.test.ts.
      "color-contrast": { enabled: false },
    },
  });
  expect(
    result.violations.map(({ help, id, nodes }) => ({
      help,
      id,
      nodes: nodes.map(({ target }) => target),
    })),
    surface,
  ).toEqual([]);
}

describe("desktop axe smoke", () => {
  beforeEach(() => {
    resetAppUiStore();
    catalogMocks.autocompleteLocations.mockResolvedValue([]);
    catalogMocks.autocompleteSkills.mockResolvedValue([]);
    catalogMocks.getFilterOptions.mockResolvedValue(options);
    catalogMocks.getLocalJob.mockResolvedValue(detail);
    catalogMocks.openOriginalJob.mockResolvedValue(null);
    profileMocks.getProfile.mockReset();
    profileMocks.saveProfile.mockReset();
    profileMocks.getProfile.mockResolvedValue(null);
  });

  it("has no detectable shell violations", async () => {
    const view = render(
      <AppShell catalog={readyCatalog}>
        <section aria-label="Контент">Контент</section>
      </AppShell>,
    );
    await expectNoViolations("shell", view.container);
  });

  it("has no detectable filter violations", async () => {
    const view = renderWithQuery(
      <Filters
        disabled={false}
        draft={createSearchDraft()}
        onChange={() => undefined}
        visible
      />,
    );
    await screen.findByRole("checkbox", { name: /^Greenhouse/ });
    const filters = view.container.querySelector(".filter-panel");
    if (!filters) throw new Error("Filters surface was not rendered");
    await expectNoViolations("filters", filters);
  });

  it("has no detectable feed violations", async () => {
    useAppUiStore.getState().selectJob(job.id);
    const view = renderWithQuery(
      <Feed
        canLoadNextPage={false}
        errorMessage={null}
        isCatalogReady
        isFetching={false}
        isFetchingNextPage={false}
        isInitialLoading={false}
        jobs={[job]}
        nextCursor={null}
        onLoadMore={() => undefined}
      />,
    );
    const feed = view.container.querySelector('[role="region"]');
    if (!feed) throw new Error("Feed surface was not rendered");
    await expectNoViolations("feed", feed);
  });

  it("has no detectable detail violations", async () => {
    useAppUiStore.getState().selectJob(job.id);
    const view = renderWithQuery(
      <JobDetail
        dataVisible
        hasSearchError={false}
        isInitialSearchLoading={false}
        onClose={() => undefined}
        selectedJob={job}
      />,
    );
    await screen.findByTestId("job-description");
    const detailPanel = view.container.querySelector(".detail-panel");
    if (!detailPanel) throw new Error("Detail surface was not rendered");
    await expectNoViolations("detail", detailPanel);
  });

  it("has no detectable error fallback violations", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    function BrokenView(): never {
      throw new Error("render failed");
    }
    const view = render(
      <AppErrorBoundary>
        <BrokenView />
      </AppErrorBoundary>,
    );
    await expectNoViolations("errors", view.container);
    consoleError.mockRestore();
  });

  it("has no detectable command dialog violations", async () => {
    const view = render(
      <CommandPalette
        filtersVisible={false}
        onFocusSearch={() => undefined}
        onOpenChange={() => undefined}
        onToggleFilters={() => undefined}
        open
      />,
    );
    const dialog = await screen.findByRole("dialog");
    await expectNoViolations("command dialog", dialog);
    view.unmount();
  });

  it("has no detectable Emmy offline-panel violations", async () => {
    const view = render(<EmmyPanel onClose={() => undefined} />);
    const panel = screen.getByRole("complementary", { name: "Панель Emmy" });
    await expectNoViolations("Emmy offline panel", panel);
    view.unmount();
  });

  it("has no detectable profile-form violations", async () => {
    const view = renderWithQuery(<ProfileView />);
    fireEvent.click(await screen.findByRole("button", { name: "Создать профиль" }));
    await expectNoViolations("profile form", view.container);
    view.unmount();
  });

  it("has no detectable shortlist empty-state violations", async () => {
    const view = renderWithQuery(<ShortlistView catalogVersion="1" />);
    await screen.findByRole("heading", { level: 2 });
    await expectNoViolations("shortlist empty state", view.container);
    view.unmount();
  });
});
