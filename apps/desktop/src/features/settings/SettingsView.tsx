import { Bot, Database, Languages, MonitorCog } from "lucide-react";

import { LanguageControl } from "@/app/LanguageControl";
import { ThemeControl } from "@/app/ThemeControl";
import { EmmyProviderSettings } from "@/features/emmy/EmmyProviderSettings";
import type { CatalogViewState } from "@/features/catalog/catalogStatus";
import { formatCount, formatSnapshotDate } from "@/features/feed/jobPresentation";
import { t } from "@/lib/i18n";

function SettingRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="settings-data-row"><dt className="text-xs font-medium text-[var(--text-secondary)]">{label}</dt><dd className="ui-mono rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-2 py-1 text-right text-[10px] font-semibold text-[var(--text)]">{value}</dd></div>;
}

export function SettingsView({ catalog }: { catalog: CatalogViewState }) {
  const status = catalog.status;
  const unavailable = t("catalogUnavailableValue");
  return (
    <div className="workspace-page settings-page">
      <section className="workspace-frame settings-workspace">
        <header className="workspace-header">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="workspace-header-glyph"><MonitorCog className="size-4" /></span>
            <div>
            <h1 className="workspace-title">{t("settingsTitle")}</h1>
            <p className="workspace-description">{t("settingsDescription")}</p>
            </div>
          </div>
        </header>

        <div className="settings-content scroll-region">
          <section className="workspace-section" aria-labelledby="appearance-heading">
            <div className="workspace-section-header">
              <h2 className="workspace-section-title" id="appearance-heading"><MonitorCog aria-hidden="true" className="size-4 text-[var(--text-tertiary)]" />{t("appearance")}</h2>
              <p className="workspace-section-copy">{t("theme")}</p>
            </div>
            <ThemeControl />
          </section>

          <section className="workspace-section" aria-labelledby="language-heading">
            <div className="workspace-section-header">
              <h2 className="workspace-section-title" id="language-heading"><Languages aria-hidden="true" className="size-4 text-[var(--text-tertiary)]" />{t("language")}</h2>
              <p className="workspace-section-copy">{t("languageDescription")}</p>
            </div>
            <LanguageControl />
          </section>

          <section className="workspace-section" aria-labelledby="catalog-heading">
            <div className="workspace-section-header">
              <h2 className="workspace-section-title" id="catalog-heading"><Database aria-hidden="true" className="size-4 text-[var(--text-tertiary)]" />{t("localCatalog")}</h2>
              <p className="workspace-section-copy">{t("catalogSnapshotDate")}: {status?.sourceFrozenAt ? formatSnapshotDate(status.sourceFrozenAt) : unavailable}</p>
            </div>
            <dl className="settings-data-list">
              <SettingRow label={t("jobsIndexed")} value={status?.state === "ready" ? formatCount(status.totalJobs) : unavailable} />
              <SettingRow label={t("catalogVersion")} value={status?.catalogVersion ?? unavailable} />
            </dl>
          </section>

          <section className="workspace-section" aria-labelledby="emmy-settings-heading">
            <div className="workspace-section-header">
              <h2 className="workspace-section-title" id="emmy-settings-heading"><Bot aria-hidden="true" className="size-4 text-[var(--text-tertiary)]" />{t("emmyCredentials")}</h2>
              <p className="workspace-section-copy">
                {t("emmyCredentialsDescription")}
              </p>
            </div>
            <EmmyProviderSettings />
          </section>
        </div>
      </section>
    </div>
  );
}
