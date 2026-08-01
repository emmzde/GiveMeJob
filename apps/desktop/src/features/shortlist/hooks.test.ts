import { describe, expect, it } from "vitest";

import { jobIdSchema } from "@/lib/catalog";
import { applyShortlistState, shortlistContains } from "@/features/shortlist/hooks";

const firstId = jobIdSchema.parse("1");
const secondId = jobIdSchema.parse("2");
const savedAt = "2026-08-01T12:00:00.000Z";

describe("shortlist query state", () => {
  it("adds, updates, and removes records without duplicates", () => {
    const first = applyShortlistState([], {
      jobId: firstId,
      saved: true,
      catalogVersion: "1",
      savedAt,
    });
    const second = applyShortlistState(first, {
      jobId: secondId,
      saved: true,
      catalogVersion: "1",
      savedAt,
    });
    const updated = applyShortlistState(second, {
      jobId: firstId,
      saved: true,
      catalogVersion: "2",
      savedAt,
    });
    expect(updated).toHaveLength(2);
    expect(updated[0]).toMatchObject({ jobId: firstId, catalogVersion: "2" });
    expect(shortlistContains(updated, secondId)).toBe(true);
    expect(
      applyShortlistState(updated, {
        jobId: secondId,
        saved: false,
        catalogVersion: "2",
        savedAt: null,
      }),
    ).toHaveLength(1);
  });
});
