import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

import { searchLocalJobs } from "@/lib/catalog";
import type { SearchCursor, SearchQuery } from "@/lib/catalog";

export const searchPageQueryKey = (query: SearchQuery) =>
  ["catalog", "search", query] as const;

export function useSearchPage(query: SearchQuery, enabled: boolean) {
  const cursorsInFlight = useRef(new Set<SearchCursor>());
  const search = useInfiniteQuery({
    queryKey: searchPageQueryKey(query),
    queryFn: ({ pageParam }) =>
      searchLocalJobs(pageParam === undefined ? query : { ...query, cursor: pageParam }),
    initialPageParam: undefined as SearchCursor | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });

  const nextCursor = search.data?.pages.at(-1)?.nextCursor ?? null;
  const fetchNextPage = search.fetchNextPage;
  const fetchNextPageOnce = useCallback(async (): Promise<void> => {
    if (nextCursor === null || cursorsInFlight.current.has(nextCursor)) return;
    cursorsInFlight.current.add(nextCursor);
    try {
      await fetchNextPage({ cancelRefetch: false });
    } finally {
      cursorsInFlight.current.delete(nextCursor);
    }
  }, [fetchNextPage, nextCursor]);

  return { ...search, fetchNextPageOnce };
}
