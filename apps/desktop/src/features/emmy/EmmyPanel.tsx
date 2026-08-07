import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bookmark,
  ChevronDown,
  ChevronsRight,
  CircleGauge,
  FileSearch,
  GitCompareArrows,
  Plus,
  RotateCcw,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import { useAppUiStore } from "@/app/store/appUiStore";
import { Button } from "@/components/ui/button";
import { EmmyMascot } from "@/features/emmy/EmmyMascot";
import { EmmyTimeline } from "@/features/emmy/EmmyTimeline";
import {
  emmyConversationQueryKey,
  emmyConversationsQueryKey,
  useEmmyConfiguration,
} from "@/features/emmy/hooks";
import { shortlistQueryKey } from "@/features/shortlist/hooks";
import { emmyApi } from "@/lib/emmy";
import type {
  EmmyConversation,
  EmmyState,
  EmmyStateEvent,
  EmmyTurnResult,
  ShortlistPreview,
} from "@/lib/emmy";
import { t } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n";

const starterReplies = [
  { icon: FileSearch, labelKey: "emmyToolSearch", replyKey: "emmyStarterFind" },
  { icon: GitCompareArrows, labelKey: "emmyToolCompare", replyKey: "emmyStarterCompare" },
  { icon: CircleGauge, labelKey: "emmyToolMatch", replyKey: "emmyStarterMatch" },
  { icon: Bookmark, labelKey: "shortlist", replyKey: "emmyStarterShortlist" },
] as const satisfies ReadonlyArray<{ icon: LucideIcon; labelKey: MessageKey; replyKey: MessageKey }>;

