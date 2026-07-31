import type { CatalogStatus } from "@/lib/catalog";
import { t } from "@/lib/i18n";

export interface CatalogViewState {
  status: CatalogStatus | undefined;
  isPending: boolean;
  isError: boolean;
}

export function isCatalogReady(state: CatalogViewState): boolean {
  return state.status?.state === "ready";
}

export function isCatalogError(state: CatalogViewState): boolean {
  return state.isError || state.status?.state === "error";
}

export function isCatalogWorking(state: CatalogViewState): boolean {
  return (
    state.isPending ||
    state.status?.state === "initializing" ||
    state.status?.state === "verifying" ||
    state.status?.state === "recovering"
  );
}

export function catalogStateLabel(state: CatalogViewState): string {
  if (state.isPending) return t("catalogChecking");
  if (state.isError || state.status?.state === "error") return t("catalogError");
  switch (state.status?.state) {
    case "initializing":
      return t("catalogInitializing");
    case "verifying":
      return t("catalogVerifying");
    case "recovering":
      return t("catalogRecovering");
    case "ready":
      return t("offlineReady");
    case "missing":
    case undefined:
      return t("catalogMissing");
  }
}

export function catalogStageLabel(status: CatalogStatus): string {
  switch (status.stage) {
    case "starting":
      return t("catalogStageStarting");
    case "checking_seal":
      return t("catalogStageSeal");
    case "checking_space":
      return t("catalogStageSpace");
    case "checking_archive":
      return t("catalogStageArchive");
    case "decompressing":
      return t("catalogStageDecompressing");
    case "checking_catalog":
      return t("catalogStageCatalog");
    case "checking_sqlite":
      return t("catalogStageSqlite");
    case "activating":
      return t("catalogStageActivating");
    case "opening":
      return t("catalogStageOpening");
    case "cleaning_up":
      return t("catalogStageCleanup");
    case null:
      return catalogStateLabel({ status, isPending: false, isError: false });
  }
}
