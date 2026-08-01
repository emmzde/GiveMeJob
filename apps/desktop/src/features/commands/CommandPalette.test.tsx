import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetAppUiStore } from "@/app/store/appUiStore";
import { CommandPalette } from "@/features/commands/CommandPalette";
import { t } from "@/lib/i18n";

function PaletteHarness({
  onFocusSearch = () => undefined,
  onToggleFilters = () => undefined,
}: {
  onFocusSearch?(): void;
  onToggleFilters?(): void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button onClick={() => setOpen(true)} ref={triggerRef} type="button">
        {t("openCommandPalette")}
      </button>
      <input aria-label="Редактор" />
      <CommandPalette
        filtersVisible={false}
        onFocusSearch={onFocusSearch}
        onOpenChange={setOpen}
        onToggleFilters={onToggleFilters}
        open={open}
        returnFocusRef={triggerRef}
      />
    </>
  );
}

describe("CommandPalette", () => {
  beforeEach(resetAppUiStore);

  it("opens with Ctrl+K and lists only implemented M2 actions", async () => {
    render(<PaletteHarness />);

    fireEvent.keyDown(window, { ctrlKey: true, key: "k" });

    const dialog = await screen.findByRole("dialog", { name: t("commandPalette") });
    expect(within(dialog).getByText(t("focusSearch"))).toBeInTheDocument();
    expect(within(dialog).getByText(t("showFilters"))).toBeInTheDocument();
    expect(within(dialog).getByText(t("themeSystem"))).toBeInTheDocument();
    expect(within(dialog).getByText(t("themeLight"))).toBeInTheDocument();
    expect(within(dialog).getByText(t("themeDark"))).toBeInTheDocument();
    expect(within(dialog).queryByText(t("shortlist"))).not.toBeInTheDocument();
    expect(within(dialog).queryByText(t("emmy"))).not.toBeInTheDocument();
  });

  it("ignores Ctrl+K while an editable control owns the event", () => {
    render(<PaletteHarness />);
    const editor = screen.getByRole("textbox", { name: "Редактор" });

    fireEvent.keyDown(editor, { ctrlKey: true, key: "k" });

    expect(screen.queryByRole("dialog", { name: t("commandPalette") })).not.toBeInTheDocument();
  });

  it("runs real actions and restores focus after Escape", async () => {
    const onFocusSearch = vi.fn();
    render(<PaletteHarness onFocusSearch={onFocusSearch} />);
    const trigger = screen.getByRole("button", { name: t("openCommandPalette") });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: t("commandPalette") });
    await waitFor(() =>
      expect(within(dialog).getByRole("combobox", { name: t("commandPalette") })).toHaveFocus(),
    );
    fireEvent.keyDown(document.activeElement ?? dialog, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: t("commandPalette") })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());

    fireEvent.click(trigger);
    const reopened = await screen.findByRole("dialog", { name: t("commandPalette") });
    fireEvent.click(within(reopened).getByText(t("focusSearch")));
    await waitFor(() => expect(onFocusSearch).toHaveBeenCalledTimes(1));
  });
});
