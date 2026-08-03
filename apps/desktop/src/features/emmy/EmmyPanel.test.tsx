import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppQueryClient } from "@/app/queryClient";
import { resetAppUiStore } from "@/app/store/appUiStore";
import { EmmyPanel } from "@/features/emmy/EmmyPanel";
import { emmyApi } from "@/lib/emmy";
import type { EmmyConversation, EmmyTurnResult } from "@/lib/emmy";
import { t } from "@/lib/i18n";

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
    const starters = screen.getByRole("group", { name: t("emmyWelcomeTitle") });
    expect(within(starters).getAllByRole("button")).toHaveLength(4);
    expect(starters.querySelector(".ui-mono")).toBeNull();
    fireEvent.change(composer, { target: { value: "Найди Rust вакансии" } });
    fireEvent.keyDown(composer, { isComposing: true, key: "Enter" });
    expect(send).not.toHaveBeenCalled();
    fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });
    expect(send).not.toHaveBeenCalled();
    fireEvent.keyDown(composer, { key: "Enter" });

    await waitFor(() => expect(send).toHaveBeenCalledWith({ text: "Найди Rust вакансии" }));
    expect(await screen.findByLabelText("Нашла подходящие вакансии в локальном каталоге.")).toBeVisible();
    expect(await screen.findByRole("button", { name: "Сравни лучшие" }, { timeout: 3_000 })).toBeEnabled();
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
    const loadConversation = vi.spyOn(emmyApi, "loadConversation").mockResolvedValue(storedConversation);
    vi.spyOn(emmyApi, "watchState").mockResolvedValue(() => undefined);

    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <EmmyPanel onClose={() => undefined} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(listConversations).toHaveBeenCalled());
    expect(loadConversation).not.toHaveBeenCalled();
    expect(screen.getByText(t("emmyWelcomeTitle"))).toBeVisible();
    const trigger = screen.getByRole("button", { name: t("emmyHistory") });
    expect(trigger).toHaveTextContent(t("emmyNewConversation"));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const region = await screen.findByRole("region", { name: t("emmyRecentConversations") });
    const conversationButton = within(region).getByRole("button", { name: /Найди Rust вакансии/ });
    await waitFor(() => expect(conversationButton).toHaveFocus());
    fireEvent.click(conversationButton);
    await waitFor(() => expect(loadConversation).toHaveBeenCalledWith(conversationId));
    expect(await screen.findByText(assistantMessage.content.text)).toBeVisible();
    await waitFor(() => expect(trigger).toHaveFocus());

    fireEvent.click(trigger);
    await screen.findByRole("region", { name: t("emmyRecentConversations") });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: t("emmyRecentConversations") })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("returns to an unsaved blank conversation without creating backend state", async () => {
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
    const createConversation = vi.spyOn(emmyApi, "createConversation");
    const send = vi.spyOn(emmyApi, "sendMessage").mockResolvedValue(turn);
    vi.spyOn(emmyApi, "watchState").mockResolvedValue(() => undefined);

    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <EmmyPanel onClose={() => undefined} />
      </QueryClientProvider>,
    );

    const history = await screen.findByRole("button", { name: t("emmyHistory") });
    await waitFor(() => expect(listConversations).toHaveBeenCalled());
    fireEvent.click(history);
    const region = await screen.findByRole("region", { name: t("emmyRecentConversations") });
    fireEvent.click(await within(region).findByRole("button", { name: /Найди Rust вакансии/ }));
    expect(await screen.findByText(assistantMessage.content.text)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: t("emmyNewConversation") }));
    expect(screen.getByText(t("emmyWelcomeTitle"))).toBeVisible();
    expect(screen.queryByText(assistantMessage.content.text)).not.toBeInTheDocument();
    expect(createConversation).not.toHaveBeenCalled();

    const composer = screen.getByRole("textbox", { name: t("emmyInputPlaceholder") });
    fireEvent.change(composer, { target: { value: userMessage.content.text } });
    fireEvent.keyDown(composer, { key: "Enter" });
    await waitFor(() => expect(send).toHaveBeenCalledWith({ text: userMessage.content.text }));
  });
});
