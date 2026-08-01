import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "accent" | "positive" | "warning" | "outline";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-transparent bg-[var(--surface-3)] text-[var(--text-secondary)]",
  accent: "border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent)]",
  positive: "border-[var(--positive-border)] bg-[var(--positive-muted)] text-[var(--positive)]",
  warning: "border-[var(--warning-border)] bg-[var(--warning-muted)] text-[var(--warning)]",
  outline: "border-[var(--border)] bg-transparent text-[var(--text-secondary)]",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-5 items-center rounded-[var(--radius-sm)] border px-1.5 text-[11px] font-medium leading-4",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
