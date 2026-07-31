import { beforeEach, describe, expect, it } from "vitest";

import { resetAppUiStore, useAppUiStore } from "@/app/store/appUiStore";
import { jobIdSchema } from "@/lib/catalog";

describe("app UI store", () => {
  beforeEach(resetAppUiStore);

  it("contains UI navigation state without catalog result data", () => {
    const state = useAppUiStore.getState();

    expect(state).toMatchObject({
      screen: "search",
      selectedId: null,
      panel: null,
      theme: "system",
    });
    expect(state).not.toHaveProperty("jobs");
    expect(state).not.toHaveProperty("searchResults");
  });

  it("opens and closes the detail panel together with job selection", () => {
    const id = jobIdSchema.parse("42");

    useAppUiStore.getState().selectJob(id);
    expect(useAppUiStore.getState()).toMatchObject({ selectedId: id, panel: "job_detail" });

    useAppUiStore.getState().selectJob(null);
    expect(useAppUiStore.getState()).toMatchObject({ selectedId: null, panel: null });
  });
});
