import { useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { emmyConfigurationQueryKey, useEmmyConfiguration } from "@/features/emmy/hooks";
import { emmyApi } from "@/lib/emmy";
import type { EmmyProvider } from "@/lib/emmy";
import { t } from "@/lib/i18n";

const providerLabels: Readonly<Record<EmmyProvider, string>> = {
  groq: "Groq",
  gemini: "Gemini",
  openrouter: "OpenRouter",
  cerebras: "Cerebras",
};
const providerOrder = [
  "openrouter",
  "groq",
  "gemini",
  "cerebras",
] as const satisfies readonly EmmyProvider[];

export function EmmyProviderSettings() {
  const configuration = useEmmyConfiguration();
  const queryClient = useQueryClient();
  const [busyProvider, setBusyProvider] = useState<EmmyProvider | null>(null);
  const [errorProvider, setErrorProvider] = useState<EmmyProvider | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>, provider: EmmyProvider) {
    event.preventDefault();
    const form = event.currentTarget;
    const key = new FormData(form).get("key");
    if (typeof key !== "string") return;
    setBusyProvider(provider);
    setErrorProvider(null);
    try {
      const next = await emmyApi.setProviderKey(provider, key);
      queryClient.setQueryData(emmyConfigurationQueryKey, next);
      form.reset();
    } catch {
      setErrorProvider(provider);
    } finally {
      setBusyProvider(null);
    }
  }

  async function clear(provider: EmmyProvider) {
    setBusyProvider(provider);
    setErrorProvider(null);
    try {
      const next = await emmyApi.clearProviderKey(provider);
      queryClient.setQueryData(emmyConfigurationQueryKey, next);
    } catch {
      setErrorProvider(provider);
    } finally {
      setBusyProvider(null);
    }
  }

  if (configuration.isPending) {
    return (
      <div aria-label={t("emmyCredentials")} className="h-40 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-1)]" role="status" />
    );
  }

  return (
    <div className="provider-route">
      {providerOrder.map((provider, index) => {
        const status = configuration.data?.providers.find((item) => item.provider === provider);
        const busy = busyProvider === provider;
        return (
          <form
            className="provider-route-row"
            data-primary={provider === "openrouter" ? "true" : "false"}
            key={provider}
            onSubmit={(event) => void save(event, provider)}
          >
            <span aria-hidden="true" className="provider-route-index ui-mono">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                {providerLabels[provider]}
                {provider === "openrouter" ? (
                  <span className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                    {t("emmyPrimaryProvider")}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[11px] leading-4 text-[var(--text-tertiary)]">
                {provider === "openrouter"
                  ? t("emmyOpenRouterCascade")
                  : status?.byokConfigured
                    ? t("emmyByokConfigured")
                    : status?.demoAvailable
                      ? t("emmyDemoAvailable")
                      : t("emmyProviderNotConfigured")}
              </p>
            </div>
            <div className="provider-route-controls">
              <label className="min-w-0 flex-1">
                <span className="sr-only">{providerLabels[provider]} API key</span>
                <input
                  autoComplete="off"
                  className="form-control w-full"
                  maxLength={512}
                  minLength={8}
                  name="key"
                  placeholder={t("emmyKeyPlaceholder")}
                  required
                  spellCheck={false}
                  type="password"
                />
              </label>
              <Button disabled={busy} type="submit" variant="outline">
                {busy ? t("emmySavingKey") : t("emmySaveKey")}
              </Button>
              {status?.byokConfigured ? (
                <Button
                  aria-label={`${t("emmyClearKey")}: ${providerLabels[provider]}`}
                  className="w-8 px-0"
                  disabled={busy}
                  onClick={() => void clear(provider)}
                  type="button"
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              ) : null}
            </div>
            <div className="provider-route-status">
              {status?.configured ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--positive)]">
                  <Check aria-hidden="true" className="size-3.5" />
                  {t("emmyConfigured")}
                </span>
              ) : (
                <span className="text-[11px] text-[var(--text-tertiary)]">{t("emmyProviderNotConfigured")}</span>
              )}
            </div>
            {errorProvider === provider ? (
              <p className="col-span-full text-xs text-[var(--danger)]" role="alert">
                {t("emmyCredentialError")}
              </p>
            ) : null}
          </form>
        );
      })}
    </div>
  );
}
