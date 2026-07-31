import { describe, expect, it } from "vitest";

import { getCatalogStatus, searchLocalJobs } from "@/lib/catalog";

describe("catalog IPC boundary", () => {
  it("uses a validated browser fallback outside Tauri", async () => {
    await expect(getCatalogStatus()).resolves.toMatchObject({
      state: "missing",
      totalJobs: 0,
    });
    await expect(searchLocalJobs("python")).resolves.toEqual([]);
  });
});
