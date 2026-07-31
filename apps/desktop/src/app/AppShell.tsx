import {
  CircleAlert,
  Database,
  WifiOff,
} from "lucide-react";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { useAppUiStore } from "@/app/store/appUiStore";
import {
  catalogStateLabel,
  isCatalogError,
} from "@/features/catalog/catalogStatus";
import type { CatalogViewState } from "@/features/catalog/catalogStatus";

interface AppShellProps {
  catalog: CatalogViewState;
  children: ReactNode;
}

function CatalogStateIcon({ catalog }: { catalog: CatalogViewState }) {
  if (catalog.isPending) return <Database aria-hidden="true" className="size-4" />;
  if (isCatalogError(catalog)) return <CircleAlert aria-hidden="true" className="size-4" />;
  return catalog.status?.state === "ready" ? (
    <WifiOff aria-hidden="true" className="size-4" />
  ) : (
    <Database aria-hidden="true" className="size-4" />
  );
}

export function AppShell({ catalog, children }: AppShellProps) {
  const theme = useAppUiStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      if (resolvedTheme === "dark") root.dataset.theme = "dark";
      else delete root.dataset.theme;
      root.style.colorScheme = resolvedTheme;
    };

    applyTheme();
    if (theme === "system") media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  const catalogHasError = isCatalogError(catalog);

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="flex h-14 items-center justify-between border-b border-[var(--border)] px-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-7 place-items-center rounded-[var(--radius-md)] bg-[var(--accent)] text-xs text-[var(--on-accent)]">
            G
          </span>
          GiveMeJob!
        </div>
        <span
          aria-atomic="true"
          aria-live={catalogHasError ? "assertive" : "polite"}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"
          role={catalogHasError ? "alert" : "status"}
        >
          <CatalogStateIcon catalog={catalog} />
          {catalogStateLabel(catalog)}
        </span>
      </header>
      {children}
    </main>
  );
}
