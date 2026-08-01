import { Lock, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmmyMascot } from "@/features/emmy/EmmyMascot";
import { t } from "@/lib/i18n";

export function EmmyPanel({ onClose }: { onClose(): void }) {
  return (
    <aside
      aria-label={t("emmyPanelLabel")}
      className="flex h-full min-w-0 flex-col border-l border-[var(--border)] bg-[var(--surface-0)]"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--border)] px-3">
        <EmmyMascot className="size-7" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-xs font-semibold">Emmy</p>
          <p className="text-[10px] text-[var(--text-tertiary)]">{t("aiOffline")}</p>
        </div>
        <Button
          aria-label={t("closeEmmy")}
          className="size-7 px-0"
          onClick={onClose}
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="grid size-16 place-items-center rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)]">
          <EmmyMascot className="size-12" />
        </div>
        <h2 className="mt-4 text-sm font-semibold">{t("emmyOfflineTitle")}</h2>
        <p className="mt-2 max-w-72 text-xs leading-5 text-[var(--text-secondary)]">
          {t("emmyOfflineDescription")}
        </p>
      </div>

      <div className="border-t border-[var(--border)] p-2.5">
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-2.5 opacity-70">
          <label className="sr-only" htmlFor="emmy-composer">{t("emmyUnavailable")}</label>
          <textarea
            className="block h-12 w-full resize-none bg-transparent text-xs text-[var(--text-disabled)] outline-none"
            disabled
            id="emmy-composer"
            placeholder={t("emmyInputPlaceholder")}
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
              <Lock aria-hidden="true" className="size-3" />
              {t("emmyUnavailable")}
            </span>
            <button
              aria-label={t("emmyUnavailable")}
              className="grid size-6 place-items-center rounded-[var(--radius-sm)] bg-[var(--surface-3)] text-[var(--text-disabled)]"
              disabled
              type="button"
            >
              <Send aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
