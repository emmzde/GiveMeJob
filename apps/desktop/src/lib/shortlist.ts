import { z } from "zod";

import { ipcErrorSchema, jobIdSchema } from "@/lib/catalog";
import type { JobId } from "@/lib/catalog";
import { tauriAdapter } from "@/lib/tauri/adapter";
import type { TauriAdapter } from "@/lib/tauri/adapter";

export const shortlistRecordSchema = z
  .object({
    jobId: jobIdSchema,
    catalogVersion: z.string().min(1).max(100),
    savedAt: z.string().min(1),
  })
  .strict();

export const shortlistStateSchema = z
  .object({
    jobId: jobIdSchema,
    saved: z.boolean(),
    catalogVersion: z.string().min(1).max(100),
    savedAt: z.string().min(1).nullable(),
  })
  .strict();

const shortlistRecordsSchema = z.array(shortlistRecordSchema).max(10_000);
const setShortlistInputSchema = z
  .object({ jobId: jobIdSchema, saved: z.boolean() })
  .strict();

export type ShortlistRecord = z.infer<typeof shortlistRecordSchema>;
export type ShortlistState = z.infer<typeof shortlistStateSchema>;
export type SetShortlistInput = z.infer<typeof setShortlistInputSchema>;

export interface ShortlistApi {
  listShortlist(): Promise<ShortlistRecord[]>;
  isShortlisted(jobId: JobId): Promise<boolean>;
  setShortlist(input: SetShortlistInput): Promise<ShortlistState>;
}

function asClosedError(error: unknown): z.infer<typeof ipcErrorSchema> {
  const parsed = ipcErrorSchema.safeParse(error);
  return parsed.success ? parsed.data : { code: "internal" };
}

export function createShortlistApi(adapter: TauriAdapter): ShortlistApi {
  return {
    async listShortlist() {
      if (!adapter.isAvailable()) return [];
      try {
        return shortlistRecordsSchema.parse(await adapter.invoke("list_shortlist"));
      } catch (error) {
        if (error instanceof z.ZodError) throw error;
        throw asClosedError(error);
      }
    },
    async isShortlisted(jobId) {
      const parsedJobId = jobIdSchema.parse(jobId);
      if (!adapter.isAvailable()) return false;
      try {
        return z.boolean().parse(
          await adapter.invoke("is_shortlisted", { jobId: parsedJobId }),
        );
      } catch (error) {
        if (error instanceof z.ZodError) throw error;
        throw asClosedError(error);
      }
    },
    async setShortlist(input) {
      const request = setShortlistInputSchema.parse(input);
      if (!adapter.isAvailable()) throw { code: "user_data_unavailable" } as const;
      try {
        return shortlistStateSchema.parse(
          await adapter.invoke("set_shortlist", { request }),
        );
      } catch (error) {
        if (error instanceof z.ZodError) throw error;
        throw asClosedError(error);
      }
    },
  };
}

const shortlistApi = createShortlistApi(tauriAdapter);

export const listShortlist = shortlistApi.listShortlist;
export const isShortlisted = shortlistApi.isShortlisted;
export const setShortlist = shortlistApi.setShortlist;
