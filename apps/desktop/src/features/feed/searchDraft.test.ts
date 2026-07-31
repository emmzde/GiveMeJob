import { describe, expect, it } from "vitest";

import {
  createSearchDraft,
  searchDraftToQuery,
} from "@/features/feed/searchDraft";

describe("search draft mapper", () => {
  it("maps the same draft to a canonical stable query without mutating the draft", () => {
    const draft = createSearchDraft({
      text: "  Rust backend  ",
      skills: ["SQLite", " Rust ", "SQLite"],
      locations: ["Berlin", "Amsterdam"],
      remoteModes: ["remote", "hybrid", "remote"],
      sources: ["greenhouse", "ashby"],
    });
    const snapshot = structuredClone(draft);

    const first = searchDraftToQuery(draft);
    const second = searchDraftToQuery(draft);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      text: "Rust backend",
      skills: ["Rust", "SQLite"],
      locations: ["Amsterdam", "Berlin"],
      remoteModes: ["hybrid", "remote"],
      sources: ["ashby", "greenhouse"],
    });
    expect(first).not.toHaveProperty("cursor");
    expect(draft).toEqual(snapshot);
  });
});
