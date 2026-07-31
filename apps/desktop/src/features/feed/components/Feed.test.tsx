import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetAppUiStore, useAppUiStore } from "@/app/store/appUiStore";
import { Feed } from "@/features/feed/components/Feed";
import { jobIdSchema } from "@/lib/catalog";
import type { JobSummary } from "@/lib/catalog";

function job(index: number): JobSummary {
  return {
    id: jobIdSchema.parse(String(index + 1)),
    title: `Job ${index + 1}`,
    company: `Company ${index + 1}`,
    locationText: "US",
    remoteMode: null,
    seniority: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    postedAt: null,
    source: "source",
    attribution: "Source",
  };
}

function renderFeed(jobs: JobSummary[]) {
  return render(
    <Feed
      errorMessage={null}
      hasNextPage={false}
      isCatalogReady
      isFetching={false}
      isFetchingNextPage={false}
      isInitialLoading={false}
      jobs={jobs}
      onLoadMore={() => undefined}
    />,
  );
}

describe("Feed", () => {
  beforeEach(() => resetAppUiStore());

  it("moves the selected vacancy with j/k and keeps a visible selected state", () => {
    const jobs = [job(0), job(1)];
    useAppUiStore.getState().selectJob(jobs[0]!.id);
    renderFeed(jobs);

    fireEvent.keyDown(window, { key: "j" });
    expect(useAppUiStore.getState().selectedId).toBe(jobs[1]!.id);
    expect(screen.getByRole("button", { name: /Job 2/ })).toHaveAttribute(
      "data-selected",
      "true",
    );

    fireEvent.keyDown(window, { key: "k" });
    expect(useAppUiStore.getState().selectedId).toBe(jobs[0]!.id);
  });

  it("virtualizes an accumulated feed longer than 50 vacancies", async () => {
    const heightSpy = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(640);
    const widthSpy = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockReturnValue(520);
    renderFeed(Array.from({ length: 51 }, (_, index) => job(index)));

    expect(document.querySelector('[data-virtualized="true"]')).not.toBeNull();
    await waitFor(() => expect(screen.getAllByRole("button").length).toBeGreaterThan(0));
    expect(screen.getAllByRole("button").length).toBeLessThan(51);
    heightSpy.mockRestore();
    widthSpy.mockRestore();
  });
});
