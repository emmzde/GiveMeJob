import { cn } from "@/lib/utils";

/**
 * GiveMeJob mark: the app icon (Emmy on an OLED squircle), pre-rendered at exact
 * pixel sizes so it stays sharp on 1× displays and uses a 2× file on HiDPI.
 */
export function BrandMark({ className, size = 28 }: { className?: string; size?: 28 | 40 | 72 }) {
  const base = size <= 28 ? 28 : 80;
  const retina = size <= 28 ? 56 : 160;
  return (
    <img
      alt=""
      aria-hidden="true"
      className={cn("brand-symbol", className)}
      draggable={false}
      height={size}
      src={`/brand/mark-${base}.png`}
      srcSet={`/brand/mark-${base}.png 1x, /brand/mark-${retina}.png 2x`}
      width={size}
    />
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("brand-wordmark", className)}>
      GiveMe<span className="brand-wordmark-strong">Job!</span>
    </span>
  );
}
