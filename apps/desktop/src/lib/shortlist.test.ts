import { describe, expect, it, vi } from "vitest";

import { jobIdSchema } from "@/lib/catalog";
import { createShortlistApi } from "@/lib/shortlist";
import type { TauriAdapter } from "@/lib/tauri/adapter";

const jobId = jobIdSchema.parse("42");

function adapterWithResponse(response: unknown): TauriAdapter {
  return {
    isAvailable: () => true,
    invoke: vi.fn().mockResolvedValue(response),
    listen: vi.fn(),
  };
}

describe("shortlist IPC", () => {
  it("validates exact list, state, and mutation payloads", async () => {
    const adapter = adapterWithResponse([
      { jobId, catalogVersion: "1", savedAt: "2026-08-01T12:00:00.000Z" },
    ]);
    const api = createShortlistApi(adapter);
    await expect(api.listShortlist()).resolves.toHaveLength(1);

    vi.mocked(adapter.invoke).mockResolvedValue({
      jobId,
      saved: true,
      catalogVersion: "1",
      savedAt: "2026-08-01T12:00:00.000Z",
    });
    await expect(api.setShortlist({ jobId, saved: true })).resolves.toMatchObject({
      jobId,
      saved: true,
    });
    expect(adapter.invoke).toHaveBeenLastCalledWith("set_shortlist", {
      request: { jobId, saved: true },
    });
  });

  it("uses a closed error and rejects unknown response fields", async () => {
    const adapter = adapterWithResponse([
      {
        jobId,
        catalogVersion: "1",
        savedAt: "2026-08-01T12:00:00.000Z",
        databasePath: "private",
      },
    ]);
    await expect(createShortlistApi(adapter).listShortlist()).rejects.toThrow();
    vi.mocked(adapter.invoke).mockRejectedValue({ code: "user_data_unavailable" });
    await expect(createShortlistApi(adapter).isShortlisted(jobId)).rejects.toEqual({
      code: "user_data_unavailable",
    });
  });
});
