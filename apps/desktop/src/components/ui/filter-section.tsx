import type { ReactNode } from "react";

interface FilterSectionProps {
  children: ReactNode;
  description?: string;
  title: string;
}

export function FilterSection({ children, description, title }: FilterSectionProps) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="px-0 text-xs font-medium text-[var(--text)]">{title}</legend>
      {description ? (
        <p className="mt-1 text-[11px] leading-4 text-[var(--text-tertiary)]">
          {description}
        </p>
      ) : null}
      <div className="mt-2">{children}</div>
    </fieldset>
  );
}
