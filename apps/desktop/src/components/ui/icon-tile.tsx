import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type IconTileTone = "violet" | "blue" | "cyan" | "gold" | "green" | "pink" | "graphite";

const glyphSize = { sm: 16, md: 18, lg: 26 } as const;

/**
 * System-style icon tile: a clean vertical gradient squircle with a white glyph.
 * Glyph sizes and stroke widths are picked so strokes land on whole pixels at 1×.
 */
export function IconTile({
  className,
  icon: Icon,
  size = "md",
  tone,
}: {
  className?: string;
  icon: LucideIcon;
  size?: keyof typeof glyphSize;
  tone: IconTileTone;
}) {
  return (
    <span aria-hidden="true" className={cn("icon-tile", className)} data-size={size} data-tone={tone}>
      <Icon absoluteStrokeWidth size={glyphSize[size]} strokeWidth={size === "lg" ? 2 : 1.75} />
    </span>
  );
}
