import { lazy, Suspense } from "react";

import { AppShell } from "@/app/AppShell";
import { useAppUiStore } from "@/app/store/appUiStore";
import { useCatalogStatus } from "@/features/catalog/hooks/useCatalogStatus";
import { SearchScreen } from "@/features/feed/SearchScreen";
import { ShortlistShortcut } from "@/features/shortlist/ShortlistShortcut";
import { t } from "@/lib/i18n";

const ProfileView = lazy(() =>
  import("@/features/profile/ProfileView").then((module) => ({
    default: module.ProfileView,
  })),
);
const SettingsView = lazy(() =>
  import("@/features/settings/SettingsView").then((module) => ({
    default: module.SettingsView,
  })),
);
const ShortlistView = lazy(() =>
  import("@/features/shortlist/ShortlistView").then((module) => ({
    default: module.ShortlistView,
  })),
);

function ScreenSkeleton({ label }: { label: string }) {
  return (
    <div aria-label={label} className="space-y-3 p-6" role="status">
      <div className="h-16 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-1)]" />
      <div className="h-28 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-1)]" />
    </div>
  );
}

export function App() {
  const screen = useAppUiStore((state) => state.screen);
  const profileVisited = useAppUiStore((state) => state.profileVisited);
  useAppUiStore((state) => state.language);
  const catalogStatus = useCatalogStatus();
  const catalog = {
    status: catalogStatus.data,
    isPending: catalogStatus.isPending,
    isError: catalogStatus.isError,
  };

  return (
    <AppShell catalog={catalog}>
      <div className="app-screen-motion h-full" data-active={screen === "search"} hidden={screen !== "search"}>
        <SearchScreen
          catalog={catalog}
          isRecovering={catalogStatus.isRecovering}
          recoverCatalog={catalogStatus.recoverCatalog}
        />
      </div>
      {screen === "shortlist" ? (
        <div className="app-screen-motion h-full" data-active="true">
          <Suspense fallback={<ScreenSkeleton label={t("shortlistTitle")} />}>
            <ShortlistView catalogVersion={catalog.status?.catalogVersion ?? null} />
          </Suspense>
        </div>
      ) : null}
      {profileVisited || screen === "profile" ? (
        <div className="app-screen-motion h-full" data-active={screen === "profile"} hidden={screen !== "profile"}>
          <Suspense fallback={<ScreenSkeleton label={t("profileTitle")} />}>
            <ProfileView />
          </Suspense>
        </div>
      ) : null}
      {screen === "settings" ? (
        <div className="app-screen-motion h-full" data-active="true">
          <Suspense fallback={<ScreenSkeleton label={t("settingsTitle")} />}>
            <SettingsView catalog={catalog} />
          </Suspense>
        </div>
      ) : null}
      <ShortlistShortcut />
    </AppShell>
  );
}
