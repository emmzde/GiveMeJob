import { describe, expect, it } from "vitest";

import tokenCss from "../../../../docs/design-tokens.css?raw";

const frontendSources = import.meta.glob<string>("../**/*.{css,ts,tsx}", {
  eager: true,
  import: "default",
  query: "?raw",
});

describe("CSS custom properties", () => {
  it("defines every custom property referenced by the frontend", () => {
    const definitions = new Set(
      [...tokenCss.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((match) => match[1]),
    );
    const undefinedReferences: string[] = [];

    for (const [file, source] of Object.entries(frontendSources)) {
      for (const match of source.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
        const property = match[1];
        if (property && !definitions.has(property)) {
          undefinedReferences.push(`${file}: ${property}`);
        }
      }
    }

    expect(undefinedReferences).toEqual([]);
  });
});
