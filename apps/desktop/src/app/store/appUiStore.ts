import { create } from "zustand";

import type { JobId } from "@/lib/catalog";
import {
  defaultLocale,
  setActiveLocale,
  type AppLocale,
} from "@/lib/i18n";

export type AppScreen = "search" | "shortlist" | "profile" | "settings";
type AppPanel = "job_detail" | "emmy" | null;
export type AppTheme = "system" | "light" | "dark";

interface AppUiState {
  screen: AppScreen;
  profileVisited: boolean;
  welcomeCompleted: boolean;
  selectedId: JobId | null;
  panel: AppPanel;
  theme: AppTheme;
  language: AppLocale;
  commandPaletteOpen: boolean;
  filtersVisible: boolean;
  completeWelcome(): void;
  setScreen(screen: AppScreen): void;
  selectJob(selectedId: JobId | null): void;
  setPanel(panel: AppPanel): void;
  setTheme(theme: AppTheme): void;
  setLanguage(language: AppLocale): void;
  setCommandPaletteOpen(open: boolean): void;
  setFiltersVisible(visible: boolean): void;
  toggleFilters(): void;
}

const languageStorageKey = "givemejob.ui-language";
const welcomeStorageKey = "givemejob.welcome-completed";

function readStoredLanguage(): AppLocale {
  if (typeof window === "undefined") return defaultLocale;
  try {
    const storedLanguage = window.localStorage.getItem(languageStorageKey);
    return storedLanguage === "en" || storedLanguage === "ru" ? storedLanguage : defaultLocale;
  } catch {
    return defaultLocale;
  }
}

function persistLanguage(language: AppLocale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(languageStorageKey, language);
  } catch {
    // Language still changes for the current session when storage is unavailable.
  }
}

function readWelcomeCompleted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(welcomeStorageKey) === "1";
  } catch {
    return false;
  }
}

function persistWelcomeCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(welcomeStorageKey, "1");
  } catch {
    // The welcome screen still closes for the current session when storage is unavailable.
  }
}

const initialLanguage = readStoredLanguage();
setActiveLocale(initialLanguage);

const initialUiState: Pick<
  AppUiState,
  "screen" | "profileVisited" | "welcomeCompleted" | "selectedId" | "panel" | "theme" | "language" | "commandPaletteOpen" | "filtersVisible"
> = {
  screen: "search",
  profileVisited: false,
  welcomeCompleted: readWelcomeCompleted(),
  selectedId: null,
  panel: null,
  theme: "system",
  language: initialLanguage,
  commandPaletteOpen: false,
  filtersVisible: false,
};

export const useAppUiStore = create<AppUiState>((set) => ({
  ...initialUiState,
  completeWelcome: () => {
    persistWelcomeCompleted();
    set({ welcomeCompleted: true });
  },
  setScreen: (screen) =>
    set((state) => ({
      screen,
      profileVisited: state.profileVisited || screen === "profile",
    })),
  selectJob: (selectedId) =>
    set({ selectedId, panel: selectedId === null ? null : "job_detail" }),
  setPanel: (panel) => set({ panel }),
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => {
    setActiveLocale(language);
    persistLanguage(language);
    set({ language });
  },
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setFiltersVisible: (filtersVisible) => set({ filtersVisible }),
  toggleFilters: () => set((state) => ({ filtersVisible: !state.filtersVisible })),
}));

export function resetAppUiStore({ welcomeCompleted = true }: { welcomeCompleted?: boolean } = {}): void {
  setActiveLocale(defaultLocale);
  useAppUiStore.setState({ ...initialUiState, language: defaultLocale, welcomeCompleted });
}
