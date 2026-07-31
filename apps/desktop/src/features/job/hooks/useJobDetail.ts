import { useQuery } from "@tanstack/react-query";

import { getLocalJob } from "@/lib/catalog";
import type { JobId } from "@/lib/catalog";

export const jobDetailQueryKey = (id: JobId | null) => ["catalog", "job", id] as const;

export function useJobDetail(id: JobId | null) {
  return useQuery({
    queryKey: jobDetailQueryKey(id),
    queryFn: () => {
      if (id === null) throw new Error("A job ID is required");
      return getLocalJob(id);
    },
    enabled: id !== null,
    retry: false,
  });
}
