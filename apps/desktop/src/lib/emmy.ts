import { z } from "zod";

import {
  jobIdSchema,
  jobSummarySchema,
  searchCursorSchema,
  searchQuerySchema,
} from "@/lib/catalog";
import { matchBreakdownSchema } from "@/lib/match";
import { tauriAdapter } from "@/lib/tauri/adapter";
import type { TauriAdapter, Unlisten } from "@/lib/tauri/adapter";

const localIdSchema = z.string().regex(/^[a-f0-9]{32}$/u);
const textSchema = z.string().trim().min(1).max(4_000);

const emmyStateSchema = z.enum([
  "idle",
  "listening",
  "thinking",
  "searching",
  "success",
  "empty",
  "error",
  "offline",
]);
export const emmyProviderSchema = z.enum(["groq", "gemini", "openrouter", "cerebras"]);
const emmyMessageRoleSchema = z.enum(["user", "assistant", "tool"]);
const llmErrorSchema = z.discriminatedUnion("code", [
  z.object({ code: z.literal("rate_limit"), retryAfterSeconds: z.number().int().nonnegative().nullable() }).strict(),
  z.object({ code: z.literal("timeout") }).strict(),
  z.object({ code: z.literal("transport") }).strict(),
  z.object({ code: z.literal("schema") }).strict(),
  z.object({ code: z.literal("unavailable") }).strict(),
  z.object({ code: z.literal("tool_limit") }).strict(),
  z.object({ code: z.literal("invalid_request") }).strict(),
  z.object({ code: z.literal("local") }).strict(),
]);

const emmySearchQuerySchema = searchQuerySchema
  .extend({
    salaryMinUsdYear: z.number().finite().min(0).max(10_000_000).nullable().optional(),
    cursor: searchCursorSchema.nullable().optional(),
  })
  .strict();

export const emmyToolCallSchema = z.discriminatedUnion("name", [
  z.object({ name: z.literal("search_jobs"), args: emmySearchQuerySchema }).strict(),
  z.object({ name: z.literal("get_job"), args: z.object({ jobId: jobIdSchema }).strict() }).strict(),
  z.object({
    name: z.literal("compare_jobs"),
    args: z.object({
      jobIds: z.array(jobIdSchema).min(2).max(4)
        .refine((items) => new Set(items).size === items.length),
    }).strict(),
  }).strict(),
  z.object({
    name: z.literal("get_match_breakdown"),
    args: z.object({ jobId: jobIdSchema }).strict(),
  }).strict(),
  z.object({
    name: z.literal("set_shortlist"),
    args: z.object({ jobId: jobIdSchema, saved: z.boolean() }).strict(),
  }).strict(),
]);

const emmyResponseSchema = z
  .object({
    message: textSchema,
    jobCards: z.array(jobIdSchema).max(8).refine((items) => new Set(items).size === items.length),
    quickReplies: z.array(z.string().trim().min(1).max(100)).max(4),
    mascotState: z.enum(["idle", "success", "empty", "error", "offline"]),
  })
  .strict();

export const emmyModelOutputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("response"), payload: emmyResponseSchema }).strict(),
  z.object({ type: z.literal("tool_call"), payload: emmyToolCallSchema }).strict(),
]);

const emmyJobSnapshotSchema = z
  .object({
    summary: jobSummarySchema,
    employmentType: z.enum([
      "full_time",
      "contract",
      "part_time",
      "internship",
      "temporary",
      "volunteer",
      "other",
    ]).nullable(),
    salaryUsdYear: z.number().finite().nonnegative().nullable(),
    skills: z.array(z.string()).max(20),
    descriptionExcerpt: z.string().max(1_201),
  })
  .strict();

const emmyComparisonSchema = z
  .object({
    rows: z.array(z.object({
      job: emmyJobSnapshotSchema,
      matchBreakdown: matchBreakdownSchema.nullable(),
    }).strict()).min(2).max(4),
  })
  .strict();

const shortlistConfirmationStatusSchema = z.enum([
  "pending",
  "confirmed",
  "cancelled",
]);
const shortlistPreviewSchema = z
  .object({
    confirmationId: localIdSchema,
    job: jobSummarySchema,
    saved: z.boolean(),
    status: shortlistConfirmationStatusSchema,
  })
  .strict();

const emmyToolResultSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("search_jobs"),
    items: z.array(jobSummarySchema).max(8),
    total: z.number().int().nonnegative().nullable(),
  }).strict(),
  z.object({ type: z.literal("get_job"), job: emmyJobSnapshotSchema }).strict(),
  z.object({ type: z.literal("compare_jobs"), comparison: emmyComparisonSchema }).strict(),
  z.object({
    type: z.literal("get_match_breakdown"),
    jobId: jobIdSchema,
    breakdown: matchBreakdownSchema.nullable(),
  }).strict(),
  z.object({ type: z.literal("set_shortlist"), preview: shortlistPreviewSchema }).strict(),
]);

const emmyMessageContentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("user"), text: textSchema }).strict(),
  z.object({
    type: z.literal("assistant"),
    text: textSchema,
    jobCards: z.array(jobSummarySchema).max(8),
    quickReplies: z.array(z.string().trim().min(1).max(100)).max(4),
    comparison: emmyComparisonSchema.nullable(),
  }).strict(),
  z.object({ type: z.literal("notice"), error: llmErrorSchema }).strict(),
  z.object({
    type: z.literal("tool"),
    call: emmyToolCallSchema,
    result: emmyToolResultSchema,
  }).strict(),
]);

const emmyMessageSchema = z
  .object({
    id: localIdSchema,
    conversationId: localIdSchema,
    role: emmyMessageRoleSchema,
    content: emmyMessageContentSchema,
    createdAt: z.string().min(1),
  })
  .strict();

