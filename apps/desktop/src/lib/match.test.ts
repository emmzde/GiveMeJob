import { describe, expect, it, vi } from "vitest";

import { jobIdSchema } from "@/lib/catalog";
import { createMatchApi } from "@/lib/match";
import type { TauriAdapter } from "@/lib/tauri/adapter";

const jobId = jobIdSchema.parse("42");
const breakdown = {
  score: 88,
  components: {
    skills: 75,
    role: 100,
    seniority: 100,
    location: 75,
    salary: null,
  },
  strengths: [
    { component: "skills", code: "skills_overlap", values: ["Rust"] },
  ],
  gaps: [],
} as const;

function adapterWithResponse(response: unknown): TauriAdapter {
  return {
    isAvailable: () => true,
    invoke: vi.fn().mockResolvedValue(response),
    listen: vi.fn(),
  };
}

describe("match IPC", () => {
  it("validates deterministic single and batch responses", async () => {
    const adapter = adapterWithResponse(breakdown);
    const api = createMatchApi(adapter);
    await expect(api.getMatchBreakdown(jobId)).resolves.toEqual(breakdown);
    expect(adapter.invoke).toHaveBeenCalledWith("get_match_breakdown", { jobId });

    vi.mocked(adapter.invoke).mockResolvedValue([{ jobId, breakdown }]);
    await expect(api.getMatchBreakdowns([jobId])).resolves.toHaveLength(1);
    expect(adapter.invoke).toHaveBeenLastCalledWith("get_match_breakdowns", {
      request: { jobIds: [jobId] },
    });
  });

  it("rejects duplicate batch IDs and unknown response fields", async () => {
    const adapter = adapterWithResponse([{ jobId, breakdown }]);
    const api = createMatchApi(adapter);
    await expect(api.getMatchBreakdowns([jobId, jobId])).rejects.toThrow();
    vi.mocked(adapter.invoke).mockResolvedValue({ ...breakdown, probability: 0.88 });
    await expect(api.getMatchBreakdown(jobId)).rejects.toThrow();
  });
});
