import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type Unlisten = () => void;

export interface TauriAdapter {
  isAvailable(): boolean;
  invoke(command: string, args?: Record<string, unknown>): Promise<unknown>;
  listen(event: string, onPayload: (payload: unknown) => void): Promise<Unlisten>;
}

export const tauriAdapter: TauriAdapter = {
  isAvailable() {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  },
  invoke(command, args) {
    return invoke<unknown>(command, args);
  },
  listen(event, onPayload) {
    return listen<unknown>(event, ({ payload }) => onPayload(payload));
  },
};
