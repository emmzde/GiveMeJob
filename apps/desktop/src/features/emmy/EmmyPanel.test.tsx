import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppQueryClient } from "@/app/queryClient";
import { resetAppUiStore } from "@/app/store/appUiStore";
import { EmmyPanel } from "@/features/emmy/EmmyPanel";
import { emmyApi } from "@/lib/emmy";
import type { EmmyConversation, EmmyTurnResult } from "@/lib/emmy";

const conversationId = "a".repeat(32);
const userMessage = {
  id: "b".repeat(32),
  conversationId,
  role: "user" as const,
  content: { type: "user" as const, text: "Найди Rust вакансии" },
  createdAt: "2026-08-01T10:00:00Z",
};
const assistantMessage = {
  id: "c".repeat(32),
  conversationId,
  role: "assistant" as const,
  content: {
    type: "assistant" as const,
    text: "Нашла подходящие вакансии в локальном каталоге.",
    jobCards: [],
    quickReplies: ["Сравни лучшие"],
    comparison: null,
  },
  createdAt: "2026-08-01T10:00:01Z",
};
const storedConversation: EmmyConversation = {
  conversation: {
    id: conversationId,
    title: "Найди Rust вакансии",
    createdAt: "2026-08-01T10:00:00Z",
    updatedAt: "2026-08-01T10:00:01Z",
  },
  messages: [userMessage, assistantMessage],
};
const turn: EmmyTurnResult = {
  conversationId,
  messages: [userMessage, assistantMessage],
  state: "success",
  provider: "cerebras",
  error: null,
};

describe("EmmyPanel vertical", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetAppUiStore();
  });

  it("sends a user message and renders the persisted assistant timeline", async () => {
    vi.spyOn(emmyApi, "getConfiguration").mockResolvedValue({
      available: true,
      providers: ["groq", "gemini", "openrouter", "cerebras"].map((provider) => ({
        provider: provider as "groq" | "gemini" | "openrouter" | "cerebras",
        configured: provider === "cerebras",
        byokConfigured: provider === "cerebras",
        demoAvailable: false,
      })),
    });
    vi.spyOn(emmyApi, "listConversations").mockResolvedValue([]);
    vi.spyOn(emmyApi, "loadConversation").mockResolvedValue(storedConversation);
    const send = vi.spyOn(emmyApi, "sendMessage").mockResolvedValue(turn);
    vi.spyOn(emmyApi, "watchState").mockResolvedValue(() => undefined);

    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <EmmyPanel onClose={() => undefined} />
      </QueryClientProvider>,
    );

    const composer = await screen.findByRole("textbox", { name: "Спросите Emmy о вакансиях…" });
    fireEvent.change(composer, { target: { value: "Найди Rust вакансии" } });
    fireEvent.keyDown(composer, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(send).toHaveBeenCalledWith({ text: "Найди Rust вакансии" }));
    expect(await screen.findByText("Нашла подходящие вакансии в локальном каталоге.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Сравни лучшие" })).toBeEnabled();
  });

  it("manages focus and Escape for the recent-conversation popover", async () => {
    vi.spyOn(emmyApi, "getConfiguration").mockResolvedValue({
      available: true,
      providers: ["groq", "gemini", "openrouter", "cerebras"].map((provider) => ({
        provider: provider as "groq" | "gemini" | "openrouter" | "cerebras",
        configured: provider === "groq",
        byokConfigured: provider === "groq",
        demoAvailable: false,
      })),
    });
    const listConversations = vi
      .spyOn(emmyApi, "listConversations")
      .mockResolvedValue([storedConversation.conversation]);
    vi.spyOn(emmyApi, "loadConversation").mockResolvedValue(storedConversation);
    vi.spyOn(emmyApi, "watchState").mockResolvedValue(() => undefined);

    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <EmmyPanel onClose={() => undefined} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(listConversations).toHaveBeenCalled());
    await screen.findByText("Нашла подходящие вакансии в локальном каталоге.");
    const trigger = screen.getByRole("button", { name: "История разговоров" });
    fireEvent.click(trigger);
    const region = await screen.findByRole("region", { name: "Последние разговоры" });
    const conversationButton = within(region).getByRole("button", { name: /Найди Rust вакансии/ });
    await waitFor(() => expect(conversationButton).toHaveFocus());
    fireEvent.click(conversationButton);
    await waitFor(() => expect(trigger).toHaveFocus());

    fireEvent.click(trigger);
    await screen.findByRole("region", { name: "Последние разговоры" });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "Последние разговоры" })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });
});
