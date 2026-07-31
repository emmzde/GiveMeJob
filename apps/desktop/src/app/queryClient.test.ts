import { describe, expect, it } from "vitest";

import { createAppQueryClient } from "@/app/queryClient";

describe("app query client", () => {
  it("never retries local IPC queries or mutations automatically", () => {
    const client = createAppQueryClient();

    expect(client.getDefaultOptions().queries?.retry).toBe(false);
    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
  });
});
