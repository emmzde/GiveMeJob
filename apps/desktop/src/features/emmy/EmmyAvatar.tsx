import type { EmmyState } from "@/lib/emmy";
import { cn } from "@/lib/utils";

/**
 * Round portrait of Emmy for compact places (titlebar, chat).
 * While Emmy is busy a soft gradient ring orbits the portrait.
 */
export function EmmyAvatar({ className, state = "idle" }: { className?: string; state?: EmmyState }) {
  const busy = state === "thinking" || state === "searching";
  return (
    <span aria-hidden="true" className={cn("emmy-avatar", className)} data-busy={busy} data-state={state}>
      <span className="emmy-avatar-ring" />
      <span className="emmy-avatar-disc">
        <img alt="" draggable={false} src="/brand/emmy/avatar.webp" />
      </span>
    </span>
  );
}
