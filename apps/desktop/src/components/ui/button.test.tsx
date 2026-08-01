import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it.each(["default", "accent", "ghost", "outline"] as const)(
    "keeps a two-pixel focus ring for the %s variant",
    (variant) => {
      render(<Button variant={variant}>{variant}</Button>);

      const button = screen.getByRole("button", { name: variant });
      expect(button).toHaveClass("focus-visible:outline-2");
      expect(button).toHaveClass("focus-visible:outline-[var(--focus)]");
      expect(button).not.toHaveClass("focus-visible:outline-none");
    },
  );

  it("forwards its button ref for dialog focus restoration", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Trigger</Button>);

    expect(ref.current).toBe(screen.getByRole("button", { name: "Trigger" }));
  });
});
