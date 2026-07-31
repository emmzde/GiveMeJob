import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { searchLocalJobs } from "@/lib/catalog";
import type { SearchQuery } from "@/lib/catalog";

export const searchPageQueryKey = (query: SearchQuery) =>
  ["catalog", "search", query] as const;

export function useSearchPage(query: SearchQuery, enabled: boolean) {
  return useQuery({
    queryKey: searchPageQueryKey(query),
    queryFn: () => searchLocalJobs(query),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
