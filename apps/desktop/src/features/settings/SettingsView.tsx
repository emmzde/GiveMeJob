import { Database, Languages, Palette, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { LanguageControl } from "@/app/LanguageControl";
import { ThemeControl } from "@/app/ThemeControl";
import { IconTile, type IconTileTone } from "@/components/ui/icon-tile";
import type { CatalogViewState } from "@/features/catalog/catalogStatus";
import { EmmyProviderSettings } from "@/features/emmy/EmmyProviderSettings";
import { formatCount, formatSnapshotDate } from "@/features/feed/jobPresentation";
import { t } from "@/lib/i18n";

function SettingsGroup({
  children,
  icon,
  id,
  title,
  tone,
}: {
  children: ReactNode;
  icon: LucideIcon;
  id: string;
  title: string;
  tone: IconTileTone;
}) {
  return (
    <section aria-labelledby={id} className="settings-group">
      <h2 className="settings-group-title" id={id}>
        <IconTile icon={icon} size="sm" tone={tone} />
        {title}
      </h2>
      <div className="settings-card">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="settings-row">
      <dt className="settings-row-label">{label}</dt>
      <dd className="settings-row-value">{value}</dd>
    </div>
  );
}

export function SettingsView({ catalog }: { catalog: CatalogViewState }) {
  const status = catalog.status;
  const unavailable = t("catalogUnavailableValue");
  return (
    <div className="workspace-page settings-page">
      <section className="workspace-frame settings-workspace">
        <header className="workspace-header">
          <h1 className="workspace-title">{t("settingsTitle")}</h1>
        </header>

        <div className="settings-content scroll-region">
          <div className="settings-stack">
            <SettingsGroup icon={Sparkles} id="emmy-settings-heading" title={t("settingsGroupEmmy")} tone="violet">
              <EmmyProviderSettings />
            </SettingsGroup>

            <SettingsGroup icon={Palette} id="appearance-heading" title={t("appearance")} tone="blue">
              <div className="settings-block">
                <div className="settings-row-text">
                  <p className="settings-row-label">{t("theme")}</p>
                  <p className="settings-row-hint">{t("settingsThemeHint")}</p>
                </div>
                <ThemeControl />
              </div>
              <section aria-labelledby="language-heading" className="settings-row settings-row-control">
                <div className="settings-row-text">
                  <h3 className="settings-row-label" id="language-heading">
                    <Languages aria-hidden="true" className="settings-row-glyph size-4" />
                    {t("language")}
                  </h3>
                  <p className="settings-row-hint">{t("languageDescription")}</p>
                </div>
                <LanguageControl />
              </section>
            </SettingsGroup>

            <SettingsGroup icon={Database} id="catalog-heading" title={t("localCatalog")} tone="gold">
              <p className="settings-card-note">{t("settingsCatalogHint")}</p>
              <dl>
                <InfoRow label={t("jobsIndexed")} value={status?.state === "ready" ? formatCount(status.totalJobs) : unavailable} />
                <InfoRow label={t("catalogSnapshotDate")} value={status?.sourceFrozenAt ? formatSnapshotDate(status.sourceFrozenAt) : unavailable} />
                <InfoRow label={t("catalogVersion")} value={status?.catalogVersion ?? unavailable} />
              </dl>
            </SettingsGroup>
          </div>
        </div>
      </section>
    </div>
  );
}
