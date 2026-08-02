import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  getCatalogStatus,
  recoverLocalCatalog,
  watchCatalogStatus,
} from "@/lib/catalog";
import type { CatalogStatus } from "@/lib/catalog";

const catalogStatusQueryKey = ["catalog", "status"] as const;

export function useCatalogStatus() {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: catalogStatusQueryKey,
    queryFn: getCatalogStatus,
    retry: false,
  });
  const recovery = useMutation({
    mutationFn: recoverLocalCatalog,
    retry: false,
    onMutate: () => {
      const previous = queryClient.getQueryData<CatalogStatus>(catalogStatusQueryKey);
      queryClient.setQueryData<CatalogStatus>(catalogStatusQueryKey, (current) =>
        current
          ? {
              ...current,
              state: "recovering",
              stage: "starting",
              progress: 0,
              message: null,
            }
          : current,
      );
      return previous;
    },
    onSuccess: (status) => {
      queryClient.setQueryData(catalogStatusQueryKey, status);
    },
    onError: (_error, _variables, previous) => {
      if (previous) queryClient.setQueryData(catalogStatusQueryKey, previous);
    },
  });

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;

    void watchCatalogStatus((status) => {
      if (active) queryClient.setQueryData(catalogStatusQueryKey, status);
    })
      .then((stopWatching) => {
        if (active) {
          unlisten = stopWatching;
        } else {
          stopWatching();
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
      unlisten?.();
    };
  }, [queryClient]);

  return {
    ...statusQuery,
    recoverCatalog: recovery.mutateAsync,
    isRecovering: recovery.isPending,
  };
}
