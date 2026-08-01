import { describe, expect, it } from "vitest";

import tokenCss from "../../../../docs/design-tokens.css?raw";
import indexCss from "@/styles/index.css?raw";

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

  it("styles native scrollbars with semantic theme tokens", () => {
    expect(indexCss).toContain("*::-webkit-scrollbar-thumb");
    expect(indexCss).toContain("scrollbar-color: var(--text-tertiary) transparent");
    expect(indexCss).toContain("background: var(--text-secondary)");
  });

  it("binds native color-scheme to the resolved root theme", () => {
    expect(indexCss).toContain('html[data-theme="light"]');
    expect(indexCss).toContain("color-scheme: light");
    expect(indexCss).toContain('html[data-theme="dark"]');
    expect(indexCss).toContain("color-scheme: dark");
    expect(indexCss).not.toContain("color-scheme: light dark");
  });

  it("keeps secondary and placeholder text at WCAG AA contrast in both themes", () => {
    const darkStart = tokenCss.indexOf('[data-theme="dark"]');
    const lightTokens = tokenCss.slice(0, darkStart);
    const darkTokens = tokenCss.slice(darkStart);

    for (const [theme, source] of [
      ["light", lightTokens],
      ["dark", darkTokens],
    ] as const) {
      const backgrounds = [readHexToken(source, "--bg"), readHexToken(source, "--bg-secondary")];
      for (const foreground of [
        readHexToken(source, "--text-secondary"),
        readHexToken(source, "--text-placeholder"),
      ]) {
        for (const background of backgrounds) {
          expect(contrastRatio(foreground, background), `${theme}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("collapses transitions and animation in reduced-motion mode", () => {
    expect(tokenCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(tokenCss).toContain("scroll-behavior: auto !important");
    expect(tokenCss).toContain("transition-duration: 1ms !important");
    expect(tokenCss).toContain("animation-duration: 1ms !important");
    expect(tokenCss).toContain("animation-iteration-count: 1 !important");
  });
});

function readHexToken(source: string, property: string): string {
  const match = new RegExp(`${property}\\s*:\\s*(#[0-9a-f]{6})`, "i").exec(source);
  if (!match?.[1]) throw new Error(`Missing ${property}`);
  return match[1];
}

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Invalid color ${hex}`);
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
