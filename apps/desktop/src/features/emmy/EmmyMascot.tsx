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

interface Heart {
  id: number;
  x: number;
  y: number;
  drift: number;
}

const PET_DURATION_MS = 1_200;
const HEART_LIFETIME_MS = 1_300;
const MAX_HEARTS = 8;
// Distance the pointer has to travel over Emmy to count as one stroke.
const STROKE_PRESSED_PX = 48;
const STROKE_HOVER_PX = 150;
const ASSET_ROOT = "/brand/emmy";

let heartSeed = 0;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function EmmyMascot({
  className,
  interactive = false,
  state = "offline",
  trackPointer = false,
}: EmmyMascotProps) {
  const mascotRef = useRef<HTMLDivElement>(null);
  const petTimerRef = useRef<number | null>(null);
  const strokeRef = useRef<{ x: number; y: number; travelled: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [petted, setPetted] = useState(false);
  const [blinking, setBlinking] = useState(false);
  const [hearts, setHearts] = useState<Heart[]>([]);

  const resetGaze = useCallback(() => {
    mascotRef.current?.style.setProperty("--emmy-gaze-x", "0");
    mascotRef.current?.style.setProperty("--emmy-gaze-y", "0");
  }, []);

  useEffect(() => {
    if (!trackPointer) {
      resetGaze();
      return;
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function followPointer(event: globalThis.PointerEvent): void {
      const mascot = mascotRef.current;
      if (!mascot) return;
      if (reducedMotion.matches) {
        resetGaze();
        return;
      }
      const bounds = mascot.getBoundingClientRect();
      const deltaX = event.clientX - (bounds.left + bounds.width / 2);
      const deltaY = event.clientY - (bounds.top + bounds.height / 2);
      const reach = Math.max(bounds.width, 120) * 1.6;
      const gazeX = Math.max(-1, Math.min(1, deltaX / reach));
      const gazeY = Math.max(-1, Math.min(1, deltaY / reach));
      mascot.style.setProperty("--emmy-gaze-x", gazeX.toFixed(2));
      mascot.style.setProperty("--emmy-gaze-y", gazeY.toFixed(2));
    }

    window.addEventListener("pointermove", followPointer, { passive: true });
    return () => {
      window.removeEventListener("pointermove", followPointer);
      resetGaze();
    };
  }, [resetGaze, trackPointer]);

  // Natural, irregular blinking while awake.
  useEffect(() => {
    if (state === "offline" || prefersReducedMotion()) return;
    let openTimer: number | null = null;
    let nextTimer: number | null = null;
    function schedule(): void {
      nextTimer = window.setTimeout(() => {
        setBlinking(true);
        openTimer = window.setTimeout(() => {
          setBlinking(false);
          schedule();
        }, 140);
      }, 2_400 + Math.random() * 3_600);
    }
    schedule();
    return () => {
      if (openTimer !== null) window.clearTimeout(openTimer);
      if (nextTimer !== null) window.clearTimeout(nextTimer);
      setBlinking(false);
    };
  }, [state]);

  useEffect(
    () => () => {
      if (petTimerRef.current !== null) window.clearTimeout(petTimerRef.current);
    },
    [],
  );

  const spawnHeart = useCallback((x: number, y: number) => {
    if (prefersReducedMotion()) return;
    const heart: Heart = { id: ++heartSeed, x, y, drift: (Math.random() - 0.5) * 2 };
    setHearts((current) => [...current.slice(-(MAX_HEARTS - 1)), heart]);
    window.setTimeout(() => {
      setHearts((current) => current.filter((item) => item.id !== heart.id));
    }, HEART_LIFETIME_MS);
  }, []);

  const petEmmy = useCallback(
    (x = 50, y = 30) => {
      if (!interactive) return;
      if (petTimerRef.current !== null) window.clearTimeout(petTimerRef.current);
      setPetted(true);
      spawnHeart(x, y);
      petTimerRef.current = window.setTimeout(() => {
        setPetted(false);
        petTimerRef.current = null;
      }, PET_DURATION_MS);
    },
    [interactive, spawnHeart],
  );

  function relativePoint(event: PointerEvent<HTMLDivElement>): { x: number; y: number } {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return { x: 50, y: 30 };
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return;
    event.preventDefault();
    const point = relativePoint(event);
    strokeRef.current = { x: event.clientX, y: event.clientY, travelled: 0 };
    petEmmy(point.x, point.y);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    const previous = strokeRef.current;
    strokeRef.current = {
      x: event.clientX,
      y: event.clientY,
      travelled: (previous?.travelled ?? 0) + (previous ? Math.hypot(event.clientX - previous.x, event.clientY - previous.y) : 0),
    };
    const threshold = event.buttons === 1 ? STROKE_PRESSED_PX : STROKE_HOVER_PX;
    if (strokeRef.current.travelled >= threshold) {
      strokeRef.current.travelled = 0;
      const point = relativePoint(event);
      petEmmy(point.x, point.y);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    petEmmy(50, 24);
  }

  const eyes =
    petted || state === "success"
      ? "happy"
      : state === "offline" || blinking
        ? "closed"
        : "open";

  return (
    <div
      aria-hidden={interactive ? undefined : "true"}
      aria-label={interactive ? t("petEmmy") : undefined}
      className={cn("emmy-mascot size-9", className)}
      data-eyes={eyes}
      data-hovered={hovered}
      data-interactive={interactive}
      data-petted={petted}
      data-state={state}
      onKeyDown={interactive ? handleKeyDown : undefined}
      onPointerDown={interactive ? handlePointerDown : undefined}
      onPointerEnter={interactive ? () => setHovered(true) : undefined}
      onPointerLeave={
        interactive
          ? () => {
              setHovered(false);
              strokeRef.current = null;
            }
          : undefined
      }
      onPointerMove={interactive ? handlePointerMove : undefined}
      ref={mascotRef}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <span className="emmy-rig">
        <img alt="" className="emmy-layer emmy-tail" draggable={false} src={`${ASSET_ROOT}/tail.webp`} />
        <img alt="" className="emmy-layer emmy-body" draggable={false} src={`${ASSET_ROOT}/body.webp`} />
        <span className="emmy-layer emmy-head-gaze">
          <span className="emmy-layer emmy-head">
            <img alt="" className="emmy-layer emmy-face" data-face="open" draggable={false} src={`${ASSET_ROOT}/head.webp`} />
            <img alt="" className="emmy-layer emmy-face" data-face="closed" draggable={false} src={`${ASSET_ROOT}/head-closed.webp`} />
            <img alt="" className="emmy-layer emmy-face" data-face="happy" draggable={false} src={`${ASSET_ROOT}/head-happy.webp`} />
          </span>
        </span>
      </span>

      <span className="emmy-fx emmy-fx-thinking">
        <i />
        <i />
        <i />
      </span>
      <span className="emmy-fx emmy-fx-sleep">
        <i>z</i>
        <i>z</i>
      </span>
      <span className="emmy-fx emmy-fx-question">?</span>
      <span className="emmy-fx emmy-fx-sparkles">
        <i />
        <i />
        <i />
      </span>
      {hearts.map((heart) => (
        <span
          className="emmy-heart"
          key={heart.id}
          style={{ left: `${heart.x}%`, top: `${heart.y}%`, "--heart-drift": heart.drift } as React.CSSProperties}
        >
          <svg viewBox="0 0 24 24">
            <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.1 5.4 3.1 1.8-2 3.3-3.1 5.4-3.1 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21Z" />
          </svg>
        </span>
      ))}
    </div>
  );
}
