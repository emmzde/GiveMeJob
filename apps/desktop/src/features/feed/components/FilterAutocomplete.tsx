import { useVirtualizer } from "@tanstack/react-virtual";
import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { formatCount } from "@/features/feed/jobPresentation";
import { t } from "@/lib/i18n";

const VIRTUALIZATION_THRESHOLD = 50;
const SUGGESTION_HEIGHT = 44;

export interface FilterSuggestion {
  count: number;
  label: string;
  secondaryLabel?: string;
  value: string;
}

interface FilterAutocompleteProps {
  disabled?: boolean;
  isLoading: boolean;
  label: string;
  onQueryChange(query: string): void;
  onSelect(suggestion: FilterSuggestion): void;
  placeholder: string;
  query: string;
  suggestions: readonly FilterSuggestion[];
}

function SuggestionContent({ suggestion }: { suggestion: FilterSuggestion }) {
  return (
    <>
      <span className="min-w-0 truncate">{suggestion.label}</span>
      <span className="ml-auto shrink-0 text-[10px] text-[var(--text-secondary)]">
        {suggestion.secondaryLabel ? `${suggestion.secondaryLabel} · ` : ""}
        {formatCount(suggestion.count)}
      </span>
    </>
  );
}

interface SuggestionListProps {
  activeIndex: number;
  id: string;
  onSelect(suggestion: FilterSuggestion): void;
  suggestions: readonly FilterSuggestion[];
}

export function SuggestionList({
  activeIndex,
  id,
  onSelect,
  suggestions,
}: SuggestionListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // TanStack Virtual intentionally exposes mutable measurement methods.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: suggestions.length,
    estimateSize: () => SUGGESTION_HEIGHT,
    getScrollElement: () => scrollRef.current,
    initialRect: { height: 220, width: 260 },
    overscan: 3,
  });

  useEffect(() => {
    if (suggestions.length > VIRTUALIZATION_THRESHOLD && activeIndex >= 0) {
      virtualizer.scrollToIndex(activeIndex, { align: "auto" });
    }
  }, [activeIndex, suggestions.length, virtualizer]);

  function renderOption(suggestion: FilterSuggestion, index: number) {
    return (
      <button
        aria-selected={activeIndex === index}
        className={`flex h-11 w-full items-center gap-2 px-2 text-left text-xs hover:bg-[var(--bg-hover)] ${
          activeIndex === index ? "bg-[var(--bg-active)]" : ""
        }`}
        id={`${id}-option-${index}`}
        key={suggestion.value}
        onClick={() => onSelect(suggestion)}
        onMouseDown={(event) => event.preventDefault()}
        role="option"
        tabIndex={-1}
        type="button"
      >
        <SuggestionContent suggestion={suggestion} />
      </button>
    );
  }

  if (suggestions.length <= VIRTUALIZATION_THRESHOLD) {
    return (
      <div className="max-h-56 overflow-y-auto py-1" id={id} role="listbox">
        {suggestions.map(renderOption)}
      </div>
    );
  }

  return (
    <div
      className="max-h-56 overflow-y-auto py-1"
      data-virtualized="true"
      id={id}
      ref={scrollRef}
      role="listbox"
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const suggestion = suggestions[row.index];
          if (!suggestion) return null;
          return (
            <div
              className="absolute left-0 top-0 w-full"
              key={row.key}
              style={{ height: row.size, transform: `translateY(${row.start}px)` }}
            >
              {renderOption(suggestion, row.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FilterAutocomplete({
  disabled = false,
  isLoading,
  label,
  onQueryChange,
  onSelect,
  placeholder,
  query,
  suggestions,
}: FilterAutocompleteProps) {
  const inputId = useId();
  const listboxId = `${inputId}-suggestions`;
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const trimmedQuery = query.trim();
  const showPopup = isOpen;
  const boundedActiveIndex = activeIndex < suggestions.length ? activeIndex : -1;

  function select(suggestion: FilterSuggestion): void {
    onSelect(suggestion);
    setActiveIndex(-1);
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, suggestions.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Home" && suggestions.length > 0) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End" && suggestions.length > 0) {
      event.preventDefault();
      setActiveIndex(suggestions.length - 1);
      return;
    }
    if (event.key === "Enter" && boundedActiveIndex >= 0) {
      const suggestion = suggestions[boundedActiveIndex];
      if (!suggestion) return;
      event.preventDefault();
      select(suggestion);
    }
  }

  return (
    <div className="relative">
      <label className="flex min-h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-raised)] px-2">
        <Search aria-hidden="true" className="size-4 shrink-0 text-[var(--text-secondary)]" />
        <span className="sr-only">{label}</span>
        <input
          aria-activedescendant={
            showPopup && boundedActiveIndex >= 0
              ? `${listboxId}-option-${boundedActiveIndex}`
              : undefined
          }
          aria-autocomplete="list"
          aria-controls={showPopup ? listboxId : undefined}
          aria-expanded={showPopup}
          className="h-9 min-w-0 flex-1 bg-transparent text-xs placeholder:text-[var(--text-placeholder)]"
          disabled={disabled}
          maxLength={100}
          onBlur={() => setIsOpen(false)}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setActiveIndex(-1);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          value={query}
        />
      </label>
      {showPopup ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-raised)] shadow-[var(--shadow-md)]">
          {isLoading ? (
            <p className="px-2 py-2 text-xs text-[var(--text-secondary)]" role="status">
              {t("suggestionsLoading")}
            </p>
          ) : suggestions.length === 0 ? (
            <p className="px-2 py-2 text-xs text-[var(--text-secondary)]" role="status">
              {t("suggestionsEmpty")}
            </p>
          ) : (
            <>
              {trimmedQuery.length === 0 ? (
                <p className="border-b border-[var(--border)] px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                  {t("popularSuggestions")}
                </p>
              ) : null}
              <SuggestionList
                activeIndex={boundedActiveIndex}
                id={listboxId}
                onSelect={select}
                suggestions={suggestions}
              />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
