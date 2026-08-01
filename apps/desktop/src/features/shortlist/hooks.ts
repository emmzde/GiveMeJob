import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { JobId } from "@/lib/catalog";
import {
  listShortlist,
  setShortlist,
} from "@/lib/shortlist";
import type {
  SetShortlistInput,
  ShortlistRecord,
  ShortlistState,
} from "@/lib/shortlist";

export const shortlistQueryKey = ["user", "shortlist"] as const;

export function applyShortlistState(
  records: readonly ShortlistRecord[],
  state: ShortlistState,
): ShortlistRecord[] {
  const withoutJob = records.filter((record) => record.jobId !== state.jobId);
  if (!state.saved || state.savedAt === null) return withoutJob;
  return [
    {
      jobId: state.jobId,
      catalogVersion: state.catalogVersion,
      savedAt: state.savedAt,
    },
    ...withoutJob,
  ];
}

export function useShortlistRecords() {
  return useQuery({
    queryFn: listShortlist,
    queryKey: shortlistQueryKey,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useSetShortlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetShortlistInput) => setShortlist(input),
    onSuccess(state) {
      queryClient.setQueryData<ShortlistRecord[]>(shortlistQueryKey, (current = []) =>
        applyShortlistState(current, state),
      );
    },
  });
}

export function shortlistContains(
  records: readonly ShortlistRecord[] | undefined,
  jobId: JobId,
): boolean {
  return records?.some((record) => record.jobId === jobId) ?? false;
}
