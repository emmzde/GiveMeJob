import { create } from "zustand";

import type { JobId } from "@/lib/catalog";

export type AppScreen = "search" | "shortlist" | "profile" | "settings";
export type AppPanel = "job_detail" | "emmy" | null;
export type AppTheme = "system" | "light" | "dark";

interface AppUiState {
  screen: AppScreen;
  profileVisited: boolean;
  selectedId: JobId | null;
  panel: AppPanel;
  theme: AppTheme;
  commandPaletteOpen: boolean;
  filtersVisible: boolean;
  setScreen(screen: AppScreen): void;
  selectJob(selectedId: JobId | null): void;
  setPanel(panel: AppPanel): void;
  setTheme(theme: AppTheme): void;
  setCommandPaletteOpen(open: boolean): void;
  setFiltersVisible(visible: boolean): void;
  toggleFilters(): void;
}

const initialUiState: Pick<
  AppUiState,
  "screen" | "profileVisited" | "selectedId" | "panel" | "theme" | "commandPaletteOpen" | "filtersVisible"
> = {
  screen: "search",
  profileVisited: false,
  selectedId: null,
  panel: null,
  theme: "system",
  commandPaletteOpen: false,
  filtersVisible: false,
};

export const useAppUiStore = create<AppUiState>((set) => ({
  ...initialUiState,
  setScreen: (screen) =>
    set((state) => ({
      screen,
      profileVisited: state.profileVisited || screen === "profile",
    })),
  selectJob: (selectedId) =>
    set({ selectedId, panel: selectedId === null ? null : "job_detail" }),
  setPanel: (panel) => set({ panel }),
  setTheme: (theme) => set({ theme }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setFiltersVisible: (filtersVisible) => set({ filtersVisible }),
  toggleFilters: () => set((state) => ({ filtersVisible: !state.filtersVisible })),
}));

export function resetAppUiStore(): void {
  useAppUiStore.setState(initialUiState);
}
