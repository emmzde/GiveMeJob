import { AppShell } from "@/app/AppShell";
import { useCatalogStatus } from "@/features/catalog/hooks/useCatalogStatus";
import { SearchScreen } from "@/features/feed/SearchScreen";

export function App() {
  const catalogStatus = useCatalogStatus();
  const catalog = {
    status: catalogStatus.data,
    isPending: catalogStatus.isPending,
    isError: catalogStatus.isError,
  };

  return (
    <AppShell catalog={catalog}>
      <SearchScreen
        catalog={catalog}
        isRecovering={catalogStatus.isRecovering}
        recoverCatalog={catalogStatus.recoverCatalog}
      />
    </AppShell>
  );
}
