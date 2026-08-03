import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import type { EmmyState } from "@/lib/emmy";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface EmmyMascotProps {
  className?: string;
  interactive?: boolean;
  state?: EmmyState;
  trackPointer?: boolean;
}

const PET_DURATION_MS = 1_200;

export function EmmyMascot({
  className,
  interactive = false,
  state = "offline",
  trackPointer = false,
}: EmmyMascotProps) {
  const mascotRef = useRef<SVGSVGElement>(null);
  const petTimerRef = useRef<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const [petted, setPetted] = useState(false);

  const resetGaze = useCallback(() => {
    mascotRef.current?.style.setProperty("--emmy-gaze-x", "0px");
    mascotRef.current?.style.setProperty("--emmy-gaze-y", "0px");
  }, []);

  useEffect(() => {
    if (!trackPointer) {
      resetGaze();
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function followPointer(event: globalThis.PointerEvent): void {
      const mascot = mascotRef.current;
      if (!mascot || reducedMotion.matches) return;

      const bounds = mascot.getBoundingClientRect();
      const deltaX = event.clientX - (bounds.left + bounds.width / 2);
      const deltaY = event.clientY - (bounds.top + bounds.height / 2);
      const gazeX = Math.max(-2.5, Math.min(2.5, deltaX / 56));
      const gazeY = Math.max(-1.75, Math.min(1.75, deltaY / 64));
      mascot.style.setProperty("--emmy-gaze-x", `${gazeX.toFixed(2)}px`);
      mascot.style.setProperty("--emmy-gaze-y", `${gazeY.toFixed(2)}px`);
    }

    function handleMotionPreference(): void {
      if (reducedMotion.matches) resetGaze();
    }

    window.addEventListener("pointermove", followPointer, { passive: true });
    reducedMotion.addEventListener("change", handleMotionPreference);
    return () => {
      window.removeEventListener("pointermove", followPointer);
      reducedMotion.removeEventListener("change", handleMotionPreference);
      resetGaze();
    };
  }, [resetGaze, trackPointer]);

  useEffect(
    () => () => {
      if (petTimerRef.current !== null) window.clearTimeout(petTimerRef.current);
    },
    [],
  );

  const petEmmy = useCallback(() => {
    if (!interactive) return;
    if (petTimerRef.current !== null) window.clearTimeout(petTimerRef.current);
    setPetted(true);
    petTimerRef.current = window.setTimeout(() => {
      setPetted(false);
      petTimerRef.current = null;
    }, PET_DURATION_MS);
  }, [interactive]);

  function handlePointerDown(event: PointerEvent<SVGSVGElement>): void {
    if (event.button !== 0) return;
    event.preventDefault();
    petEmmy();
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    petEmmy();
  }

  return (
    <svg
      aria-hidden={interactive ? undefined : "true"}
      aria-label={interactive ? t("petEmmy") : undefined}
      className={cn("emmy-mascot size-9", className)}
      data-hovered={hovered}
      data-interactive={interactive}
      data-petted={petted}
      data-state={state}
      focusable={interactive ? "true" : "false"}
      onKeyDown={interactive ? handleKeyDown : undefined}
      onPointerDown={interactive ? handlePointerDown : undefined}
      onPointerEnter={interactive ? () => setHovered(true) : undefined}
      onPointerLeave={interactive ? () => setHovered(false) : undefined}
      ref={mascotRef}
      role={interactive ? "button" : undefined}
      shapeRendering="crispEdges"
      tabIndex={interactive ? 0 : undefined}
      viewBox="0 0 96 96"
    >
      <g className="emmy-tail">
        <path
          d="M66 56h12v4h6v6h4v14h-4v6h-6v4H64V80h8v-4h4V66H66Z"
          fill="var(--emmy-outline)"
        />
        <path d="M68 60h9v4h5v5h3v9h-4v5h-9v-6h4V65h-8Z" fill="var(--emmy-fur-shadow)" />
        <path d="M77 64h5v5h3v7h-6v-5h-5v-5h3Z" fill="var(--emmy-cream)" />
      </g>

      <g className="emmy-body">
        <path d="M26 50h42v4h6v8h4v24h-6v6H24v-6h-6V64h4V56h4Z" fill="var(--emmy-outline)" />
        <path d="M28 54h38v4h5v8h3v17h-6v5H28v-5h-6V66h4v-8h2Z" fill="var(--emmy-fur)" />
        <path d="M38 54h20v8h4v23h-6v3H40v-3h-6V62h4Z" fill="var(--emmy-cream)" />
        <path d="M23 72h12v16H23Zm38 0h12v16H61Z" fill="var(--emmy-fur-shadow)" />
        <path d="M23 82h14v6H23Zm36 0h14v6H59Z" fill="var(--emmy-highlight)" />
        <path d="M27 86h3v4h-3Zm7 0h3v4h-3Zm25 0h3v4h-3Zm7 0h3v4h-3Z" fill="var(--emmy-outline)" />
      </g>

      <g className="emmy-head">
        <g className="emmy-ear emmy-ear-left">
          <path d="M20 30V14h6v-6h14v22Z" fill="var(--emmy-outline)" />
          <path d="M24 28V16h5v-4h7v18Z" fill="var(--emmy-fur-shadow)" />
          <path d="M27 22v-5h5v9Z" fill="var(--emmy-ear)" />
        </g>
        <g className="emmy-ear emmy-ear-right">
          <path d="M56 30V8h14v6h6v16Z" fill="var(--emmy-outline)" />
          <path d="M60 30V12h7v4h5v12Z" fill="var(--emmy-fur-shadow)" />
          <path d="M64 26v-9h5v5Z" fill="var(--emmy-ear)" />
        </g>

        <path d="M26 18h40v4h8v8h4v24h-4v8h-8v4H26v-4h-8v-8h-4V30h4v-8h8Z" fill="var(--emmy-outline)" />
        <path d="M28 22h36v4h7v7h3v18h-4v7h-7v4H29v-4h-7v-7h-4V33h4v-7h6Z" fill="var(--emmy-fur)" />
        <path d="M26 22h12v4h10v-4h16v4h7v7h3v6H62v-4H34v4H18v-6h4v-7h4Z" fill="var(--emmy-highlight)" opacity=".34" />
        <path d="M22 44h12v4h28v-4h8v14h-7v4H29v-4h-7Z" fill="var(--emmy-cream)" />
        <path d="M34 42h28v18H34Z" fill="var(--emmy-cream)" />

        <g className="emmy-eyes">
          <path d="M27 34h14v12H27Zm28 0h14v12H55Z" fill="var(--emmy-outline)" />
          <path d="M30 37h8v6h-8Zm28 0h8v6h-8Z" fill="var(--emmy-highlight)" />
          <g className="emmy-pupils" fill="var(--emmy-eye)">
            <path d="M33 38h5v5h-5Zm28 0h5v5h-5Z" />
          </g>
        </g>
        <g className="emmy-closed-eyes" fill="var(--emmy-eye)">
          <path d="M28 39h3v3h3v2h-6Zm8 0h3v5h-6v-2h3Zm20 0h3v3h3v2h-6Zm8 0h3v5h-6v-2h3Z" />
        </g>
        <g className="emmy-bliss-eyes" fill="var(--emmy-eye)">
          <path d="M27 40h3v-3h3v-2h3v2h3v3h3v3h-4v-3h-3v-2h-2v2h-3v3h-3Zm28 0h3v-3h3v-2h3v2h3v3h3v3h-4v-3h-3v-2h-2v2h-3v3h-3Z" />
        </g>

        <g className="emmy-face-normal">
          <path d="M43 48h10v4h-3v3h-4v-3h-3Z" fill="var(--emmy-nose)" />
          <path d="M38 55h8v3h4v-3h8v3h-5v4H43v-4h-5Z" fill="var(--emmy-outline)" />
          <path d="M42 55h4v2h4v-2h4v3h-4v2h-4v-2h-4Z" fill="var(--emmy-highlight)" />
        </g>
        <g className="emmy-face-bliss">
          <path d="M43 47h10v4h-3v3h-4v-3h-3Z" fill="var(--emmy-nose)" />
          <path d="M39 54h18v6h-4v4H43v-4h-4Z" fill="var(--emmy-outline)" />
          <path d="M44 58h8v6h-8Z" fill="var(--emmy-tongue)" />
        </g>
        <g className="emmy-blush" fill="var(--emmy-blush)">
          <path d="M23 49h8v4h-8Zm42 0h8v4h-8Z" />
        </g>
      </g>

      <g className="emmy-thinking-marks" fill="var(--text-tertiary)">
        <rect height="4" width="4" x="72" y="15" />
        <rect height="5" width="5" x="79" y="9" />
        <rect height="6" width="6" x="87" y="4" />
      </g>
      <g className="emmy-search-marks" fill="var(--emmy-accent)">
        <path d="M77 45h7v2h4v3h-4v-1h-7Zm1 8h6v2h4v3h-4v-1h-6Z" />
      </g>
      <path className="emmy-empty-mark" d="M79 5h10v3h4v10h-4v4h-4v5h-4v-8h4v-4h3v-6h-7v4h-5V9h3Zm2 27h5v5h-5Z" fill="var(--text-tertiary)" />
      <g className="emmy-success-marks" fill="var(--positive)">
        <path d="M10 10h4v6h6v4h-6v6h-4v-6H4v-4h6Zm72 14h3v4h4v3h-4v4h-3v-4h-4v-3h4Z" />
      </g>
      <g className="emmy-sleep-marks" fill="var(--text-tertiary)">
        <path d="M74 12h10v4l-5 6h5v4H73v-4l6-6h-5Zm10-9h8v3l-4 4h4v3h-9v-3l4-4h-3Z" />
      </g>
      <g className="emmy-pet-hearts" fill="var(--emmy-blush)">
        <path d="M12 17h4v-3h5v3h4v6h-3v3h-4v4h-4v-4h-3v-3H8v-6Zm65-6h3V8h4v3h3v5h-3v3h-2v3h-3v-3h-2v-3h-2v-5Z" />
      </g>
    </svg>
  );
}
