import { z } from "zod";

import { tauriAdapter } from "@/lib/tauri/adapter";
import type { TauriAdapter } from "@/lib/tauri/adapter";

export const supportLinkSchema = z.enum(["github", "feedback"]);
export type SupportLink = z.infer<typeof supportLinkSchema>;

interface SupportApi {
  open(link: SupportLink): Promise<void>;
}

export function createSupportApi(adapter: TauriAdapter): SupportApi {
  return {
    async open(input) {
      const link = supportLinkSchema.parse(input);
      if (!adapter.isAvailable()) return;
      z.null().parse(await adapter.invoke("open_support_link", { link }));
    },
  };
}

const supportApi = createSupportApi(tauriAdapter);

export const openSupportLink = (link: SupportLink) => supportApi.open(link);
