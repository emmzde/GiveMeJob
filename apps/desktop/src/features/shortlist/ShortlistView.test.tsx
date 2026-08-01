import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createAppQueryClient } from "@/app/queryClient";
import { ShortlistView } from "@/features/shortlist/ShortlistView";
import { jobIdSchema } from "@/lib/catalog";
import type { JobDetail, JobId } from "@/lib/catalog";
import { t } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  getLocalJob: vi.fn(),
  getProfile: vi.fn(),
  listShortlist: vi.fn(),
}));

vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return { ...actual, getLocalJob: mocks.getLocalJob };
});

vi.mock("@/lib/profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/profile")>();
  return { ...actual, getProfile: mocks.getProfile };
});

vi.mock("@/lib/shortlist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/shortlist")>();
  return { ...actual, listShortlist: mocks.listShortlist };
});

const baseJob: Omit<JobDetail, "id"> = {
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
  description: "Build local systems.",
  skills: ["Rust", "SQLite"],
  employmentType: "full_time",
  salaryUsdYear: 135_000,
  sourceUrl: "https://example.test/jobs/1",
  applyUrl: null,
  snapshotVersion: "1",
};

describe("ShortlistView", () => {
  it("virtualizes local shortlists longer than 50 entries", async () => {
    const heightSpy = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(640);
    const widthSpy = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockReturnValue(720);
    const records = Array.from({ length: 51 }, (_, index) => ({
      jobId: jobIdSchema.parse(String(index + 1)),
      catalogVersion: "1",
      savedAt: "2026-08-01T12:00:00.000Z",
    }));
    mocks.getProfile.mockResolvedValue(null);
    mocks.listShortlist.mockResolvedValue(records);
    mocks.getLocalJob.mockImplementation(async (jobId: JobId) => ({
      ...baseJob,
      id: jobId,
      sourceUrl: `https://example.test/jobs/${jobId}`,
    }));

    const view = render(
      <QueryClientProvider client={createAppQueryClient()}>
        <ShortlistView catalogVersion="1" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("51")).toBeInTheDocument();
    const virtualized = view.container.querySelector('[data-virtualized="true"]');
    expect(virtualized).not.toBeNull();
    await waitFor(() => {
      const visibleRows = screen.getAllByRole("button", { name: t("removeFromShortlist") });
      expect(visibleRows.length).toBeGreaterThan(0);
      expect(visibleRows.length).toBeLessThan(records.length);
    });
    heightSpy.mockRestore();
    widthSpy.mockRestore();
  });
});
