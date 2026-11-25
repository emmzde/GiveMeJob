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
    expect(mascot).toBeInstanceOf(HTMLElement);
    if (!(mascot instanceof HTMLElement)) throw new Error("Expected Emmy element");

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

    fireEvent.pointerMove(window, { clientX: 1_000, clientY: 0 });
    expect(mascot.style.getPropertyValue("--emmy-gaze-x")).toBe("1.00");
    expect(mascot.style.getPropertyValue("--emmy-gaze-y")).toBe("-0.25");
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
    expect(mascot).toHaveAttribute("data-eyes", "happy");
    fireEvent.pointerLeave(mascot);
    expect(mascot).toHaveAttribute("data-hovered", "false");
  });

  it("counts a pressed stroke across Emmy as petting", () => {
    vi.useFakeTimers();
    render(<EmmyMascot interactive state="idle" />);
    const mascot = screen.getByRole("button", { name: t("petEmmy") });

    fireEvent.pointerMove(mascot, { buttons: 1, clientX: 0, clientY: 10 });
    expect(mascot).toHaveAttribute("data-petted", "false");
    fireEvent.pointerMove(mascot, { buttons: 1, clientX: 60, clientY: 10 });
    expect(mascot).toHaveAttribute("data-petted", "true");
  });

  it("sleeps with closed eyes while offline", () => {
    render(<EmmyMascot state="offline" />);
    expect(document.querySelector(".emmy-mascot")).toHaveAttribute("data-eyes", "closed");
  });

  it("stays decorative when interaction is disabled", () => {
    render(<EmmyMascot state="offline" />);
    const mascot = document.querySelector(".emmy-mascot");
    expect(mascot).toHaveAttribute("aria-hidden", "true");
    expect(mascot).not.toHaveAttribute("role");
    expect(mascot).not.toHaveAttribute("tabindex");
  });
});
