import { cn } from "@/lib/utils";

export function EmmyMascot({ className }: { className?: string }) {
  return (
    <svg
      aria-label="Emmy"
      className={cn("size-9", className)}
      role="img"
      viewBox="0 0 64 64"
    >
      <path d="M13 27c-5-11 0-19 7-15l8 7" fill="var(--emmy-ear)" stroke="var(--emmy-outline)" strokeWidth="2" />
      <path d="M51 27c5-11 0-19-7-15l-8 7" fill="var(--emmy-ear)" stroke="var(--emmy-outline)" strokeWidth="2" />
      <path d="M14 32c0-14 8-22 18-22s18 8 18 22v7c0 11-8 18-18 18s-18-7-18-18z" fill="var(--emmy-fur)" stroke="var(--emmy-outline)" strokeWidth="2" />
      <path d="M18 25c2-7 7-11 14-11s12 4 14 11c-8-4-20-4-28 0Z" fill="var(--emmy-fur-shadow)" opacity=".7" />
      <path d="M24 35h6M34 35h6" fill="none" stroke="var(--emmy-eye)" strokeLinecap="round" strokeWidth="2" />
      <path d="M29 42c1.5-2 4.5-2 6 0-1 3-5 3-6 0Z" fill="var(--emmy-nose)" />
      <path d="M32 45v2M27 48c3 3 7 3 10 0" fill="none" stroke="var(--emmy-outline)" strokeLinecap="round" strokeWidth="1.7" />
      <path d="M20 52c7 4 17 4 24 0" fill="none" stroke="var(--emmy-collar)" strokeLinecap="round" strokeWidth="3" />
      <g className="emmy-sleep-marks" fill="var(--text-tertiary)">
        <path d="M47 7h7l-7 7h7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        <path d="M54 1h5l-5 5h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
