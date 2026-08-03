import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmmyMascot } from "@/features/emmy/EmmyMascot";
import { t } from "@/lib/i18n";

describe("EmmyMascot", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("follows the pointer only when tracking is enabled", () => {
    render(<EmmyMascot state="idle" trackPointer />);
    const mascot = document.querySelector(".emmy-mascot");
    expect(mascot).toBeInstanceOf(SVGSVGElement);
    if (!(mascot instanceof SVGSVGElement)) throw new Error("Expected Emmy SVG");

    vi.spyOn(mascot, "getBoundingClientRect").mockReturnValue({
      bottom: 96,
      height: 96,
      left: 0,
      right: 96,
      toJSON: () => ({}),
      top: 0,
      width: 96,
      x: 0,
      y: 0,
    });

    fireEvent.pointerMove(window, { clientX: 192, clientY: 0 });
    expect(mascot.style.getPropertyValue("--emmy-gaze-x")).toBe("2.50px");
    expect(mascot.style.getPropertyValue("--emmy-gaze-y")).toBe("-0.75px");
  });

  it("shows a bliss reaction when petted with the mouse or keyboard", () => {
    vi.useFakeTimers();
    render(<EmmyMascot interactive state="idle" />);
    const mascot = screen.getByRole("button", { name: t("petEmmy") });

    fireEvent.pointerEnter(mascot);
    expect(mascot).toHaveAttribute("data-hovered", "true");
    fireEvent.pointerDown(mascot, { button: 0 });
    expect(mascot).toHaveAttribute("data-petted", "true");

    act(() => vi.advanceTimersByTime(1_200));
    expect(mascot).toHaveAttribute("data-petted", "false");

    fireEvent.keyDown(mascot, { key: "Enter" });
    expect(mascot).toHaveAttribute("data-petted", "true");
    fireEvent.pointerLeave(mascot);
    expect(mascot).toHaveAttribute("data-hovered", "false");
  });

  it("stays decorative when interaction is disabled", () => {
    render(<EmmyMascot state="offline" />);
    const mascot = document.querySelector(".emmy-mascot");
    expect(mascot).toHaveAttribute("aria-hidden", "true");
    expect(mascot).not.toHaveAttribute("role");
    expect(mascot).not.toHaveAttribute("tabindex");
  });
});
