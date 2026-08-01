import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-4 min-w-4 items-center justify-center rounded-[4px] border border-[var(--border-strong)] bg-[var(--surface-2)] px-1 font-mono text-[9px] leading-none text-[var(--text-tertiary)]",
        className,
      )}
      {...props}
    />
  );
}