export function EmmyPanel({ onClose }: { onClose(): void }) {
  const configuration = useEmmyConfiguration();
  const queryClient = useQueryClient();
  const setScreen = useAppUiStore((state) => state.setScreen);
  const selectJob = useAppUiStore((state) => state.selectJob);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [optimisticText, setOptimisticText] = useState<string | null>(null);
  const [liveEvent, setLiveEvent] = useState<EmmyStateEvent | null>(null);
  const [revealMessageId, setRevealMessageId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const historyPopoverRef = useRef<HTMLDivElement>(null);

  const conversations = useQuery({
    enabled: configuration.data?.available === true,
    queryFn: () => emmyApi.listConversations(),
    queryKey: emmyConversationsQueryKey,
    retry: false,
    staleTime: 15_000,
  });
  const resolvedActiveId = activeId;
  const conversation = useQuery({
    enabled: resolvedActiveId !== null && configuration.data?.available === true,
    queryFn: () => emmyApi.loadConversation(resolvedActiveId ?? ""),
    queryKey: emmyConversationQueryKey(resolvedActiveId ?? "none"),
    retry: false,
  });

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void emmyApi.watchState((event) => {
      if (!disposed) setLiveEvent(event);
    }).then((next) => {
      if (disposed) next();
      else unlisten = next;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (liveEvent?.state !== "success" && liveEvent?.state !== "empty") return;
    const timer = window.setTimeout(() => {
      setLiveEvent({ state: "idle", tool: null, step: 0 });
    }, 1_600);
    return () => window.clearTimeout(timer);
  }, [liveEvent]);

  useEffect(() => {
    if (!historyOpen) return;
    const frame = window.requestAnimationFrame(() => {
      const popover = historyPopoverRef.current;
      const firstButton = popover?.querySelector<HTMLButtonElement>("button");
      (firstButton ?? popover)?.focus();
    });
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setHistoryOpen(false);
      window.requestAnimationFrame(() => historyButtonRef.current?.focus());
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (historyPopoverRef.current?.contains(event.target)) return;
      if (historyButtonRef.current?.contains(event.target)) return;
      setHistoryOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [historyOpen]);

  const available = configuration.data?.available === true;
  const mascotState: EmmyState = !available
    ? "offline"
    : (liveEvent?.state ?? (busy ? "thinking" : "idle"));
  const stateLabel = labelForState(mascotState);
  const messages = conversation.data?.messages ?? [];
  const hasTimeline = messages.length > 0 || optimisticText !== null || busy;
  const conversationTitle = useMemo(
    () => conversations.data?.find((item) => item.id === resolvedActiveId)?.title ?? t("emmyNewConversation"),
    [conversations.data, resolvedActiveId],
  );

  function updateConversationCache(result: EmmyTurnResult): void {
    queryClient.setQueryData<EmmyConversation>(
      emmyConversationQueryKey(result.conversationId),
      (current) => current ? {
        ...current,
        messages: mergeMessages(current.messages, result.messages),
      } : current,
    );
  }

  async function sendText(rawText: string): Promise<void> {
    const text = rawText.trim();
    if (!available || busy || text.length === 0) return;
    setBusy(true);
    setDraft("");
    setOptimisticText(text);
    setLiveEvent({ state: "thinking", tool: null, step: 0 });
    try {
      const result = await emmyApi.sendMessage({
        ...(resolvedActiveId ? { conversationId: resolvedActiveId } : {}),
        text,
      });
      setActiveId(result.conversationId);
      const latestAssistant = [...result.messages]
        .reverse()
        .find((message) => message.content.type === "assistant");
      setRevealMessageId(latestAssistant?.id ?? null);
      updateConversationCache(result);
      setLiveEvent({ state: result.state, tool: null, step: 0 });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: emmyConversationsQueryKey }),
        queryClient.invalidateQueries({ queryKey: emmyConversationQueryKey(result.conversationId) }),
      ]);
    } catch {
      setLiveEvent({ state: "error", tool: null, step: 0 });
    } finally {
      setOptimisticText(null);
      setBusy(false);
      requestAnimationFrame(() => composerRef.current?.focus());
    }
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void sendText(draft);
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void sendText(draft);
  }

  function startNewConversation(): void {
    if (busy) return;
    setHistoryOpen(false);
    setActiveId(null);
    setDraft("");
    setOptimisticText(null);
    setRevealMessageId(null);
    setLiveEvent(available ? { state: "idle", tool: null, step: 0 } : null);
    setConfirmationPending(null);
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  async function confirmShortlist(preview: ShortlistPreview, confirmed: boolean): Promise<void> {
    if (!resolvedActiveId || confirmationPending) return;
    setConfirmationPending(preview.confirmationId);
    try {
      const result = await emmyApi.confirmShortlist({
        conversationId: resolvedActiveId,
        confirmationId: preview.confirmationId,
        confirmed,
      });
      updateConversationCache(result);
      setLiveEvent({ state: result.state, tool: "set_shortlist", step: 0 });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: emmyConversationQueryKey(resolvedActiveId) }),
        queryClient.invalidateQueries({ queryKey: emmyConversationsQueryKey }),
        queryClient.invalidateQueries({ queryKey: shortlistQueryKey }),
      ]);
    } catch {
      setLiveEvent({ state: "error", tool: "set_shortlist", step: 0 });
    } finally {
      setConfirmationPending(null);
      requestAnimationFrame(() => composerRef.current?.focus());
    }
  }

  function openJob(jobId: Parameters<typeof selectJob>[0]): void {
    setScreen("search");
    selectJob(jobId);
  }

  function openSettings(): void {
    setScreen("settings");
    onClose();
  }

  return (
    <aside
      aria-label={t("emmyPanelLabel")}
      className="emmy-panel relative flex h-full min-w-0 flex-col bg-[var(--emmy-bg)]"
    >
      <header className="relative flex h-12 shrink-0 items-center gap-2 px-4">
        <Button
          aria-controls="emmy-history-popover"
          aria-expanded={historyOpen}
          aria-label={t("emmyHistory")}
          className="group min-w-0 flex-1 justify-start gap-1.5 px-1.5 text-[13px] font-semibold"
          disabled={!available}
          onClick={() => setHistoryOpen((open) => !open)}
          ref={historyButtonRef}
          type="button"
          variant="ghost"
        >
          <span className="truncate">{conversationTitle}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform duration-300 ease-[var(--ease)] group-aria-[expanded=true]:rotate-180"
          />
          <span className="sr-only">{stateLabel}</span>
        </Button>
        <Button
          aria-label={t("emmyNewConversation")}
          className="size-7 px-0"
          disabled={!available || busy}
          onClick={startNewConversation}
          type="button"
          variant="ghost"
        >
          <Plus aria-hidden="true" className="size-4" />
        </Button>
        <Button
          aria-label={t("closeEmmy")}
          className="size-7 px-0"
          onClick={onClose}
          type="button"
          variant="ghost"
        >
          <ChevronsRight aria-hidden="true" className="size-4" />
        </Button>
        {historyOpen ? (
          <div
            aria-label={t("emmyRecentConversations")}
            className="emmy-history-popover absolute left-2 right-2 top-10 z-20 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-[var(--shadow-md)]"
            id="emmy-history-popover"
            onBlur={(event) => {
              const next = event.relatedTarget;
              if (next instanceof Node && event.currentTarget.contains(next)) return;
              if (next === historyButtonRef.current) return;
              setHistoryOpen(false);
            }}
            ref={historyPopoverRef}
            role="region"
            tabIndex={-1}
          >
            <p className="border-b border-[var(--border)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              {t("emmyRecentConversations")}
            </p>
            <div className="max-h-64 overflow-y-auto p-1">
              {conversations.data?.length ? conversations.data.map((item) => (
                <button
                  aria-current={item.id === resolvedActiveId ? "true" : undefined}
                  className="block w-full rounded-[var(--radius-md)] px-2 py-2 text-left text-[13px] leading-4 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] aria-[current=true]:bg-[var(--surface-active)] aria-[current=true]:text-[var(--text)]"
                  key={item.id}
                  onClick={() => {
                    setActiveId(item.id);
                    setRevealMessageId(null);
                    setHistoryOpen(false);
                    requestAnimationFrame(() => historyButtonRef.current?.focus());
                  }}
                  type="button"
                >
                  <span className="block truncate font-medium">{item.title}</span>
                  <span className="mt-0.5 block text-[10px] text-[var(--text-tertiary)]">
                    {new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(item.updatedAt))}
                  </span>
                </button>
              )) : (
                <p className="px-2 py-4 text-center text-xs text-[var(--text-tertiary)]">{t("emmyHistoryEmpty")}</p>
              )}
            </div>
          </div>
        ) : null}
      </header>

      {configuration.isPending ? (
        <div aria-label={t("aiChecking")} className="flex min-h-0 flex-1 flex-col gap-3 p-3" role="status">
          <div className="h-20 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-1)]" />
          <div className="h-28 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-1)]" />
        </div>
      ) : !available ? (
        <OfflineState onSettings={openSettings} />
      ) : conversation.isError ? (
        <div className="grid min-h-0 flex-1 place-items-center p-6 text-center">
          <div>
            <EmmyMascot className="mx-auto size-14" state="error" />
            <p className="mt-3 text-sm font-semibold">{t("emmyConversationError")}</p>
            <Button className="mt-3" onClick={() => void conversation.refetch()} type="button" variant="outline">
              <RotateCcw aria-hidden="true" className="size-4" />
              {t("profileRetry")}
            </Button>
          </div>
        </div>
      ) : conversation.isPending && resolvedActiveId ? (
        <div aria-label={t("emmyConversationLoading")} className="flex min-h-0 flex-1 flex-col gap-3 p-3" role="status">
          <div className="ml-auto h-12 w-3/4 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-1)]" />
          <div className="h-20 w-5/6 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-1)]" />
        </div>
      ) : hasTimeline ? (
        <EmmyTimeline
          confirmationPending={confirmationPending}
          liveEvent={busy ? liveEvent : null}
          messages={messages}
          onConfirm={(preview, confirmed) => void confirmShortlist(preview, confirmed)}
          onOpenJob={openJob}
          onQuickReply={(reply) => void sendText(reply)}
          onRevealComplete={(messageId) => {
            setRevealMessageId((current) => current === messageId ? null : current);
          }}
          optimisticText={optimisticText}
          revealMessageId={revealMessageId}
        />
      ) : (
        <WelcomeState onReply={(reply) => void sendText(reply)} />
      )}

      <form className="px-4 pb-4 pt-2" onSubmit={submit}>
        <div className="emmy-composer-shell flex min-h-12 items-end gap-2 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-2)] py-2 pl-3 pr-2">
          <label className="sr-only" htmlFor="emmy-composer">{available ? t("emmyInputPlaceholder") : t("emmyUnavailable")}</label>
          <textarea
            aria-label={available ? t("emmyInputPlaceholder") : t("emmyUnavailable")}
            className="emmy-composer block max-h-32 min-h-8 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-0.5 py-1.5 text-[13px] leading-5 text-[var(--text)] outline-none placeholder:text-[var(--text-placeholder)] disabled:text-[var(--text-disabled)]"
            disabled={!available || busy}
            id="emmy-composer"
            maxLength={4_000}
            onBlur={() => {
              if (available && !busy) setLiveEvent({ state: "idle", tool: null, step: 0 });
            }}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onFocus={() => {
              if (available && !busy) setLiveEvent({ state: "listening", tool: null, step: 0 });
            }}
            onKeyDown={handleComposerKeyDown}
            placeholder={available ? t("emmyInputPlaceholder") : t("emmyOfflineInputPlaceholder")}
            ref={composerRef}
            rows={1}
            value={draft}
          />
          <button
            aria-label={busy ? t("emmyWorking") : t("emmySend")}
            className="emmy-send-button group grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] border border-[var(--text)] bg-[var(--text)] text-[var(--bg)] transition-[transform,opacity,background-color,border-color,box-shadow] duration-300 ease-[var(--ease)] active:scale-[0.96] hover:opacity-90 disabled:border-[var(--border)] disabled:bg-[var(--surface-3)] disabled:text-[var(--text-disabled)] disabled:active:scale-100"
            disabled={!available || busy || draft.trim().length === 0}
            type="submit"
          >
            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 20 20">
              <path d="M4 10 10 4l6 6M10 5v11" stroke="currentColor" strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.6" />
            </svg>
          </button>
        </div>
      </form>
    </aside>
  );
}

