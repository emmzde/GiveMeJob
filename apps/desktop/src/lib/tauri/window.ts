import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface WindowHandle {
  close(): Promise<void>;
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
}

interface DesktopWindowApi {
  close(): Promise<void>;
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
}

export function createDesktopWindowApi(
  available: () => boolean,
  currentWindow: () => WindowHandle,
): DesktopWindowApi {
  async function run(action: (window: WindowHandle) => Promise<void>): Promise<void> {
    if (!available()) return;
    await action(currentWindow());
  }

  return {
    close: () => run((window) => window.close()),
    minimize: () => run((window) => window.minimize()),
    toggleMaximize: () => run((window) => window.toggleMaximize()),
  };
}

export const desktopWindow = createDesktopWindowApi(isTauri, getCurrentWindow);
