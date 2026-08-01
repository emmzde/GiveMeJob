import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

import { DesktopTitlebar } from "@/app/DesktopTitlebar";
import { NavigationSidebar } from "@/app/NavigationSidebar";
import { StatusBar } from "@/app/StatusBar";
import { useAppUiStore } from "@/app/store/appUiStore";
import { useDocumentTheme } from "@/app/theme";
import { CommandPalette } from "@/features/commands/CommandPalette";
import type { CatalogViewState } from "@/features/catalog/catalogStatus";
import { isEditableTarget } from "@/lib/keyboard";
import { t } from "@/lib/i18n";

interface AppShellProps {
  catalog: CatalogViewState;
  children: ReactNode;
}

const MIN_EMMY_WIDTH = 300;
const MAX_EMMY_WIDTH = 440;
const EmmyPanel = lazy(() =>
  import("@/features/emmy/EmmyPanel").then((module) => ({ default: module.EmmyPanel })),
);

export function AppShell({ catalog, children }: AppShellProps) {
  const theme = useAppUiStore((state) => state.theme);
  const panel = useAppUiStore((state) => state.panel);
  const selectedId = useAppUiStore((state) => state.selectedId);
  const commandPaletteOpen = useAppUiStore((state) => state.commandPaletteOpen);
  const filtersVisible = useAppUiStore((state) => state.filtersVisible);
  const setCommandPaletteOpen = useAppUiStore((state) => state.setCommandPaletteOpen);
  const setFiltersVisible = useAppUiStore((state) => state.setFiltersVisible);
  const setPanel = useAppUiStore((state) => state.setPanel);
  const setScreen = useAppUiStore((state) => state.setScreen);
  const toggleFilters = useAppUiStore((state) => state.toggleFilters);
  const commandTriggerRef = useRef<HTMLButtonElement>(null);
  const resizing = useRef(false);
  const [emmyWidth, setEmmyWidth] = useState(340);
  useDocumentTheme(theme);

  const closeEmmy = useCallback(() => {
    setPanel(selectedId === null ? null : "job_detail");
  }, [selectedId, setPanel]);

  const focusSearch = useCallback(() => {
    setScreen("search");
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>("#catalog-search-input")?.focus());
  }, [setScreen]);

  const showFilters = useCallback(() => {
    setScreen("search");
    toggleFilters();
  }, [setScreen, toggleFilters]);

  useEffect(() => {
    const update = () => setFiltersVisible(window.innerWidth >= 1120);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [setFiltersVisible]);

  useEffect(() => {
    function handleGlobalShortcut(event: globalThis.KeyboardEvent): void {
      if (event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLocaleLowerCase("en-US") === "e") {
        event.preventDefault();
        setPanel(panel === "emmy" ? (selectedId === null ? null : "job_detail") : "emmy");
        return;
      }
      if (event.ctrlKey || event.altKey || event.metaKey || isEditableTarget(event.target)) return;
      const screens = { "1": "search", "2": "shortlist", "3": "profile", "5": "settings" } as const;
      const next = screens[event.key as keyof typeof screens];
      if (next) setScreen(next);
      if (event.key === "4") setPanel("emmy");
    }
    window.addEventListener("keydown", handleGlobalShortcut);
    return () => window.removeEventListener("keydown", handleGlobalShortcut);
  }, [panel, selectedId, setPanel, setScreen]);

  useEffect(() => {
    function move(event: MouseEvent): void {
      if (!resizing.current) return;
      setEmmyWidth(Math.max(MIN_EMMY_WIDTH, Math.min(MAX_EMMY_WIDTH, window.innerWidth - event.clientX)));
    }
    function stop(): void {
      if (!resizing.current) return;
      resizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    };
  }, []);

  function startResize(): void {
    resizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function resizeWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowLeft" ? 16 : -16;
    setEmmyWidth((width) => Math.max(MIN_EMMY_WIDTH, Math.min(MAX_EMMY_WIDTH, width + delta)));
  }

  return (
    <main className="flex h-screen min-h-[620px] min-w-[320px] flex-col overflow-hidden bg-[var(--surface-0)] text-[var(--text)]">
      <DesktopTitlebar catalog={catalog} commandTriggerRef={commandTriggerRef} />
      <div className="flex min-h-0 flex-1">
        <NavigationSidebar />
        <div className="min-w-0 flex-1 overflow-hidden bg-[var(--surface-0)]">{children}</div>
        {panel === "emmy" ? (
          <div className="emmy-dock flex shrink-0" style={{ width: emmyWidth }}>
            <div
              aria-label={t("resizeEmmy")}
              aria-orientation="vertical"
              aria-valuemax={MAX_EMMY_WIDTH}
              aria-valuemin={MIN_EMMY_WIDTH}
              aria-valuenow={emmyWidth}
              className="w-1 cursor-col-resize border-l border-[var(--border)] hover:bg-[var(--accent-muted)]"
              onKeyDown={resizeWithKeyboard}
              onMouseDown={startResize}
              role="separator"
              tabIndex={0}
            />
            <div className="min-w-0 flex-1">
              <Suspense
                fallback={
                  <div aria-label={t("emmyPanelLabel")} className="h-full animate-pulse bg-[var(--surface-1)]" role="status" />
                }
              >
                <EmmyPanel onClose={closeEmmy} />
              </Suspense>
            </div>
          </div>
        ) : null}
      </div>
      <StatusBar catalog={catalog} />
      <CommandPalette
        filtersVisible={filtersVisible}
        onFocusSearch={focusSearch}
        onOpenChange={setCommandPaletteOpen}
        onToggleFilters={showFilters}
        open={commandPaletteOpen}
        returnFocusRef={commandTriggerRef}
      />
    </main>
  );
}
