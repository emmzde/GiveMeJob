import { ChevronRight, Minus, Search, Settings, Square, X } from "lucide-react";
import type { ReactNode, RefObject } from "react";

import type { AppScreen } from "@/app/store/appUiStore";
import { useAppUiStore } from "@/app/store/appUiStore";
import { Kbd } from "@/components/ui/kbd";
import { catalogStateLabel, isCatalogError } from "@/features/catalog/catalogStatus";
import type { CatalogViewState } from "@/features/catalog/catalogStatus";
import { EmmyMascot } from "@/features/emmy/EmmyMascot";
import { useEmmyConfiguration } from "@/features/emmy/hooks";
import { t } from "@/lib/i18n";
import { desktopWindow } from "@/lib/tauri/window";
import { cn } from "@/lib/utils";

const screenLabels: Readonly<Record<AppScreen, string>> = {
  search: t("jobs"),
  shortlist: t("shortlist"),
  profile: t("profile"),
  settings: t("settings"),
};

interface DesktopTitlebarProps {
  catalog: CatalogViewState;
  commandTriggerRef: RefObject<HTMLButtonElement | null>;
}

function WindowButton({
  children,
  danger = false,
  label,
  onClick,
}: {
  children: ReactNode;
  danger?: boolean;
  label: string;
  onClick(): Promise<void>;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "grid h-10 w-11 place-items-center text-[var(--text-tertiary)] focus-visible:z-10",
        danger
          ? "hover:bg-[var(--danger)] hover:text-[var(--on-danger)]"
          : "hover:bg-[var(--surface-hover)] hover:text-[var(--text)]",
      )}
      onClick={() => void onClick()}
      type="button"
    >
      {children}
    </button>
  );
}

export function DesktopTitlebar({ catalog, commandTriggerRef }: DesktopTitlebarProps) {
  const panel = useAppUiStore((state) => state.panel);
  const screen = useAppUiStore((state) => state.screen);
  const selectedId = useAppUiStore((state) => state.selectedId);
  const setCommandPaletteOpen = useAppUiStore((state) => state.setCommandPaletteOpen);
  const setPanel = useAppUiStore((state) => state.setPanel);
  const setScreen = useAppUiStore((state) => state.setScreen);
  const catalogError = isCatalogError(catalog);
  const emmy = useEmmyConfiguration();
  const emmyOpen = panel === "emmy";
  const emmyButtonLabel = emmyOpen ? t("closeEmmy") : t("openEmmy");
  const mascotState = emmy.isPending
    ? "thinking"
    : emmy.data?.available
      ? emmyOpen
        ? "listening"
        : "idle"
      : "offline";

  function toggleEmmy(): void {
    setPanel(emmyOpen ? (selectedId === null ? null : "job_detail") : "emmy");
  }

  return (
    <header
      className="desktop-titlebar flex h-10 shrink-0 select-none items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-0)] pl-3"
      data-tauri-drag-region
    >
      <div className="flex shrink-0 items-center gap-2" data-tauri-drag-region>
        <span className="grid size-5 place-items-center rounded-[5px] border border-[var(--border-strong)] bg-[var(--surface-2)] font-mono text-[11px] font-semibold text-[var(--text)]">
          G
        </span>
        <span className="text-xs font-semibold tracking-tight">GiveMeJob!</span>
        <ChevronRight aria-hidden="true" className="size-3 text-[var(--text-disabled)]" />
        <span className="text-xs text-[var(--text-secondary)]">{screenLabels[screen]}</span>
      </div>

      <div className="flex min-w-0 flex-1 justify-center px-2">
        <button
          aria-label={t("openCommandPalette")}
          className="flex h-7 w-full max-w-md items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] px-2.5 text-left hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
          onClick={() => setCommandPaletteOpen(true)}
          ref={commandTriggerRef}
          type="button"
        >
          <Search aria-hidden="true" className="size-3.5 text-[var(--text-tertiary)]" />
          <span className="min-w-0 flex-1 truncate text-xs text-[var(--text-placeholder)]">
            {t("commandPlaceholder")}
          </span>
          <span className="hidden items-center gap-0.5 sm:flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          aria-label={emmyButtonLabel}
          aria-pressed={emmyOpen}
          className={cn(
            "emmy-titlebar-trigger flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border px-2 text-[11px] font-medium",
            emmyOpen
              ? "border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--text)]"
              : "border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]",
          )}
          onClick={toggleEmmy}
          title={emmyButtonLabel}
          type="button"
        >
          <EmmyMascot className="size-5" state={mascotState} />
          <span className="hidden sm:inline">Emmy</span>
        </button>
        <button
          aria-label={t("settings")}
          className="grid size-7 place-items-center rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
          onClick={() => setScreen("settings")}
          type="button"
        >
          <Settings aria-hidden="true" className="size-4" />
        </button>
        <div className="ml-1 flex">
          <WindowButton label={t("windowMinimize")} onClick={desktopWindow.minimize}>
            <Minus aria-hidden="true" className="size-3.5" />
          </WindowButton>
          <WindowButton label={t("windowMaximize")} onClick={desktopWindow.toggleMaximize}>
            <Square aria-hidden="true" className="size-3" />
          </WindowButton>
          <WindowButton danger label={t("windowClose")} onClick={desktopWindow.close}>
            <X aria-hidden="true" className="size-3.5" />
          </WindowButton>
        </div>
      </div>
      <span
        aria-live={catalogError ? "assertive" : "polite"}
        className="sr-only"
        role={catalogError ? "alert" : "status"}
      >
        {catalogStateLabel(catalog)}
      </span>
    </header>
  );
}
