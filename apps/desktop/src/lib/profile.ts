import { z } from "zod";

import {
  ipcErrorSchema,
  remoteModeSchema,
  senioritySchema,
} from "@/lib/catalog";
import { tauriAdapter } from "@/lib/tauri/adapter";
import type { TauriAdapter } from "@/lib/tauri/adapter";

const MAX_PROFILE_VALUE_LENGTH = 100;

const profileValueSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Array.from(value).length <= MAX_PROFILE_VALUE_LENGTH, {
    message: `Must contain at most ${MAX_PROFILE_VALUE_LENGTH} Unicode characters`,
  });

const profileFieldsSchema = z
  .object({
    preferredRoles: z.array(profileValueSchema).max(5),
    seniority: senioritySchema.nullable(),
    skills: z.array(profileValueSchema).max(50),
    country: profileValueSchema.nullable(),
    city: profileValueSchema.nullable(),
    remoteModes: z.array(remoteModeSchema).max(3),
    salaryMinUsdYear: z.number().finite().min(0).max(10_000_000).nullable(),
  })
  .strict();

function hasCaseInsensitiveDuplicates(values: readonly string[]): boolean {
  return new Set(values.map((value) => value.trim().toLocaleLowerCase("en-US"))).size !== values.length;
}

function addUniquenessChecks(
  profile: z.infer<typeof profileFieldsSchema>,
  context: z.RefinementCtx,
): void {
  if (hasCaseInsensitiveDuplicates(profile.preferredRoles)) {
    context.addIssue({ code: "custom", message: "Preferred roles must be unique", path: ["preferredRoles"] });
  }
  if (hasCaseInsensitiveDuplicates(profile.skills)) {
    context.addIssue({ code: "custom", message: "Skills must be unique", path: ["skills"] });
  }
  if (new Set(profile.remoteModes).size !== profile.remoteModes.length) {
    context.addIssue({ code: "custom", message: "Remote modes must be unique", path: ["remoteModes"] });
  }
}

export const profileInputSchema = profileFieldsSchema.superRefine(addUniquenessChecks);
export const userProfileSchema = profileFieldsSchema
  .extend({
    version: z.number().int().positive(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .strict()
  .superRefine(addUniquenessChecks);

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export const profileQueryKey = ["user", "profile"] as const;

export interface ProfileApi {
  getProfile(): Promise<UserProfile | null>;
  saveProfile(input: ProfileInput): Promise<UserProfile>;
}

export function createProfileApi(adapter: TauriAdapter): ProfileApi {
  return {
    async getProfile() {
      try {
        return userProfileSchema.nullable().parse(await adapter.invoke("get_profile"));
      } catch (error) {
        if (error instanceof z.ZodError) throw error;
        const parsed = ipcErrorSchema.safeParse(error);
        throw parsed.success ? parsed.data : { code: "internal" as const };
      }
    },
    async saveProfile(input) {
      const request = profileInputSchema.parse(input);
      try {
        return userProfileSchema.parse(await adapter.invoke("save_profile", { request }));
      } catch (error) {
        if (error instanceof z.ZodError) throw error;
        const parsed = ipcErrorSchema.safeParse(error);
        throw parsed.success ? parsed.data : { code: "internal" as const };
      }
    },
  };
}

const profileApi = createProfileApi(tauriAdapter);

export const getProfile = profileApi.getProfile;
export const saveProfile = profileApi.saveProfile;
