import type { EmmyState } from "@/lib/emmy";
import { cn } from "@/lib/utils";

export function EmmyMascot({
  className,
  state = "offline",
}: {
  className?: string;
  state?: EmmyState;
}) {
  return (
    <svg
      aria-hidden="true"
      className={cn("emmy-mascot size-9", className)}
      data-state={state}
      focusable="false"
      viewBox="0 0 96 96"
    >
      <g className="emmy-tail" fill="none" stroke="var(--emmy-outline)" strokeLinecap="round" strokeWidth="5">
        <path d="M74 66c12 2 15-8 9-14" />
      </g>
      <path
        className="emmy-body"
        d="M26 58c0-12 9-20 22-20s22 8 22 20v15c0 9-7 15-16 15H42c-9 0-16-6-16-15Z"
        fill="var(--emmy-fur)"
        stroke="var(--emmy-outline)"
        strokeWidth="3"
      />
      <path d="M34 84v7M62 84v7" stroke="var(--emmy-outline)" strokeLinecap="round" strokeWidth="5" />
      <g className="emmy-head">
        <g className="emmy-ear emmy-ear-left">
          <path d="M30 28C20 10 9 15 14 35l13 8" fill="var(--emmy-ear)" stroke="var(--emmy-outline)" strokeWidth="3" />
        </g>
        <g className="emmy-ear emmy-ear-right">
          <path d="M66 28c10-18 21-13 16 7l-13 8" fill="var(--emmy-ear)" stroke="var(--emmy-outline)" strokeWidth="3" />
        </g>
        <path
          d="M23 40c0-18 10-29 25-29s25 11 25 29v11c0 15-11 25-25 25S23 66 23 51Z"
          fill="var(--emmy-fur)"
          stroke="var(--emmy-outline)"
          strokeWidth="3"
        />
        <path d="M29 31c4-10 10-15 19-15s15 5 19 15c-10-5-28-5-38 0Z" fill="var(--emmy-fur-shadow)" opacity=".58" />
        <g className="emmy-eyes" fill="var(--emmy-eye)">
          <ellipse className="emmy-eye-left" cx="38" cy="43" rx="2.5" ry="3.5" />
          <ellipse className="emmy-eye-right" cx="58" cy="43" rx="2.5" ry="3.5" />
        </g>
        <path className="emmy-closed-eyes" d="M34 43h8m12 0h8" fill="none" stroke="var(--emmy-eye)" strokeLinecap="round" strokeWidth="3" />
        <path d="M40 55c2-4 14-4 16 0-2 6-14 6-16 0Z" fill="var(--emmy-nose)" />
        <path d="M48 60v3m-8 0c5 5 11 5 16 0" fill="none" stroke="var(--emmy-outline)" strokeLinecap="round" strokeWidth="2.5" />
        <path d="M33 70c9 5 21 5 30 0" fill="none" stroke="var(--emmy-collar)" strokeLinecap="round" strokeWidth="4" />
      </g>

      <g className="emmy-thinking-marks" fill="var(--text-tertiary)">
        <circle cx="72" cy="16" r="2" />
        <circle cx="80" cy="11" r="2.5" />
        <circle cx="89" cy="8" r="3" />
      </g>
      <g className="emmy-search-marks" fill="none" stroke="var(--emmy-collar)" strokeLinecap="round" strokeWidth="2.5">
        <path d="M76 48c5-3 8-2 10 0" />
        <path d="M77 55c4-2 7-1 9 1" />
      </g>
      <path className="emmy-empty-mark" d="M78 11c0-5 4-8 9-8s8 3 8 7c0 7-8 6-8 12m0 7h.1" fill="none" stroke="var(--text-tertiary)" strokeLinecap="round" strokeWidth="3" />
      <g className="emmy-success-marks" fill="none" stroke="var(--positive)" strokeLinecap="round" strokeWidth="2.5">
        <path d="m12 13 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />
        <path d="m82 27 1.5 3.5L87 32l-3.5 1.5L82 37l-1.5-3.5L77 32l3.5-1.5Z" />
      </g>
      <g className="emmy-sleep-marks" fill="none" stroke="var(--text-tertiary)" strokeLinecap="round" strokeLinejoin="round">
        <path d="M72 18h10l-10 10h10" strokeWidth="3" />
        <path d="M82 7h7l-7 7h7" strokeWidth="2" />
      </g>
    </svg>
  );
}
