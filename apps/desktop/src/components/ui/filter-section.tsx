import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { t } from "@/lib/i18n";

interface FilterSectionProps {
  activeCount?: number;
  children: ReactNode;
  defaultOpen?: boolean;
  description?: string;
  title: string;
}

export function FilterSection({
  activeCount = 0,
  children,
  defaultOpen = false,
  description,
  title,
}: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen || activeCount > 0);
  return (
    <details
      className="group border-b border-[var(--border)] pb-2"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      open={isOpen}
    >
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-[var(--radius-sm)] px-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]">
        <span>{title}</span>
        {activeCount > 0 ? (
          <span
            aria-label={`${tallyLabel(activeCount)}: ${title}`}
            className="ml-auto min-w-5 rounded-full bg-[var(--accent-muted)] px-1.5 py-0.5 text-center text-[10px] font-semibold text-[var(--accent)]"
          >
            {activeCount}
          </span>
        ) : (
          <span className="ml-auto" />
        )}
        <ChevronDown
          aria-hidden="true"
          className="size-4 text-[var(--text-secondary)] transition-transform group-open:rotate-180"
        />
      </summary>
      <fieldset className="min-w-0 border-0 px-1 pb-1 pt-1">
        <legend className="sr-only">{title}</legend>
        {description ? (
          <p className="mb-2 text-xs leading-4 text-[var(--text-secondary)]">
            {description}
          </p>
        ) : null}
        {children}
      </fieldset>
    </details>
  );
}

function tallyLabel(count: number): string {
  return t(count === 1 ? "selectedOne" : "selectedMany");
}
