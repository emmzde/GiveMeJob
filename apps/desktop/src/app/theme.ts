import { useLayoutEffect } from "react";

import type { AppTheme } from "@/app/store/appUiStore";

type ResolvedTheme = Exclude<AppTheme, "system">;

export const themeOptions = ["system", "light", "dark"] as const satisfies readonly AppTheme[];

export function isAppTheme(value: string): value is AppTheme {
  return themeOptions.some((theme) => theme === value);
}

export function resolveTheme(theme: AppTheme, systemPrefersDark: boolean): ResolvedTheme {
  if (theme !== "system") return theme;
  return systemPrefersDark ? "dark" : "light";
}

export function applyDocumentTheme(root: HTMLElement, resolvedTheme: ResolvedTheme): void {
  root.dataset.theme = resolvedTheme;
}

export function useDocumentTheme(theme: AppTheme): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => applyDocumentTheme(root, resolveTheme(theme, media.matches));

    applyTheme();
    if (theme === "system") media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);
}
