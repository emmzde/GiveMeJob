import { Check, CircleAlert, Database } from "lucide-react";

import { Kbd } from "@/components/ui/kbd";
import { isCatalogError, isCatalogReady } from "@/features/catalog/catalogStatus";
import type { CatalogViewState } from "@/features/catalog/catalogStatus";
import { formatCount } from "@/features/feed/jobPresentation";
import { t } from "@/lib/i18n";

function Hint({ keys, label }: { keys: readonly string[]; label: string }) {
  return <span className="flex items-center gap-1">{keys.map((key) => <Kbd key={key}>{key}</Kbd>)}<span>{label}</span></span>;
}

export function StatusBar({ catalog }: { catalog: CatalogViewState }) {
  const ready = isCatalogReady(catalog);
  const error = isCatalogError(catalog);
  const Icon = error ? CircleAlert : ready ? Check : Database;
  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-[var(--border)] bg-[var(--sidebar)] px-3 text-[10px] text-[var(--text-tertiary)]">
      <div className="flex items-center gap-1.5">
        <Icon aria-hidden="true" className={ready ? "size-3 text-[var(--positive)]" : "size-3"} />
        <span>{error ? t("statusLocalError") : ready ? t("statusLocalReady") : t("statusLocalPreparing")}</span>
        {catalog.status?.catalogVersion ? <><span aria-hidden="true">·</span><span className="font-mono">{catalog.status.catalogVersion}</span></> : null}
      </div>
      {ready ? <span className="hidden tabular-nums sm:block">{formatCount(catalog.status?.totalJobs ?? 0)} {t("catalogJobs")}</span> : null}
      <div className="hidden items-center gap-2 lg:flex">
        <Hint keys={["/"]} label={t("search")} /><span aria-hidden="true">·</span>
        <Hint keys={["J", "K"]} label={t("navigate")} /><span aria-hidden="true">·</span>
        <Hint keys={["S"]} label={t("shortlist")} /><span aria-hidden="true">·</span>
        <Hint keys={["Ctrl", "K"]} label={t("commands")} /><span aria-hidden="true">·</span>
        <Hint keys={["Ctrl", "E"]} label={t("emmy")} />
      </div>
    </footer>
  );
}
