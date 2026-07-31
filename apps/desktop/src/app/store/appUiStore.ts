import { create } from "zustand";

import type { JobId } from "@/lib/catalog";

export type AppScreen = "search" | "shortlist" | "profile";
export type AppPanel = "job_detail" | "emmy" | null;
export type AppTheme = "system" | "light" | "dark";

interface AppUiState {
  screen: AppScreen;
  selectedId: JobId | null;
  panel: AppPanel;
  theme: AppTheme;
  setScreen(screen: AppScreen): void;
  selectJob(selectedId: JobId | null): void;
  setPanel(panel: AppPanel): void;
  setTheme(theme: AppTheme): void;
}

const initialUiState: Pick<AppUiState, "screen" | "selectedId" | "panel" | "theme"> = {
  screen: "search",
  selectedId: null,
  panel: null,
  theme: "system",
};

export const useAppUiStore = create<AppUiState>((set) => ({
  ...initialUiState,
  setScreen: (screen) => set({ screen }),
  selectJob: (selectedId) =>
    set({ selectedId, panel: selectedId === null ? null : "job_detail" }),
  setPanel: (panel) => set({ panel }),
  setTheme: (theme) => set({ theme }),
}));

export function resetAppUiStore(): void {
  useAppUiStore.setState(initialUiState);
}
