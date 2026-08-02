import { z } from "zod";

import { ipcErrorSchema, jobIdSchema } from "@/lib/catalog";
import type { JobId } from "@/lib/catalog";
import { tauriAdapter } from "@/lib/tauri/adapter";
import type { TauriAdapter } from "@/lib/tauri/adapter";

const matchComponentNameSchema = z.enum([
  "skills",
  "role",
  "seniority",
  "location",
  "salary",
]);
const matchReasonCodeSchema = z.enum([
  "skills_overlap",
  "skills_missing",
  "role_aligned",
  "role_mismatch",
  "seniority_aligned",
  "seniority_mismatch",
  "location_aligned",
  "location_mismatch",
  "salary_meets",
  "salary_below",
]);
const matchScoreSchema = z.number().int().min(0).max(100);
const matchReasonSchema = z
  .object({
    component: matchComponentNameSchema,
    code: matchReasonCodeSchema,
    values: z.array(z.string()).max(5),
  })
  .strict();
export const matchBreakdownSchema = z
  .object({
    score: matchScoreSchema,
    components: z
      .object({
        skills: matchScoreSchema.nullable(),
        role: matchScoreSchema.nullable(),
        seniority: matchScoreSchema.nullable(),
        location: matchScoreSchema.nullable(),
        salary: matchScoreSchema.nullable(),
      })
      .strict(),
    strengths: z.array(matchReasonSchema).max(5),
    gaps: z.array(matchReasonSchema).max(5),
  })
  .strict();
const jobMatchSchema = z
  .object({ jobId: jobIdSchema, breakdown: matchBreakdownSchema })
  .strict();

const jobMatchesSchema = z.array(jobMatchSchema).max(200);
const matchBatchInputSchema = z
  .object({
    jobIds: z.array(jobIdSchema).min(1).max(200),
  })
  .strict()
  .refine(({ jobIds }) => new Set(jobIds).size === jobIds.length, {
    message: "Job IDs must be unique",
    path: ["jobIds"],
  });

export type MatchComponentName = z.infer<typeof matchComponentNameSchema>;
export type MatchReasonCode = z.infer<typeof matchReasonCodeSchema>;
export type MatchReason = z.infer<typeof matchReasonSchema>;
export type MatchBreakdown = z.infer<typeof matchBreakdownSchema>;
export type JobMatch = z.infer<typeof jobMatchSchema>;

interface MatchApi {
  getMatchBreakdown(jobId: JobId): Promise<MatchBreakdown | null>;
  getMatchBreakdowns(jobIds: readonly JobId[]): Promise<JobMatch[]>;
}

function asClosedError(error: unknown): z.infer<typeof ipcErrorSchema> {
  const parsed = ipcErrorSchema.safeParse(error);
  return parsed.success ? parsed.data : { code: "internal" };
}

export function createMatchApi(adapter: TauriAdapter): MatchApi {
  return {
    async getMatchBreakdown(jobId) {
      const parsedJobId = jobIdSchema.parse(jobId);
      if (!adapter.isAvailable()) return null;
      try {
        return matchBreakdownSchema
          .nullable()
          .parse(await adapter.invoke("get_match_breakdown", { jobId: parsedJobId }));
      } catch (error) {
        if (error instanceof z.ZodError) throw error;
        throw asClosedError(error);
      }
    },
    async getMatchBreakdowns(jobIds) {
      const request = matchBatchInputSchema.parse({ jobIds: [...jobIds] });
      if (!adapter.isAvailable()) return [];
      try {
        return jobMatchesSchema.parse(
          await adapter.invoke("get_match_breakdowns", { request }),
        );
      } catch (error) {
        if (error instanceof z.ZodError) throw error;
        throw asClosedError(error);
      }
    },
  };
}

const matchApi = createMatchApi(tauriAdapter);

export const getMatchBreakdown = matchApi.getMatchBreakdown;
export const getMatchBreakdowns = matchApi.getMatchBreakdowns;
