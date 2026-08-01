import { useQuery } from "@tanstack/react-query";

import { emmyApi } from "@/lib/emmy";

export const emmyConfigurationQueryKey = ["emmy", "configuration"] as const;
export const emmyConversationsQueryKey = ["emmy", "conversations"] as const;
export const emmyConversationQueryKey = (conversationId: string) =>
  ["emmy", "conversation", conversationId] as const;

export function useEmmyConfiguration() {
  return useQuery({
    queryKey: emmyConfigurationQueryKey,
    queryFn: () => emmyApi.getConfiguration(),
    staleTime: 30_000,
  });
}