function OfflineState({ onSettings }: { onSettings(): void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-end px-5 pb-5">
      <EmmyMascot className="size-24" interactive state="offline" trackPointer />
      <h2 className="mt-3 max-w-64 text-[21px] font-bold leading-7 tracking-[-0.025em]">{t("emmyOfflineTitle")}</h2>
      <p className="mt-2 max-w-72 text-[13px] leading-5 text-[var(--text-secondary)]">{t("emmyOfflineDescription")}</p>
      <Button className="mt-4 self-start" onClick={onSettings} type="button" variant="outline">
        <Settings aria-hidden="true" className="size-4" />
        {t("emmyConfigureProviders")}
      </Button>
    </div>
  );
}

function WelcomeState({ onReply }: { onReply(reply: string): void }) {
  return (
    <div className="scroll-region flex min-h-0 flex-1 flex-col justify-end overflow-y-auto px-5 pb-4">
      <div className="emmy-welcome">
        <EmmyMascot className="emmy-welcome-mascot size-20" interactive state="idle" trackPointer />
        <h2 className="emmy-welcome-title mt-3 text-[18px] font-bold leading-6 tracking-[-0.025em]">
          {t("emmyWelcomeTitle")}
        </h2>
        <div aria-label={t("emmyWelcomeTitle")} className="emmy-starter-list mt-4" role="group">
          {starterReplies.map(({ icon: Icon, labelKey, replyKey }) => {
            const label = t(labelKey);
            const reply = t(replyKey);
            return (
              <button
                aria-label={reply}
                className="emmy-starter-row group flex h-9 w-full items-center gap-3 rounded-[var(--radius-md)] px-1.5 text-left text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] active:scale-[0.99]"
                key={replyKey}
                onClick={() => onReply(reply)}
                type="button"
              >
                <Icon aria-hidden="true" className="size-4 shrink-0 text-[var(--text-tertiary)] transition-transform duration-300 ease-[var(--ease)] group-hover:-translate-y-px group-hover:text-[var(--text)]" />
                <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
                <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0 translate-x-1 text-[var(--text-disabled)] opacity-0 transition-[transform,opacity] duration-300 ease-[var(--ease)] group-hover:translate-x-0 group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function mergeMessages(
  current: EmmyConversation["messages"],
  incoming: EmmyTurnResult["messages"],
): EmmyConversation["messages"] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function labelForState(state: EmmyState): string {
  switch (state) {
    case "idle": return t("emmyStateIdle");
    case "listening": return t("emmyStateListening");
    case "thinking": return t("emmyStateThinking");
    case "searching": return t("emmyStateSearching");
    case "success": return t("emmyStateSuccess");
    case "empty": return t("emmyStateEmpty");
    case "error": return t("emmyStateError");
    case "offline": return t("aiOffline");
  }
}
