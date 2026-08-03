import { useQueryClient } from "@tanstack/react-query";
import { Check, Link2, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { emmyConfigurationQueryKey, useEmmyConfiguration } from "@/features/emmy/hooks";
import { emmyApi } from "@/lib/emmy";
import { t } from "@/lib/i18n";

export function EmmyProviderSettings() {
  const configuration = useEmmyConfiguration();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const customApi = configuration.data?.customApi;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const baseUrl = data.get("baseUrl");
    const model = data.get("model");
    const key = data.get("key");
    if (typeof baseUrl !== "string" || typeof model !== "string" || typeof key !== "string") return;
    setBusy(true);
    setError(false);
    try {
      const next = await emmyApi.setCustomApi({
        baseUrl,
        model,
        key,
        replaceKey: !customApi?.keyConfigured || key.trim().length > 0,
      });
      queryClient.setQueryData(emmyConfigurationQueryKey, next);
      const keyInput = form.elements.namedItem("key");
      if (keyInput instanceof HTMLInputElement) keyInput.value = "";
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError(false);
    try {
      const next = await emmyApi.clearCustomApi();
      queryClient.setQueryData(emmyConfigurationQueryKey, next);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (configuration.isPending) {
    return (
      <div aria-label={t("emmyCredentials")} className="h-52 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-1)]" role="status" />
    );
  }

  return (
    <form className="custom-api-card" data-configured={customApi ? "true" : "false"} onSubmit={(event) => void save(event)}>
      <div className="custom-api-card-header">
        <span aria-hidden="true" className="custom-api-glyph"><Link2 className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-semibold">{t("emmyCustomApiTitle")}</h3>
            <span className="custom-api-protocol ui-mono">OpenAI-compatible</span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-[var(--text-tertiary)]">{t("emmyCustomApiDescription")}</p>
        </div>
        <div className="custom-api-status">
          {customApi ? <><Check aria-hidden="true" className="size-3.5" />{t("emmyConfigured")}</> : t("emmyCustomApiNotConfigured")}
        </div>
      </div>

      <div className="custom-api-fields">
        <label className="custom-api-field custom-api-field-url">
          <span>{t("emmyBaseUrl")}</span>
          <input
            className="form-control w-full ui-mono"
            defaultValue={customApi?.baseUrl ?? ""}
            maxLength={2_048}
            name="baseUrl"
            placeholder="https://api.example.com/v1"
            required
            spellCheck={false}
            type="url"
          />
        </label>
        <label className="custom-api-field">
          <span>{t("emmyModel")}</span>
          <input
            className="form-control w-full ui-mono"
            defaultValue={customApi?.model ?? ""}
            maxLength={200}
            name="model"
            placeholder="model-name"
            required
            spellCheck={false}
          />
        </label>
        <label className="custom-api-field custom-api-field-key">
          <span>{t("emmyApiKey")}</span>
          <input
            autoComplete="off"
            className="form-control w-full"
            maxLength={512}
            name="key"
            placeholder={customApi?.keyConfigured ? t("emmyKeepCurrentKey") : t("emmyOptionalKey")}
            spellCheck={false}
            type="password"
          />
        </label>
      </div>

      <div className="custom-api-footer">
        <p className="flex min-w-0 items-center gap-2 text-[10px] leading-4 text-[var(--text-tertiary)]">
          <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{t("emmyCustomApiSecurity")}</span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {customApi ? (
            <Button aria-label={t("emmyRemoveApi")} className="w-8 px-0" disabled={busy} onClick={() => void clear()} type="button" variant="ghost">
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          ) : null}
          <Button disabled={busy} type="submit" variant="outline">
            {busy ? t("emmySavingKey") : customApi ? t("emmyUpdateApi") : t("emmyConnectApi")}
          </Button>
        </div>
      </div>

      {error ? <p className="custom-api-error text-xs text-[var(--danger)]" role="alert">{t("emmyCredentialError")}</p> : null}
    </form>
  );
}
