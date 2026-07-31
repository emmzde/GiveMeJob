import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { searchLocalJobs } from "@/lib/catalog";
import type { SearchCursor, SearchQuery } from "@/lib/catalog";

export const searchPageQueryKey = (query: SearchQuery) =>
  ["catalog", "search", query] as const;

export function useSearchPage(query: SearchQuery, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: searchPageQueryKey(query),
    queryFn: ({ pageParam }) =>
      searchLocalJobs(pageParam === undefined ? query : { ...query, cursor: pageParam }),
    initialPageParam: undefined as SearchCursor | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
