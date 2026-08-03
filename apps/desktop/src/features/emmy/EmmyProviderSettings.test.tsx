import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createAppQueryClient } from "@/app/queryClient";
import { EmmyProviderSettings } from "@/features/emmy/EmmyProviderSettings";
import { t } from "@/lib/i18n";

vi.mock("@/features/emmy/hooks", () => ({
  emmyConfigurationQueryKey: ["emmy", "configuration"],
  useEmmyConfiguration: () => ({
    data: {
      available: true,
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
  it("renders the real sequential provider route", () => {
    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <EmmyProviderSettings />
      </QueryClientProvider>,
    );

    for (const index of ["01", "02", "03", "04"]) {
      expect(screen.getByText(index)).toBeInTheDocument();
    }
    expect(screen.getByText(t("emmyPrimaryProvider"))).toBeInTheDocument();
    expect(screen.getAllByLabelText(/API key$/u)).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: t("emmySaveKey") })).toHaveLength(4);
  });
});
