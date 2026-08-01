import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Bookmark,
  Check,
  CircleAlert,
  Clock3,
  FileSearch,
  GitCompareArrows,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { EmmyComparisonTable } from "@/features/emmy/EmmyComparisonTable";
import { EmmyJobCard } from "@/features/emmy/EmmyJobCard";
import { EmmyMascot } from "@/features/emmy/EmmyMascot";
import type { JobId } from "@/lib/catalog";
import type {
  EmmyMessage,
  EmmyStateEvent,
  EmmyToolCall,
  EmmyToolResult,
  LlmError,
  ShortlistPreview,
} from "@/lib/emmy";
import { t } from "@/lib/i18n";

type TimelineItem =
  | { kind: "message"; key: string; message: EmmyMessage }
  | { kind: "optimistic"; key: "optimistic"; text: string }
  | { kind: "live"; key: "live"; event: EmmyStateEvent };

interface EmmyTimelineProps {
  messages: readonly EmmyMessage[];
  optimisticText: string | null;
  liveEvent: EmmyStateEvent | null;
  confirmationPending: string | null;
  onConfirm(preview: ShortlistPreview, confirmed: boolean): void;
  onOpenJob(jobId: JobId): void;
  onQuickReply(text: string): void;
}

export function EmmyTimeline(props: EmmyTimelineProps) {
  const items = useMemo<TimelineItem[]>(() => {
    const timeline: TimelineItem[] = props.messages.map((message) => ({
      kind: "message" as const,
      key: message.id,
      message,
    }));
    if (props.optimisticText) {
      timeline.push({ kind: "optimistic", key: "optimistic", text: props.optimisticText });
    }
    if (props.liveEvent && (props.liveEvent.state === "thinking" || props.liveEvent.state === "searching")) {
      timeline.push({ kind: "live", key: "live", event: props.liveEvent });
    }
    return timeline;
  }, [props.liveEvent, props.messages, props.optimisticText]);

  const shared = {
    confirmationPending: props.confirmationPending,
    onConfirm: props.onConfirm,
    onOpenJob: props.onOpenJob,
    onQuickReply: props.onQuickReply,
  };
  return items.length > 50 ? (
    <VirtualTimeline items={items} {...shared} />
  ) : (
    <SimpleTimeline items={items} {...shared} />
  );
}

type TimelineRenderProps = Pick<
  EmmyTimelineProps,
  "confirmationPending" | "onConfirm" | "onOpenJob" | "onQuickReply"
>;

function SimpleTimeline({ items, ...props }: { items: TimelineItem[] } & TimelineRenderProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight });
  }, [items.length]);
  return (
    <div
      aria-live="polite"
      aria-relevant="additions text"
      className="scroll-region min-h-0 flex-1 overflow-y-auto px-3 py-4"
      ref={viewportRef}
      role="log"
    >
      <div className="space-y-4">
        {items.map((item) => <TimelineItemView item={item} key={item.key} {...props} />)}
      </div>
    </div>
  );
}

function VirtualTimeline({ items, ...props }: { items: TimelineItem[] } & TimelineRenderProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    estimateSize: () => 132,
    getScrollElement: () => viewportRef.current,
    overscan: 6,
  });
  useEffect(() => {
    virtualizer.scrollToIndex(items.length - 1, { align: "end" });
  }, [items.length, virtualizer]);
  return (
    <div
      aria-live="polite"
      aria-relevant="additions text"
      className="scroll-region min-h-0 flex-1 overflow-y-auto px-3"
      ref={viewportRef}
      role="log"
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index];
          if (!item) return null;
          return (
            <div
              className="absolute left-0 top-0 w-full py-2"
              data-index={virtualItem.index}
              key={item.key}
              ref={virtualizer.measureElement}
              style={{ transform: `translateY(${virtualItem.start}px)` }}
            >
              <TimelineItemView item={item} {...props} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineItemView({
  confirmationPending,
  item,
  onConfirm,
  onOpenJob,
  onQuickReply,
}: { item: TimelineItem } & TimelineRenderProps) {
  if (item.kind === "optimistic") return <UserBubble text={item.text} />;
  if (item.kind === "live") return <LiveActivity event={item.event} />;
  const { message } = item;
  switch (message.content.type) {
    case "user":
      return <UserBubble text={message.content.text} />;
    case "notice":
      return <Notice error={message.content.error} />;
    case "tool":
      return (
        <ToolActivity
          busy={message.content.result.type === "set_shortlist"
            && confirmationPending === message.content.result.preview.confirmationId}
          call={message.content.call}
          onConfirm={onConfirm}
          result={message.content.result}
        />
      );
    case "assistant":
      return (
        <div className="flex items-start gap-2">
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-1)]">
            <EmmyMascot className="size-6" state="idle" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="whitespace-pre-wrap break-words text-xs leading-5 text-[var(--text)]">
              {message.content.text}
            </p>
            {message.content.jobCards.length > 0 ? (
              <div className="mt-2 border-y border-[var(--border)]">
                {message.content.jobCards.map((job) => (
                  <EmmyJobCard job={job} key={job.id} onOpen={() => onOpenJob(job.id)} />
                ))}
              </div>
            ) : null}
            {message.content.comparison ? (
              <EmmyComparisonTable comparison={message.content.comparison} onOpen={onOpenJob} />
            ) : null}
            {message.content.quickReplies.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t("emmyQuickReplies")}>
                {message.content.quickReplies.map((reply) => (
                  <button
                    className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-0)] px-2 py-1 text-left text-[10px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                    key={reply}
                    onClick={() => onQuickReply(reply)}
                    type="button"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      );
  }
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[88%] whitespace-pre-wrap break-words rounded-[var(--radius-md)] bg-[var(--accent-muted)] px-3 py-2 text-xs leading-5 text-[var(--text)]">
        {text}
      </p>
    </div>
  );
}

