import { describe, expect, it, vi } from "vitest";

import { loadMatchBatches } from "@/features/match/hooks";
import { jobIdSchema } from "@/lib/catalog";

const matchMocks = vi.hoisted(() => ({
  getMatchBreakdowns: vi.fn(),
}));

vi.mock("@/lib/match", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/match")>();
  return { ...actual, getMatchBreakdowns: matchMocks.getMatchBreakdowns };
});

describe("match query batching", () => {
  it("keeps every IPC request within the 200-job boundary", async () => {
    const jobIds = Array.from({ length: 201 }, (_, index) =>
      jobIdSchema.parse(String(index + 1)),
    );
    matchMocks.getMatchBreakdowns.mockImplementation(async (batch) =>
      batch.map((jobId: (typeof jobIds)[number]) => ({
        jobId,
        breakdown: {
          score: 100,
          components: {
            skills: 100,
            role: 100,
            seniority: 100,
            location: 100,
            salary: 100,
          },
          strengths: [],
          gaps: [],
        },
      })),
    );

    await expect(loadMatchBatches(jobIds)).resolves.toHaveLength(201);
    expect(matchMocks.getMatchBreakdowns).toHaveBeenCalledTimes(2);
    expect(matchMocks.getMatchBreakdowns.mock.calls[0]?.[0]).toHaveLength(200);
    expect(matchMocks.getMatchBreakdowns.mock.calls[1]?.[0]).toEqual([jobIds[200]]);
  });

  it("does not invoke IPC for an empty visible set", async () => {
    matchMocks.getMatchBreakdowns.mockReset();
    await expect(loadMatchBatches([])).resolves.toEqual([]);
    expect(matchMocks.getMatchBreakdowns).not.toHaveBeenCalled();
  });
});
