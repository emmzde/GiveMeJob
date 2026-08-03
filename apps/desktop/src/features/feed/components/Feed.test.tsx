import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetAppUiStore, useAppUiStore } from "@/app/store/appUiStore";
import { createAppQueryClient } from "@/app/queryClient";
import { Feed } from "@/features/feed/components/Feed";
import { jobIdSchema, searchCursorSchema } from "@/lib/catalog";
import type { JobSummary } from "@/lib/catalog";
import { t } from "@/lib/i18n";

function job(index: number, overrides: Partial<JobSummary> = {}): JobSummary {
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
    ...overrides,
  };
}

const defaultProps: ComponentProps<typeof Feed> = {
  canLoadNextPage: false,
  errorMessage: null,
  isCatalogReady: true,
  isFetching: false,
  isFetchingNextPage: false,
  isInitialLoading: false,
  jobs: [],
  nextCursor: null,
  onLoadMore: () => undefined,
};

function renderFeed(overrides: Partial<ComponentProps<typeof Feed>>) {
  return render(
    <QueryClientProvider client={createAppQueryClient()}>
      <Feed {...defaultProps} {...overrides} />
    </QueryClientProvider>,
  );
}

describe("Feed", () => {
  beforeEach(() => resetAppUiStore());

  it("moves selection with j/k and exposes current and selected states", () => {
    const jobs = [job(0), job(1)];
    useAppUiStore.getState().selectJob(jobs[0]!.id);
    renderFeed({ jobs });

    fireEvent.keyDown(window, { key: "j" });
    expect(useAppUiStore.getState().selectedId).toBe(jobs[1]!.id);
    expect(screen.getByRole("button", { name: /Job 2/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: /Job 2/ })).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("button", { name: /Job 2/ })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("button", { name: /Job 1/ })).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(window, { key: "k" });
    expect(useAppUiStore.getState().selectedId).toBe(jobs[0]!.id);
  });

  it("ignores j/k from editable controls", () => {
    const jobs = [job(0), job(1)];
    useAppUiStore.getState().selectJob(jobs[0]!.id);
    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <input aria-label="Редактор" />
        <Feed {...defaultProps} jobs={jobs} />
      </QueryClientProvider>,
    );

    const editor = screen.getByRole("textbox", { name: "Редактор" });
    fireEvent.keyDown(editor, { key: "j" });
    fireEvent.keyDown(editor, { key: "k" });

    expect(useAppUiStore.getState().selectedId).toBe(jobs[0]!.id);
  });

  it("scrolls a virtual row into view after j/k", () => {
    const jobs = Array.from({ length: 51 }, (_, index) => job(index));
    useAppUiStore.getState().selectJob(jobs[39]!.id);
    const scrollSpy = vi.spyOn(HTMLElement.prototype, "scrollTo");
    renderFeed({ jobs });

    fireEvent.keyDown(window, { key: "j" });

    expect(useAppUiStore.getState().selectedId).toBe(jobs[40]!.id);
    expect(scrollSpy).toHaveBeenCalled();
    scrollSpy.mockRestore();
  });

  it("renders localized work mode, seniority, posted date, and salary metadata", () => {
    renderFeed({
      jobs: [
        job(0, {
          postedAt: "2026-07-30T00:00:00Z",
          remoteMode: "remote",
          salaryCurrency: "usd",
          salaryMax: 150_000,
          salaryMin: 120_000,
          salaryPeriod: "year",
          seniority: "senior",
        }),
      ],
    });

    expect(screen.getByText(t("remoteModeRemote"))).toBeInTheDocument();
    expect(screen.getByText(t("senioritySenior"))).toBeInTheDocument();
    const jobButton = screen.getByRole("button", { name: /Job 1/ });
    expect(jobButton).toHaveTextContent("120 000–150 000 USD/год");
    expect(jobButton).toHaveTextContent(`${t("posted")} 30 июл. 2026`);
  });

  it("uses measured virtual rows for accumulated results", async () => {
    const heightSpy = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(640);
    const widthSpy = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockReturnValue(520);
    renderFeed({ jobs: Array.from({ length: 51 }, (_, index) => job(index)) });

    const virtualFeed = document.querySelector('[data-virtualized="true"]');
    expect(virtualFeed).not.toBeNull();
    await waitFor(() => expect(document.querySelectorAll("[data-job-id]").length).toBeGreaterThan(0));
    expect(document.querySelectorAll("[data-job-id]").length).toBeLessThan(51);
    const measuredRow = virtualFeed?.querySelector<HTMLElement>("[data-index]");
    expect(measuredRow).not.toBeNull();
    expect(measuredRow?.style.height).toBe("");
    heightSpy.mockRestore();
    widthSpy.mockRestore();
  });

  it("requests the next cursor near the end of the virtual range", async () => {
    const heightSpy = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(640);
    const widthSpy = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockReturnValue(520);
    const onLoadMore = vi.fn();
    renderFeed({
      canLoadNextPage: true,
      jobs: Array.from({ length: 51 }, (_, index) => job(index)),
      nextCursor: searchCursorSchema.parse("virtual-page-2"),
      onLoadMore,
    });

    const feed = screen.getByRole("region", { name: t("searchResults") });
    fireEvent.scroll(feed, { target: { scrollTop: 100_000 } });

    await waitFor(() => expect(onLoadMore).toHaveBeenCalledTimes(1));
    heightSpy.mockRestore();
    widthSpy.mockRestore();
  });

  it("requests a cursor only once and shows next-page skeletons", async () => {
    const onLoadMore = vi.fn();
    const cursor = searchCursorSchema.parse("cursor-2");
    const view = renderFeed({
      canLoadNextPage: true,
      jobs: [job(0), job(1)],
      nextCursor: cursor,
      onLoadMore,
    });

    await waitFor(() => expect(onLoadMore).toHaveBeenCalledTimes(1));
    view.rerender(
      <QueryClientProvider client={createAppQueryClient()}>
        <Feed
          {...defaultProps}
          canLoadNextPage
          isFetching
          isFetchingNextPage
          jobs={[job(0), job(1)]}
          nextCursor={cursor}
          onLoadMore={onLoadMore}
        />
      </QueryClientProvider>,
    );

    expect(screen.getAllByTestId("next-page-skeleton")).toHaveLength(3);
    fireEvent.scroll(screen.getByRole("region", { name: t("searchResults") }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("distinguishes empty and completed result states", () => {
    const emptyView = renderFeed({ jobs: [] });
    expect(screen.getByText(t("empty"))).toBeInTheDocument();
    expect(screen.getByText(t("emptyHint"))).toBeInTheDocument();

    emptyView.rerender(
      <QueryClientProvider client={createAppQueryClient()}>
        <Feed {...defaultProps} jobs={[job(0)]} />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("end-of-results")).toHaveTextContent(t("endOfResults"));
  });
});
