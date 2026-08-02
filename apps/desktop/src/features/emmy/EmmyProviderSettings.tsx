import { useQueryClient } from "@tanstack/react-query";
import { Check, KeyRound, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { emmyConfigurationQueryKey, useEmmyConfiguration } from "@/features/emmy/hooks";
import { emmyApi, emmyProviderSchema } from "@/lib/emmy";
import type { EmmyProvider } from "@/lib/emmy";
import { t } from "@/lib/i18n";

const providerLabels: Readonly<Record<EmmyProvider, string>> = {
  groq: "Groq",
  gemini: "Gemini",
  openrouter: "OpenRouter",
  cerebras: "Cerebras",
};

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
      <div aria-label={t("emmyCredentials")} className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[var(--surface-1)]" role="status" />
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel-card)]">
      {emmyProviderSchema.options.map((provider) => {
        const status = configuration.data?.providers.find((item) => item.provider === provider);
        const busy = busyProvider === provider;
        return (
          <form
            className="border-b border-[var(--border)] p-4 last:border-b-0"
            key={provider}
            onSubmit={(event) => void save(event, provider)}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <KeyRound aria-hidden="true" className="size-3.5 text-[var(--text-tertiary)]" />
                  {providerLabels[provider]}
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                  {status?.byokConfigured
                    ? t("emmyByokConfigured")
                    : status?.demoAvailable
                      ? t("emmyDemoAvailable")
                      : t("emmyProviderNotConfigured")}
                </p>
              </div>
              {status?.configured ? (
                <span className="flex items-center gap-1 text-[11px] text-[var(--positive)]">
                  <Check aria-hidden="true" className="size-3.5" />
                  {t("emmyConfigured")}
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex gap-2">
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
                  className="w-9 px-0"
                  disabled={busy}
                  onClick={() => void clear(provider)}
                  type="button"
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              ) : null}
            </div>
            {errorProvider === provider ? (
              <p className="mt-2 text-xs text-[var(--danger)]" role="alert">
                {t("emmyCredentialError")}
              </p>
            ) : null}
          </form>
        );
      })}
    </div>
  );
}
