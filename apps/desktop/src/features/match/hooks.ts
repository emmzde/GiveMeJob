import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { JobId } from "@/lib/catalog";
import { getMatchBreakdown, getMatchBreakdowns } from "@/lib/match";
import type { JobMatch, MatchBreakdown } from "@/lib/match";
import { getProfile, profileQueryKey } from "@/lib/profile";

const MATCH_BATCH_SIZE = 200;

export async function loadMatchBatches(jobIds: readonly JobId[]): Promise<JobMatch[]> {
  const matches: JobMatch[] = [];
  for (let index = 0; index < jobIds.length; index += MATCH_BATCH_SIZE) {
    const batch = jobIds.slice(index, index + MATCH_BATCH_SIZE);
    matches.push(...(await getMatchBreakdowns(batch)));
  }
  return matches;
}

export function useJobMatches(jobIds: readonly JobId[]) {
  const profile = useQuery({
    queryFn: getProfile,
    queryKey: profileQueryKey,
    retry: false,
  });
  const uniqueJobIds = useMemo(() => [...new Set(jobIds)], [jobIds]);
  const matches = useQuery({
    enabled: profile.data !== null && profile.data !== undefined && uniqueJobIds.length > 0,
    queryFn: () => loadMatchBatches(uniqueJobIds),
    queryKey: ["user", "matches", profile.data?.version ?? null, uniqueJobIds],
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const byJobId = useMemo(
    () => new Map((matches.data ?? []).map((match) => [match.jobId, match.breakdown])),
    [matches.data],
  );
  return { ...matches, byJobId, hasProfile: profile.data !== null && profile.data !== undefined };
}

export function useJobMatch(jobId: JobId | null) {
  const profile = useQuery({
    queryFn: getProfile,
    queryKey: profileQueryKey,
    retry: false,
  });
  const match = useQuery<MatchBreakdown | null>({
    enabled: jobId !== null && profile.data !== null && profile.data !== undefined,
    queryFn: () => (jobId === null ? Promise.resolve(null) : getMatchBreakdown(jobId)),
    queryKey: ["user", "match", profile.data?.version ?? null, jobId],
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return {
    ...match,
    hasProfile: profile.data !== null && profile.data !== undefined,
  };
}
