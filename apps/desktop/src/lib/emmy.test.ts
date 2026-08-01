import { describe, expect, it, vi } from "vitest";

import {
  createEmmyApi,
  emmyConfigurationSchema,
  emmyModelOutputSchema,
  emmyProviderSchema,
  emmyToolCallSchema,
} from "@/lib/emmy";
import { createSearchQuery } from "@/lib/catalog";
import type { TauriAdapter } from "@/lib/tauri/adapter";

const configuration = {
  available: true,
  providers: emmyProviderSchema.options.map((provider) => ({
    provider,
    configured: provider === "groq",
    byokConfigured: provider === "groq",
    demoAvailable: false,
  })),
};

function adapterReturning(value: unknown): TauriAdapter {
  return {
    isAvailable: () => true,
    invoke: () => Promise.resolve(value),
    listen: () => Promise.resolve(() => undefined),
  };
}

describe("Emmy strict contracts", () => {
  it("keeps the four-provider configuration closed without key material", () => {
    expect(emmyConfigurationSchema.parse(configuration)).toEqual(configuration);
    expect(emmyProviderSchema.options).toEqual(["groq", "gemini", "openrouter", "cerebras"]);
    expect(JSON.stringify(configuration)).not.toContain("key");
    expect(emmyConfigurationSchema.safeParse({ ...configuration, apiKey: "not-allowed" }).success)
      .toBe(false);
  });

  it("accepts only the five local tools and strict arguments", () => {
    const valid = [
      { name: "search_jobs", args: createSearchQuery({ text: "Rust", limit: 8 }) },
      { name: "get_job", args: { jobId: "1" } },
      { name: "compare_jobs", args: { jobIds: ["1", "2"] } },
      { name: "get_match_breakdown", args: { jobId: "1" } },
      { name: "set_shortlist", args: { jobId: "1", saved: true } },
    ];
    for (const call of valid) expect(emmyToolCallSchema.safeParse(call).success).toBe(true);
    expect(emmyToolCallSchema.safeParse({ name: "browse_web", args: {} }).success).toBe(false);
    expect(emmyToolCallSchema.safeParse({
      name: "get_job",
      args: { jobId: "1", url: "https://example.com" },
    }).success).toBe(false);
  });

  it("rejects duplicate cards, active-loop final states, and unknown response fields", () => {
    const valid = {
      type: "response",
      payload: {
        message: "Нашла вакансии.",
        jobCards: ["1", "2"],
        quickReplies: ["Сравни их"],
        mascotState: "success",
      },
    };
    expect(emmyModelOutputSchema.safeParse(valid).success).toBe(true);
    expect(emmyModelOutputSchema.safeParse({
      ...valid,
      payload: { ...valid.payload, jobCards: ["1", "1"] },
    }).success).toBe(false);
    expect(emmyModelOutputSchema.safeParse({
      ...valid,
      payload: { ...valid.payload, mascotState: "searching" },
    }).success).toBe(false);
    expect(emmyModelOutputSchema.safeParse({
      ...valid,
      payload: { ...valid.payload, rawProviderResponse: "forbidden" },
    }).success).toBe(false);
  });

  it("sends a BYOK value only into the write command and never expects it back", async () => {
    const calls: Array<{ command: string; args: Record<string, unknown> | undefined }> = [];
    const adapter: TauriAdapter = {
      isAvailable: () => true,
      invoke(command, args) {
        calls.push({ command, args });
        return Promise.resolve(configuration);
      },
      listen: () => Promise.resolve(() => undefined),
    };
    const api = createEmmyApi(adapter);
    await expect(api.setProviderKey("cerebras", "unit-test-key")).resolves.toEqual(configuration);
    expect(calls).toEqual([{
      command: "emmy_set_provider_key",
      args: { request: { provider: "cerebras", key: "unit-test-key" } },
    }]);
  });

  it("ignores malformed state events at the IPC listener", async () => {
    const onState = vi.fn();
    let listener: ((payload: unknown) => void) | undefined;
    const adapter: TauriAdapter = {
      isAvailable: () => true,
      invoke: () => Promise.resolve(configuration),
      listen(_event, next) {
        listener = next;
        return Promise.resolve(() => undefined);
      },
    };
    await createEmmyApi(adapter).watchState(onState);
    listener?.({ state: "searching", tool: "search_jobs", step: 1 });
    listener?.({ state: "searching", tool: "browse_web", step: 1 });
    expect(onState).toHaveBeenCalledTimes(1);
  });

  it("returns a four-provider offline fallback outside Tauri", async () => {
    const adapter = adapterReturning(configuration);
    adapter.isAvailable = () => false;
    await expect(createEmmyApi(adapter).getConfiguration()).resolves.toMatchObject({
      available: false,
      providers: [
        { provider: "groq", configured: false },
        { provider: "gemini", configured: false },
        { provider: "openrouter", configured: false },
        { provider: "cerebras", configured: false },
      ],
    });
  });
});
