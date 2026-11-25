import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmmyTimeline } from "@/features/emmy/EmmyTimeline";
import type { EmmyMessage } from "@/lib/emmy";

const assistantMessage: EmmyMessage = {
  content: {
    comparison: null,
    jobCards: [],
    quickReplies: [],
    text: "Нашла подходящие вакансии и собрала короткое сравнение.",
    type: "assistant",
  },
  conversationId: "a".repeat(32),
  createdAt: "2026-08-03T10:00:01Z",
  id: "b".repeat(32),
  role: "assistant",
};

const handlers = {
  confirmationPending: null,
  onConfirm: () => undefined,
  onOpenJob: () => undefined,
  onQuickReply: () => undefined,
};

describe("EmmyTimeline", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reveals only the selected new assistant response progressively", () => {
    vi.useFakeTimers();
    const onRevealComplete = vi.fn();
    const { container } = render(
      <EmmyTimeline
        {...handlers}
        liveEvent={null}
        messages={[assistantMessage]}
        onRevealComplete={onRevealComplete}
        optimisticText={null}
        revealMessageId={assistantMessage.id}
      />,
    );

    const copy = container.querySelector<HTMLElement>("[data-streaming='true']");
    expect(copy).not.toBeNull();
    expect(copy?.textContent).toBe("");

    act(() => vi.advanceTimersByTime(72));
    expect(copy?.textContent?.length).toBeGreaterThan(0);
    expect(copy?.textContent).not.toBe(assistantMessage.content.type === "assistant" ? assistantMessage.content.text : "");

    act(() => vi.advanceTimersByTime(5_000));
    expect(copy?.textContent).toBe(assistantMessage.content.type === "assistant" ? assistantMessage.content.text : "");
    expect(onRevealComplete).toHaveBeenCalledOnce();
  });

  it("renders history immediately and uses the monochrome SVG while waiting", () => {
    const { container } = render(
      <EmmyTimeline
        {...handlers}
        liveEvent={{ state: "thinking", step: 0, tool: null }}
        messages={[assistantMessage]}
        onRevealComplete={() => undefined}
        optimisticText={null}
        revealMessageId={null}
      />,
    );

    expect(container.querySelector("[data-streaming='false']")?.textContent).toContain("Нашла подходящие вакансии");
    expect(container.querySelector(".emmy-thinking-spark")).not.toBeNull();
    expect(container.querySelector(".lucide-sparkles")).toBeNull();
  });
});
