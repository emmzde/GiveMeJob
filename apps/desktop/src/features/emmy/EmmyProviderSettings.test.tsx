import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createAppQueryClient } from "@/app/queryClient";
import { EmmyProviderSettings } from "@/features/emmy/EmmyProviderSettings";
import { t } from "@/lib/i18n";

vi.mock("@/features/emmy/hooks", () => ({
  emmyConfigurationQueryKey: ["emmy", "configuration"],
  useEmmyConfiguration: () => ({
    data: {
      available: true,
      customApi: {
        baseUrl: "http://127.0.0.1:1234/v1",
        keyConfigured: false,
        model: "local-model",
      },
      providers: [
        { byokConfigured: true, configured: true, demoAvailable: false, provider: "openrouter" },
        { byokConfigured: false, configured: false, demoAvailable: false, provider: "groq" },
        { byokConfigured: false, configured: false, demoAvailable: false, provider: "gemini" },
        { byokConfigured: false, configured: false, demoAvailable: false, provider: "cerebras" },
      ],
    },
    isPending: false,
  }),
}));

describe("EmmyProviderSettings", () => {
  it("renders one universal API connection instead of provider-specific forms", () => {
    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <EmmyProviderSettings />
      </QueryClientProvider>,
    );

    expect(screen.getByText(t("emmyCustomApiTitle"))).toBeInTheDocument();
    expect(screen.getByLabelText(t("emmyBaseUrl"))).toHaveValue("http://127.0.0.1:1234/v1");
    expect(screen.getByLabelText(t("emmyModel"))).toHaveValue("local-model");
    expect(screen.getByLabelText(t("emmyApiKey"))).toHaveAttribute("placeholder", t("emmyOptionalKey"));
    expect(screen.getByRole("button", { name: t("emmyUpdateApi") })).toBeInTheDocument();
    expect(screen.getAllByLabelText(t("emmyApiKey"))).toHaveLength(1);
    expect(screen.getByRole("button", { name: /LM Studio/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("fills the address from a quick-setup preset", () => {
    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <EmmyProviderSettings />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Groq" }));
    expect(screen.getByLabelText(t("emmyBaseUrl"))).toHaveValue("https://api.groq.com/openai/v1");
    expect(screen.getByLabelText(t("emmyModel"))).toHaveValue("");
    expect(screen.getByRole("button", { name: "Groq" })).toHaveAttribute("aria-pressed", "true");
  });
});
