import { describe, expect, it } from "vitest";

import {
  applyDocumentTheme,
  isAppTheme,
  resolveTheme,
  themeOptions,
} from "@/app/theme";

describe("theme helpers", () => {
  it("resolves system, light, and dark without persisting a preference", () => {
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("sets the resolved data-theme on the root", () => {
    const root = document.createElement("html");
    applyDocumentTheme(root, "light");
    expect(root).toHaveAttribute("data-theme", "light");
    applyDocumentTheme(root, "dark");
    expect(root).toHaveAttribute("data-theme", "dark");
  });

  it("narrows only the three supported session theme values", () => {
    expect(themeOptions).toEqual(["system", "light", "dark"]);
    expect(isAppTheme("system")).toBe(true);
    expect(isAppTheme("sepia")).toBe(false);
  });
});
