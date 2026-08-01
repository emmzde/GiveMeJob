import { describe, expect, it, vi } from "vitest";

import { createProfileApi, profileInputSchema } from "@/lib/profile";
import type { ProfileInput, UserProfile } from "@/lib/profile";
import type { TauriAdapter } from "@/lib/tauri/adapter";

const input: ProfileInput = {
  preferredRoles: ["Rust Engineer"],
  seniority: "senior",
  skills: ["Rust", "SQLite"],
  country: "Azerbaijan",
  city: "Baku",
  remoteModes: ["remote", "hybrid"],
  salaryMinUsdYear: 100_000,
};

const profile: UserProfile = {
  ...input,
  version: 1,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
};

function adapterWithResponse(response: unknown): TauriAdapter {
  return {
    isAvailable: () => true,
    invoke: vi.fn().mockResolvedValue(response),
    listen: vi.fn(),
  };
}

describe("profile IPC", () => {
  it("validates and sends a strict profile payload", async () => {
    const adapter = adapterWithResponse(profile);
    const api = createProfileApi(adapter);
    await expect(api.saveProfile(input)).resolves.toEqual(profile);
    expect(adapter.invoke).toHaveBeenCalledWith("save_profile", { request: input });
  });

  it("rejects duplicate values before IPC", () => {
    expect(() =>
      profileInputSchema.parse({ ...input, skills: ["Rust", " rust "] }),
    ).toThrow();
  });

  it("rejects unknown response fields", async () => {
    const api = createProfileApi(adapterWithResponse({ ...profile, databasePath: "private" }));
    await expect(api.getProfile()).rejects.toThrow();
  });

  it("preserves closed IPC errors", async () => {
    const adapter = adapterWithResponse(null);
    vi.mocked(adapter.invoke).mockRejectedValue({ code: "user_data_unavailable" });
    const api = createProfileApi(adapter);
    await expect(api.getProfile()).rejects.toEqual({ code: "user_data_unavailable" });
  });
});
