import { describe, expect, it, vi } from "vitest";

import { createDesktopWindowApi } from "@/lib/tauri/window";

describe("desktop window API", () => {
  it("does nothing in the browser harness", async () => {
    const currentWindow = vi.fn();
    const api = createDesktopWindowApi(() => false, currentWindow);
    await api.close();
    expect(currentWindow).not.toHaveBeenCalled();
  });

  it("forwards native window actions", async () => {
    const window = {
      close: vi.fn().mockResolvedValue(undefined),
      minimize: vi.fn().mockResolvedValue(undefined),
      toggleMaximize: vi.fn().mockResolvedValue(undefined),
    };
    const api = createDesktopWindowApi(() => true, () => window);
    await api.minimize();
    await api.toggleMaximize();
    await api.close();
    expect(window.minimize).toHaveBeenCalledOnce();
    expect(window.toggleMaximize).toHaveBeenCalledOnce();
    expect(window.close).toHaveBeenCalledOnce();
  });
});
