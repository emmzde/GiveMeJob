import { ArrowUpRight } from "lucide-react";

/**
 * Inverted-corner notch with a round arrow button, cut into the top-right of a `.notch-card`.
 * Purely decorative: the whole card is the interactive element.
 */
export function CornerArrow() {
  return (
    <span aria-hidden="true" className="notch-corner">
      <span className="notch-corner-button">
        <ArrowUpRight className="size-4" />
      </span>
    </span>
  );
}
