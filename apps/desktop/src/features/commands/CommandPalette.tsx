import { Command } from "cmdk";
import {
  Bookmark,
  Bot,
  BriefcaseBusiness,
  Filter,
  Monitor,
  Moon,
  Search,
  Settings,
  Sun,
  UserRound,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import { useAppUiStore } from "@/app/store/appUiStore";
import type { AppTheme } from "@/app/store/appUiStore";
import { isEditableTarget } from "@/lib/keyboard";
import { t } from "@/lib/i18n";

interface CommandPaletteProps {
  filtersVisible: boolean;
  onFocusSearch(): void;
  onOpenChange(open: boolean): void;
  onToggleFilters(): void;
  open: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

const themeCommands: ReadonlyArray<{
  icon: typeof Monitor;
  label: "themeSystem" | "themeLight" | "themeDark";
  theme: AppTheme;
}> = [
  { icon: Monitor, label: "themeSystem", theme: "system" },
  { icon: Sun, label: "themeLight", theme: "light" },
  { icon: Moon, label: "themeDark", theme: "dark" },
];

export function CommandPalette({
  filtersVisible,
  onFocusSearch,
  onOpenChange,
  onToggleFilters,
  open,
  returnFocusRef,
}: CommandPaletteProps) {
  const theme = useAppUiStore((state) => state.theme);
  const setPanel = useAppUiStore((state) => state.setPanel);
  const setScreen = useAppUiStore((state) => state.setScreen);
  const setTheme = useAppUiStore((state) => state.setTheme);
  const wasOpen = useRef(open);
  const shortcutReturnFocus = useRef<HTMLElement | null>(null);
  const skipNextRestore = useRef(false);

  useEffect(() => {
    function handlePaletteShortcut(event: KeyboardEvent): void {
      if (
        event.key.toLocaleLowerCase("en-US") !== "k" ||
        !event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      if (!open && document.activeElement instanceof HTMLElement) {
        shortcutReturnFocus.current = document.activeElement;
      }
      onOpenChange(!open);
    }

    window.addEventListener("keydown", handlePaletteShortcut);
    return () => window.removeEventListener("keydown", handlePaletteShortcut);
  }, [onOpenChange, open]);

  useEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed) return;
    if (skipNextRestore.current) {
      skipNextRestore.current = false;
      shortcutReturnFocus.current = null;
      return;
    }
    const target = shortcutReturnFocus.current ?? returnFocusRef?.current;
    shortcutReturnFocus.current = null;
    requestAnimationFrame(() => target?.focus());
  }, [open, returnFocusRef]);

  function run(action: () => void, restoreFocus = true): void {
    skipNextRestore.current = !restoreFocus;
    onOpenChange(false);
    requestAnimationFrame(action);
  }

  return (
    <Command.Dialog
      label={t("commandPalette")}
      loop
      onOpenChange={onOpenChange}
      open={open}
    >
      <div className="command-input-row">
        <Search aria-hidden="true" className="size-4" />
        <Command.Input aria-label={t("commandSearch")} placeholder={t("commandSearch")} />
      </div>
      <Command.List>
        <Command.Empty>{t("commandEmpty")}</Command.Empty>
        <Command.Group heading={t("navigationPrimary")}>
          <Command.Item onSelect={() => run(() => setScreen("search"))} value={t("jobs")}>
            <BriefcaseBusiness aria-hidden="true" className="size-4" />
            <span>{t("jobs")}</span>
          </Command.Item>
          <Command.Item onSelect={() => run(() => setScreen("shortlist"))} value={t("shortlist")}>
            <Bookmark aria-hidden="true" className="size-4" />
            <span>{t("shortlist")}</span>
          </Command.Item>
          <Command.Item onSelect={() => run(() => setScreen("profile"))} value={t("profile")}>
            <UserRound aria-hidden="true" className="size-4" />
            <span>{t("profile")}</span>
          </Command.Item>
          <Command.Item onSelect={() => run(() => setPanel("emmy"))} value={t("emmy")}>
            <Bot aria-hidden="true" className="size-4" />
            <span>{t("emmy")}</span>
          </Command.Item>
          <Command.Item onSelect={() => run(() => setScreen("settings"))} value={t("settings")}>
            <Settings aria-hidden="true" className="size-4" />
            <span>{t("settings")}</span>
          </Command.Item>
        </Command.Group>
        <Command.Group heading={t("commandActions")}>
          <Command.Item onSelect={() => run(onFocusSearch, false)} value={t("focusSearch")}>
            <Search aria-hidden="true" className="size-4" />
            <span>{t("focusSearch")}</span>
          </Command.Item>
          <Command.Item onSelect={() => run(onToggleFilters)} value={filtersVisible ? t("hideFilters") : t("showFilters")}>
            <Filter aria-hidden="true" className="size-4" />
            <span>{filtersVisible ? t("hideFilters") : t("showFilters")}</span>
          </Command.Item>
        </Command.Group>
        <Command.Group heading={t("theme")}>
          {themeCommands.map(({ icon: Icon, label, theme: option }) => (
            <Command.Item
              key={option}
              onSelect={() => run(() => setTheme(option))}
              value={t(label)}
            >
              <Icon aria-hidden="true" className="size-4" />
              <span>{t(label)}</span>
              {theme === option ? <span className="command-current">{t("current")}</span> : null}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
