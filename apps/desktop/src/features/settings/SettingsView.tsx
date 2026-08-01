import { Bot, Database, MonitorCog } from "lucide-react";

import { ThemeControl } from "@/app/ThemeControl";
import { EmmyProviderSettings } from "@/features/emmy/EmmyProviderSettings";
import type { CatalogViewState } from "@/features/catalog/catalogStatus";
import { formatCount, formatSnapshotDate } from "@/features/feed/jobPresentation";
import { t } from "@/lib/i18n";

function SettingRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex min-h-12 items-center justify-between gap-4 border-b border-[var(--border)] px-4 last:border-b-0"><dt className="text-xs text-[var(--text-secondary)]">{label}</dt><dd className="text-right text-xs font-medium text-[var(--text)]">{value}</dd></div>;
}

export function SettingsView({ catalog }: { catalog: CatalogViewState }) {
  const status = catalog.status;
  const unavailable = t("catalogUnavailableValue");
  return (
    <div className="scroll-region h-full overflow-y-auto">
      <section className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-lg font-semibold tracking-[-0.02em]">{t("settingsTitle")}</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{t("settingsDescription")}</p>

        <section className="mt-8" aria-labelledby="appearance-heading">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]" id="appearance-heading"><MonitorCog aria-hidden="true" className="size-4" />{t("appearance")}</h2>
          <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)] p-3"><ThemeControl /></div>
        </section>

        <section className="mt-8" aria-labelledby="catalog-heading">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]" id="catalog-heading"><Database aria-hidden="true" className="size-4" />{t("localCatalog")}</h2>
          <dl className="mt-3 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)]">
            <SettingRow label={t("jobsIndexed")} value={status?.state === "ready" ? formatCount(status.totalJobs) : unavailable} />
            <SettingRow label={t("catalogVersion")} value={status?.catalogVersion ?? unavailable} />
            <SettingRow label={t("catalogSnapshotDate")} value={status?.sourceFrozenAt ? formatSnapshotDate(status.sourceFrozenAt) : unavailable} />
          </dl>
        </section>

        <section className="mt-8" aria-labelledby="emmy-settings-heading">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]" id="emmy-settings-heading">
            <Bot aria-hidden="true" className="size-4" />
            {t("emmyCredentials")}
          </h2>
          <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
            {t("emmyCredentialsDescription")}
          </p>
          <div className="mt-3">
            <EmmyProviderSettings />
          </div>
        </section>
      </section>
    </div>
  );
}