const emmyConversationSummarySchema = z
  .object({
    id: localIdSchema,
    title: z.string().trim().min(1).max(60),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .strict();
const emmyConversationSchema = z
  .object({
    conversation: emmyConversationSummarySchema,
    messages: z.array(emmyMessageSchema).max(500),
  })
  .strict();
const conversationListSchema = z.array(emmyConversationSummarySchema).max(8);

const emmyTurnResultSchema = z
  .object({
    conversationId: localIdSchema,
    messages: z.array(emmyMessageSchema).max(7),
    state: emmyStateSchema,
    provider: emmyProviderSchema.nullable(),
    error: llmErrorSchema.nullable(),
  })
  .strict();

const emmyProviderConfigurationSchema = z
  .object({
    provider: emmyProviderSchema,
    configured: z.boolean(),
    byokConfigured: z.boolean(),
    demoAvailable: z.boolean(),
  })
  .strict();
export const emmyConfigurationSchema = z
  .object({
    available: z.boolean(),
    providers: z.array(emmyProviderConfigurationSchema).length(4),
  })
  .strict();
const emmyStateEventSchema = z
  .object({
    state: emmyStateSchema,
    tool: z.enum([
      "search_jobs",
      "get_job",
      "compare_jobs",
      "get_match_breakdown",
      "set_shortlist",
    ]).nullable(),
    step: z.number().int().min(0).max(4),
  })
  .strict();

export type EmmyState = z.infer<typeof emmyStateSchema>;
export type EmmyProvider = z.infer<typeof emmyProviderSchema>;
export type LlmError = z.infer<typeof llmErrorSchema>;
export type EmmyToolCall = z.infer<typeof emmyToolCallSchema>;
export type EmmyToolResult = z.infer<typeof emmyToolResultSchema>;
export type EmmyMessage = z.infer<typeof emmyMessageSchema>;
export type EmmyComparison = z.infer<typeof emmyComparisonSchema>;
export type ShortlistPreview = z.infer<typeof shortlistPreviewSchema>;
type EmmyConversationSummary = z.infer<typeof emmyConversationSummarySchema>;
export type EmmyConversation = z.infer<typeof emmyConversationSchema>;
export type EmmyTurnResult = z.infer<typeof emmyTurnResultSchema>;
type EmmyConfiguration = z.infer<typeof emmyConfigurationSchema>;
export type EmmyStateEvent = z.infer<typeof emmyStateEventSchema>;

const sendRequestSchema = z.object({
  conversationId: localIdSchema.optional(),
  text: textSchema,
}).strict();
const confirmationRequestSchema = z.object({
  conversationId: localIdSchema,
  confirmationId: localIdSchema,
  confirmed: z.boolean(),
}).strict();
const providerKeySchema = z.string().trim().min(8).max(512);

function closedError(error: unknown): LlmError {
  const parsed = llmErrorSchema.safeParse(error);
  return parsed.success ? parsed.data : { code: "local" };
}

interface EmmyApi {
  getConfiguration(): Promise<EmmyConfiguration>;
  setProviderKey(provider: EmmyProvider, key: string): Promise<EmmyConfiguration>;
  clearProviderKey(provider: EmmyProvider): Promise<EmmyConfiguration>;
  listConversations(): Promise<EmmyConversationSummary[]>;
  createConversation(): Promise<EmmyConversation>;
  loadConversation(conversationId: string): Promise<EmmyConversation>;
  sendMessage(input: { conversationId?: string; text: string }): Promise<EmmyTurnResult>;
  confirmShortlist(input: {
    conversationId: string;
    confirmationId: string;
    confirmed: boolean;
  }): Promise<EmmyTurnResult>;
  watchState(onState: (state: EmmyStateEvent) => void): Promise<Unlisten>;
}

export function createEmmyApi(adapter: TauriAdapter): EmmyApi {
  async function invokeValidated<T>(
    command: string,
    schema: z.ZodType<T>,
    args?: Record<string, unknown>,
  ): Promise<T> {
    try {
      return schema.parse(await adapter.invoke(command, args));
    } catch (error) {
      if (error instanceof z.ZodError) throw error;
      throw closedError(error);
    }
  }

  return {
    async getConfiguration() {
      if (!adapter.isAvailable()) {
        return emmyConfigurationSchema.parse({
          available: false,
          providers: emmyProviderSchema.options.map((provider) => ({
            provider,
            configured: false,
            byokConfigured: false,
            demoAvailable: false,
          })),
        });
      }
      return invokeValidated("emmy_configuration", emmyConfigurationSchema);
    },
    async setProviderKey(provider, key) {
      const request = { provider: emmyProviderSchema.parse(provider), key: providerKeySchema.parse(key) };
      if (!adapter.isAvailable()) throw { code: "unavailable" } satisfies LlmError;
      return invokeValidated("emmy_set_provider_key", emmyConfigurationSchema, { request });
    },
    async clearProviderKey(provider) {
      const request = { provider: emmyProviderSchema.parse(provider) };
      if (!adapter.isAvailable()) throw { code: "unavailable" } satisfies LlmError;
      return invokeValidated("emmy_clear_provider_key", emmyConfigurationSchema, { request });
    },
    async listConversations() {
      if (!adapter.isAvailable()) return [];
      return invokeValidated("emmy_list_conversations", conversationListSchema);
    },
    async createConversation() {
      if (!adapter.isAvailable()) throw { code: "unavailable" } satisfies LlmError;
      return invokeValidated("emmy_create_conversation", emmyConversationSchema);
    },
    async loadConversation(conversationId) {
      const request = { conversationId: localIdSchema.parse(conversationId) };
      if (!adapter.isAvailable()) throw { code: "unavailable" } satisfies LlmError;
      return invokeValidated("emmy_load_conversation", emmyConversationSchema, { request });
    },
    async sendMessage(input) {
      const request = sendRequestSchema.parse(input);
      if (!adapter.isAvailable()) throw { code: "unavailable" } satisfies LlmError;
      return invokeValidated("emmy_send_message", emmyTurnResultSchema, { request });
    },
    async confirmShortlist(input) {
      const request = confirmationRequestSchema.parse(input);
      if (!adapter.isAvailable()) throw { code: "unavailable" } satisfies LlmError;
      return invokeValidated("emmy_confirm_shortlist", emmyTurnResultSchema, { request });
    },
    async watchState(onState) {
      if (!adapter.isAvailable()) return () => undefined;
      return adapter.listen("emmy://state", (payload) => {
        const parsed = emmyStateEventSchema.safeParse(payload);
        if (parsed.success) onState(parsed.data);
      });
    },
  };
}

export const emmyApi = createEmmyApi(tauriAdapter);
