import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it.each(["default", "ghost", "outline"] as const)(
    "keeps a two-pixel focus ring for the %s variant",
    (variant) => {
      render(<Button variant={variant}>{variant}</Button>);

      const button = screen.getByRole("button", { name: variant });
      expect(button).toHaveClass("focus-visible:outline-2");
      expect(button).toHaveClass("focus-visible:outline-[var(--focus)]");
      expect(button).not.toHaveClass("focus-visible:outline-none");
    },
  );
});
