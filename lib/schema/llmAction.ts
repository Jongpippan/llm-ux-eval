import { z } from "zod";

/**
 * LLM(또는 mock) agent가 매 스텝 반환하는 action JSON 스키마.
 * stateExtractor가 준 state를 보고 이 형식 중 하나를 반환한다.
 * actionExecutor가 type별로 data-testid 요소를 조작한다.
 */

export const surveyAnswerSchema = z.object({
  difficulty: z.number().int().min(1).max(5),
  satisfaction: z.number().int().min(1).max(5),
  confidence: z.number().int().min(1).max(5),
  freeText: z.string().optional(),
});

export const llmActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), target_id: z.string() }),
  z.object({ type: z.literal("compare_add"), target_id: z.string() }),
  z.object({ type: z.literal("compare_remove"), target_id: z.string() }),
  z.object({ type: z.literal("view_compare") }),
  z.object({ type: z.literal("select_final"), target_id: z.string() }),
  z.object({ type: z.literal("answer_survey"), answer: surveyAnswerSchema }),
  z.object({ type: z.literal("finish") }),
]);

export type LlmAction = z.infer<typeof llmActionSchema>;
export type LlmActionType = LlmAction["type"];
export type LlmSurveyAnswer = z.infer<typeof surveyAnswerSchema>;

export const LLM_ACTION_TYPES: LlmActionType[] = [
  "click",
  "compare_add",
  "compare_remove",
  "view_compare",
  "select_final",
  "answer_survey",
  "finish",
];