function Notice({ error }: { error: LlmError }) {
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-muted)] p-2.5 text-xs leading-5 text-[var(--warning)]" role="status">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>{errorLabel(error)}</span>
    </div>
  );
}

function LiveActivity({ event }: { event: EmmyStateEvent }) {
  const Icon = event.state === "searching" ? Search : Sparkles;
  return (
    <div className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)]" role="status">
      <span className="emmy-activity-pulse grid size-6 place-items-center rounded-[var(--radius-sm)] bg-[var(--surface-1)]">
        <Icon aria-hidden="true" className="size-3.5" />
      </span>
      <span>{event.tool ? toolLabel(event.tool) : t("emmyThinking")}</span>
    </div>
  );
}

function ToolActivity({
  busy,
  call,
  onConfirm,
  result,
}: {
  busy: boolean;
  call: EmmyToolCall;
  onConfirm(preview: ShortlistPreview, confirmed: boolean): void;
  result: EmmyToolResult;
}) {
  const preview = result.type === "set_shortlist" ? result.preview : null;
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-2.5">
      <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
        <ToolGlyph name={call.name} />
        <span className="font-medium">{toolLabel(call.name)}</span>
        {preview?.status === "pending" ? (
          <Clock3 aria-hidden="true" className="ml-auto size-3.5 text-[var(--text-tertiary)]" />
        ) : preview?.status === "cancelled" ? (
          <X aria-hidden="true" className="ml-auto size-3.5 text-[var(--text-tertiary)]" />
        ) : (
          <Check aria-hidden="true" className="ml-auto size-3.5 text-[var(--positive)]" />
        )}
      </div>
      <p className="mt-1 text-[10px] leading-4 text-[var(--text-tertiary)]">{toolResultLabel(result)}</p>
      {preview ? (
        <div className="mt-2 border-t border-[var(--border)] pt-2">
          <p className="text-xs font-medium text-[var(--text)]">{preview.job.title}</p>
          <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">{preview.job.company} · {preview.job.attribution}</p>
          {preview.status === "pending" ? (
            <div className="mt-2 flex gap-2">
              <Button className="h-7 px-2 text-xs" disabled={busy} onClick={() => onConfirm(preview, true)} type="button" variant="accent">
                {preview.saved ? t("emmyConfirmSave") : t("emmyConfirmRemove")}
              </Button>
              <Button className="h-7 px-2 text-xs" disabled={busy} onClick={() => onConfirm(preview, false)} type="button" variant="ghost">
                {t("cancel")}
              </Button>
            </div>
          ) : (
            <p className="mt-2 flex items-center gap-1 text-[10px] text-[var(--text-secondary)]" role="status">
              {preview.status === "confirmed" ? <Check aria-hidden="true" className="size-3 text-[var(--positive)]" /> : <X aria-hidden="true" className="size-3" />}
              {preview.status === "confirmed" ? t("emmyConfirmationDone") : t("emmyConfirmationCancelled")}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ToolGlyph({ name }: { name: EmmyToolCall["name"] }) {
  switch (name) {
    case "search_jobs": return <Search aria-hidden="true" className="size-3.5 text-[var(--text-tertiary)]" />;
    case "get_job": return <FileSearch aria-hidden="true" className="size-3.5 text-[var(--text-tertiary)]" />;
    case "compare_jobs": return <GitCompareArrows aria-hidden="true" className="size-3.5 text-[var(--text-tertiary)]" />;
    case "get_match_breakdown": return <Sparkles aria-hidden="true" className="size-3.5 text-[var(--text-tertiary)]" />;
    case "set_shortlist": return <Bookmark aria-hidden="true" className="size-3.5 text-[var(--text-tertiary)]" />;
  }
}

function toolLabel(name: EmmyToolCall["name"]): string {
  switch (name) {
    case "search_jobs": return t("emmyToolSearch");
    case "get_job": return t("emmyToolGetJob");
    case "compare_jobs": return t("emmyToolCompare");
    case "get_match_breakdown": return t("emmyToolMatch");
    case "set_shortlist": return t("emmyToolShortlist");
  }
}

function toolResultLabel(result: EmmyToolResult): string {
  switch (result.type) {
    case "search_jobs": return `${result.items.length} ${t("resultsFound")}`;
    case "get_job": return t("emmyToolJobLoaded");
    case "compare_jobs": return `${t("emmyToolCompared")} ${result.comparison.rows.length}`;
    case "get_match_breakdown": return result.breakdown ? `${result.breakdown.score}% ${t("matchLabel")}` : t("matchUnavailable");
    case "set_shortlist": return result.preview.saved ? t("emmyShortlistPreviewSave") : t("emmyShortlistPreviewRemove");
  }
}

function errorLabel(error: LlmError): string {
  switch (error.code) {
    case "rate_limit": return t("emmyErrorRateLimit");
    case "timeout": return t("emmyErrorTimeout");
    case "transport": return t("emmyErrorTransport");
    case "schema": return t("emmyErrorSchema");
    case "unavailable": return t("emmyErrorUnavailable");
    case "tool_limit": return t("emmyErrorToolLimit");
    case "invalid_request": return t("emmyErrorInvalidRequest");
    case "local": return t("emmyErrorLocal");
  }
}
