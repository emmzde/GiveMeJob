import { Minus, Search, Settings2, SlidersHorizontal, Square, X } from "lucide-react";
import type { ReactNode, RefObject } from "react";

import { useAppUiStore } from "@/app/store/appUiStore";
import { BrandMark, BrandWordmark } from "@/components/brand/BrandMark";
import { catalogStateLabel, isCatalogError } from "@/features/catalog/catalogStatus";
import type { CatalogViewState } from "@/features/catalog/catalogStatus";
import { EmmyAvatar } from "@/features/emmy/EmmyAvatar";
import { useEmmyConfiguration } from "@/features/emmy/hooks";
import { t } from "@/lib/i18n";
import { desktopWindow } from "@/lib/tauri/window";
import { cn } from "@/lib/utils";

interface DesktopTitlebarProps {
  catalog: CatalogViewState;
  commandTriggerRef?: RefObject<HTMLButtonElement | null>;
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
      className={cn("window-button", danger && "window-button-danger")}
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
  const filtersVisible = useAppUiStore((state) => state.filtersVisible);
  const setCommandPaletteOpen = useAppUiStore((state) => state.setCommandPaletteOpen);
  const setPanel = useAppUiStore((state) => state.setPanel);
  const setScreen = useAppUiStore((state) => state.setScreen);
  const toggleFilters = useAppUiStore((state) => state.toggleFilters);
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
    <header className="desktop-titlebar" data-tauri-drag-region>
      <div className="titlebar-brand" data-tauri-drag-region>
        <BrandMark size={28} />
        <BrandWordmark />
      </div>

      <div className="titlebar-main" data-tauri-drag-region>
        <span className="flex-1" data-tauri-drag-region />
        <button
          aria-label={t("openCommandPalette")}
          className="titlebar-search"
          onClick={() => setCommandPaletteOpen(true)}
          ref={commandTriggerRef}
          type="button"
        >
          <Search aria-hidden="true" className="size-4 shrink-0" />
          <span className="titlebar-search-text">{t("commandSearch")}</span>
          <kbd aria-hidden="true">Ctrl K</kbd>
        </button>
        {screen === "search" ? (
          <button
            aria-expanded={filtersVisible}
            aria-label={filtersVisible ? t("hideFilters") : t("showFilters")}
            className="titlebar-icon-button titlebar-filter-toggle"
            data-active={filtersVisible ? "true" : "false"}
            onClick={toggleFilters}
            title={filtersVisible ? t("hideFilters") : t("showFilters")}
            type="button"
          >
            <SlidersHorizontal aria-hidden="true" className="size-[18px]" />
          </button>
        ) : null}
        <button
          aria-label={t("settings")}
          aria-pressed={screen === "settings"}
          className="titlebar-icon-button"
          onClick={() => setScreen("settings")}
          title={t("settings")}
          type="button"
        >
          <Settings2 aria-hidden="true" className="size-[18px]" />
        </button>
        <button
          aria-label={emmyButtonLabel}
          aria-pressed={emmyOpen}
          className="emmy-titlebar-trigger"
          onClick={toggleEmmy}
          title={emmyButtonLabel}
          type="button"
        >
          <EmmyAvatar className="emmy-titlebar-avatar" state={mascotState} />
          {emmy.data?.available ? <span aria-hidden="true" className="emmy-titlebar-presence" /> : null}
        </button>
      </div>

      <div className="window-controls">
        <WindowButton label={t("windowMinimize")} onClick={desktopWindow.minimize}>
          <Minus aria-hidden="true" className="size-4" />
        </WindowButton>
        <WindowButton label={t("windowMaximize")} onClick={desktopWindow.toggleMaximize}>
          <Square aria-hidden="true" className="size-3" />
        </WindowButton>
        <WindowButton danger label={t("windowClose")} onClick={desktopWindow.close}>
          <X aria-hidden="true" className="size-4" />
        </WindowButton>
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
