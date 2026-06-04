import { z } from "zod";

export const logEventTypeSchema = z.enum([
  "experiment_start",
  "view_condition",
  "click_candidate",
  "open_detail",
  "compare_add",
  "compare_remove",
  "view_compare",
  "select_final",
  "answer_survey",
  "finish",
]);

export const stepNameSchema = z.enum([
  "intro",
  "task",
  "explore",
  "detail",
  "compare",
  "survey",
  "complete",
]);

export const logEventSchema = z.object({
  // --- 필수 8개 (기존) ---
  event_type: logEventTypeSchema,
  timestamp: z.number(),
  ui_variant: z.enum(["A", "B"]),
  participant_type: z.enum(["human", "llm"]),
  session_id: z.string().min(1),
  target_id: z.string().nullable(),
  action_detail: z.record(z.unknown()).default({}),
  elapsed_ms: z.number(),
  // --- 추가 분석 필드 (모두 optional + nullable) ---
  participant_id: z.string().nullable().optional(),
  step_name: stepNameSchema.nullable().optional(),
  candidate_id: z.string().nullable().optional(),
  candidate_position: z.number().nullable().optional(),
  compare_count: z.number().nullable().optional(),
  current_compare_ids: z.array(z.string()).nullable().optional(),
  final_selected_candidate_id: z.string().nullable().optional(),
  survey_difficulty: z.number().nullable().optional(),
  survey_satisfaction: z.number().nullable().optional(),
  survey_confidence: z.number().nullable().optional(),
});

export type LogEventSchema = z.infer<typeof logEventSchema>;

/** API route(/api/log)가 받는 payload. 단일 또는 배열 모두 허용. */
export const logEventPayloadSchema = z.union([
  logEventSchema,
  z.array(logEventSchema),
]);
