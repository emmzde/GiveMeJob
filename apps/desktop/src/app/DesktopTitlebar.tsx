import { Minus, Settings, Square, X } from "lucide-react";
import type { ReactNode } from "react";

import type { AppScreen } from "@/app/store/appUiStore";
import { useAppUiStore } from "@/app/store/appUiStore";
import { catalogStateLabel, isCatalogError } from "@/features/catalog/catalogStatus";
import type { CatalogViewState } from "@/features/catalog/catalogStatus";
import { EmmyMascot } from "@/features/emmy/EmmyMascot";
import { useEmmyConfiguration } from "@/features/emmy/hooks";
import { t } from "@/lib/i18n";
import { desktopWindow } from "@/lib/tauri/window";
import { cn } from "@/lib/utils";

function screenLabel(screen: AppScreen): string {
  if (screen === "shortlist") return t("shortlist");
  if (screen === "profile") return t("profile");
  if (screen === "settings") return t("settings");
  return t("jobs");
}

interface DesktopTitlebarProps {
  catalog: CatalogViewState;
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
        "grid h-[var(--titlebar-height)] w-10 place-items-center text-[var(--text-tertiary)] focus-visible:z-10",
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

export function DesktopTitlebar({ catalog }: DesktopTitlebarProps) {
  const panel = useAppUiStore((state) => state.panel);
  const screen = useAppUiStore((state) => state.screen);
  const selectedId = useAppUiStore((state) => state.selectedId);
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

  const currentLabel =
    screen === "search" && panel === "job_detail" && selectedId !== null
      ? t("description")
      : screenLabel(screen);

  return (
    <header
      className="desktop-titlebar flex h-[var(--titlebar-height)] shrink-0 select-none items-center border-b border-[var(--border)] bg-[var(--surface-0)]"
      data-tauri-drag-region
    >
      <div
        className="flex h-full w-[var(--sidebar-width)] shrink-0 items-center gap-2 border-r border-[var(--border)] bg-[var(--sidebar)] px-4"
        data-tauri-drag-region
      >
        <span aria-hidden="true" className="brand-mark-shell"><span className="brand-mark" /></span>
        <span className="brand-wordmark whitespace-nowrap text-[var(--text)]">
          <span>GiveMe</span><span className="brand-wordmark-strong">Job!</span>
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 px-5" data-tauri-drag-region>
        <span className="titlebar-breadcrumb text-[11px] text-[var(--text-secondary)]">{t("jobs")}</span>
        <span aria-hidden="true" className="px-1 text-[12px] text-[var(--text-disabled)]">/</span>
        <span className="truncate text-[11px] font-semibold text-[var(--text)]">
          {currentLabel}
        </span>
        <span className="flex-1" data-tauri-drag-region />
      </div>

      <div className="flex h-full shrink-0 items-center gap-1">
        <button
          aria-label={emmyButtonLabel}
          aria-pressed={emmyOpen}
          className={cn(
            "emmy-titlebar-trigger flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border px-2.5 text-[11px] font-medium",
            emmyOpen
              ? "border-[var(--border-strong)] bg-[var(--surface-active)] text-[var(--text)]"
              : "border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]",
          )}
          onClick={toggleEmmy}
          title={emmyButtonLabel}
          type="button"
        >
          <EmmyMascot className="size-5" state={mascotState} trackPointer={emmyOpen} />
          <span className="hidden sm:inline">Emmy</span>
        </button>
        <button
          aria-label={t("settings")}
          className="grid size-8 place-items-center rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
          onClick={() => setScreen("settings")}
          type="button"
        >
          <Settings aria-hidden="true" className="size-4" />
        </button>
        <div className="ml-1 flex h-full">
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
