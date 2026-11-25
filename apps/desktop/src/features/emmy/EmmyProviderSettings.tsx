import { useQueryClient } from "@tanstack/react-query";
import { Check, KeyRound, Lock, Unplug } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmmyAvatar } from "@/features/emmy/EmmyAvatar";
import { emmyConfigurationQueryKey, useEmmyConfiguration } from "@/features/emmy/hooks";
import { emmyApi } from "@/lib/emmy";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Preset {
  id: string;
  label: string;
  baseUrl: string;
  modelExample: string;
  local?: boolean;
}

// Well-known OpenAI-compatible endpoints. Picking one only fills the address;
// the person still chooses the model and supplies their own key.
const presets: readonly Preset[] = [
  { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", modelExample: "openai/gpt-oss-20b:free" },
  { id: "groq", label: "Groq", baseUrl: "https://api.groq.com/openai/v1", modelExample: "qwen/qwen3.6-27b" },
  { id: "gemini", label: "Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", modelExample: "gemini-3.5-flash-lite" },
  { id: "ollama", label: "Ollama", baseUrl: "http://localhost:11434/v1", modelExample: "llama3.2", local: true },
  { id: "lmstudio", label: "LM Studio", baseUrl: "http://localhost:1234/v1", modelExample: "local-model", local: true },
];

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/u, "").toLowerCase().replace("://127.0.0.1", "://localhost");
}

function hostOf(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

export function EmmyProviderSettings() {
  const configuration = useEmmyConfiguration();
  const customApi = configuration.data?.customApi;

  if (configuration.isPending) {
    return <div aria-label={t("emmyCredentials")} className="h-72 animate-pulse rounded-[18px] bg-[var(--surface-2)]" role="status" />;
  }

  return (
    <EmmyConnectionForm
      builtInAvailable={configuration.data?.available === true}
      customApi={customApi ?? null}
      key={customApi ? `${customApi.baseUrl}|${customApi.model}` : "empty"}
    />
  );
}

function EmmyConnectionForm({
  builtInAvailable,
  customApi,
}: {
  builtInAvailable: boolean;
  customApi: { baseUrl: string; model: string; keyConfigured: boolean } | null;
}) {
  const mode = customApi ? "custom" : builtInAvailable ? "builtin" : "off";
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [baseUrl, setBaseUrl] = useState(customApi?.baseUrl ?? "");
  const [model, setModel] = useState(customApi?.model ?? "");
  const activePreset = presets.find((preset) => normalizeUrl(preset.baseUrl) === normalizeUrl(baseUrl)) ?? null;

  function applyPreset(preset: Preset): void {
    setBaseUrl(preset.baseUrl);
    if (activePreset?.id !== preset.id) setModel("");
    setError(false);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const key = new FormData(form).get("key");
    if (typeof key !== "string") return;
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

  return (
    <form className="emmy-connection" data-configured={customApi ? "true" : "false"} onSubmit={(event) => void save(event)}>
      <div className="settings-row emmy-connection-status">
        <EmmyAvatar className="size-12" state={mode === "off" ? "offline" : "idle"} />
        <div className="settings-row-text">
          <p className="settings-row-label">Emmy</p>
          <p className="settings-row-hint">
            {customApi ? (
              <>
                {t("settingsEmmyOnHint")} <span className="emmy-connection-model">{customApi.model}</span> · {hostOf(customApi.baseUrl)}
              </>
            ) : mode === "builtin" ? (
              t("settingsEmmyBuiltInHint")
            ) : (
              t("settingsEmmyOffHint")
            )}
          </p>
        </div>
        <span className="status-pill" data-on={mode === "custom" ? "true" : mode === "builtin" ? "builtin" : "false"}>
          {mode !== "off" ? <Check aria-hidden="true" className="size-3.5" /> : null}
          {mode === "custom" ? t("emmyConfigured") : mode === "builtin" ? t("settingsEmmyBuiltIn") : t("emmyCustomApiNotConfigured")}
        </span>
      </div>

      <div className="settings-block">
        <div className="settings-row-text">
          <p className="settings-row-label">{t("settingsPresets")}</p>
          <p className="settings-row-hint">{t("settingsPresetsHint")}</p>
        </div>
        <div className="preset-chips" role="group" aria-label={t("settingsPresets")}>
          {presets.map((preset) => (
            <button
              aria-pressed={activePreset?.id === preset.id}
              className={cn("preset-chip", activePreset?.id === preset.id && "is-active")}
              key={preset.id}
              onClick={() => applyPreset(preset)}
              type="button"
            >
              {preset.label}
              {preset.local ? <span className="preset-chip-tag">local</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-block">
        <div className="settings-row-text">
          <p className="settings-row-label">{t("emmyCustomApiTitle")}</p>
          <p className="settings-row-hint">{t("emmyCustomApiDescription")}</p>
        </div>
        <div className="emmy-connection-fields">
          <label className="settings-field settings-field-wide">
            <span>{t("emmyBaseUrl")}</span>
            <input
              className="form-control"
              maxLength={2_048}
              name="baseUrl"
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.example.com/v1"
              required
              spellCheck={false}
              type="url"
              value={baseUrl}
            />
          </label>
          <label className="settings-field">
            <span>{t("emmyModel")}</span>
            <input
              className="form-control"
              maxLength={200}
              name="model"
              onChange={(event) => setModel(event.target.value)}
              placeholder={activePreset?.modelExample ?? "model-name"}
              required
              spellCheck={false}
              value={model}
            />
          </label>
          <label className="settings-field">
            <span>
              {t("emmyApiKey")}
              {customApi?.keyConfigured ? <KeyRound aria-hidden="true" className="settings-field-badge size-3.5" /> : null}
            </span>
            <input
              autoComplete="off"
              className="form-control"
              maxLength={512}
              name="key"
              placeholder={customApi?.keyConfigured ? t("emmyKeepCurrentKey") : t("emmyOptionalKey")}
              spellCheck={false}
              type="password"
            />
          </label>
        </div>
      </div>

      {error ? <p className="emmy-connection-error" role="alert">{t("emmyCredentialError")}</p> : null}

      <div className="emmy-connection-footer">
        <p className="settings-row-hint emmy-connection-security">
          <Lock aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{t("emmyCustomApiSecurity")}</span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {customApi ? (
            <Button aria-label={t("emmyRemoveApi")} disabled={busy} onClick={() => void clear()} type="button" variant="ghost">
              <Unplug aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">{t("emmyRemoveApi")}</span>
            </Button>
          ) : null}
          <button className="pill-button-solid" disabled={busy} type="submit">
            {busy ? t("emmySavingKey") : customApi ? t("emmyUpdateApi") : t("emmyConnectApi")}
          </button>
        </div>
      </div>
    </form>
  );
}
