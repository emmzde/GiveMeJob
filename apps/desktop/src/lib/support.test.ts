import { describe, expect, it, vi } from "vitest";

import { createSupportApi } from "@/lib/support";
import type { TauriAdapter } from "@/lib/tauri/adapter";

function adapter(available: boolean): TauriAdapter {
  return {
    invoke: vi.fn().mockResolvedValue(null),
    isAvailable: () => available,
    listen: vi.fn(),
  };
}

describe("support links", () => {
  it("does not attempt native navigation in the browser harness", async () => {
    const transport = adapter(false);
    await createSupportApi(transport).open("github");
    expect(transport.invoke).not.toHaveBeenCalled();
  });

  it("forwards only the closed support-link enum to Rust", async () => {
    const transport = adapter(true);
    const api = createSupportApi(transport);
    await api.open("github");
    await api.open("feedback");
    expect(transport.invoke).toHaveBeenNthCalledWith(1, "open_support_link", { link: "github" });
    expect(transport.invoke).toHaveBeenNthCalledWith(2, "open_support_link", { link: "feedback" });
  });
});
