import type { LlmAction } from "@/lib/schema/llmAction";
import { llmActionSchema } from "@/lib/schema/llmAction";
import type { ScreenState } from "@/simulation/stateExtractor";
import type { SimConfig } from "@/simulation/config";
import { LlmClient, withRetry, extractJson } from "@/simulation/llm/client";

/**
 * generic LLM agent (AGENT_ARCH=generic). 매 step 상태 JSON 을 보고 action JSON 1개를 받는다.
 *
 * 이 경로는 UXAgent 식 PersonaAgent 도입 이후에도 **baseline 으로 보존**된다(persona/memory 없음).
 * clean run 정책: mock 자동 fallback 안 함 — 재시도 후에도 실패하면 throw, run.ts 가 정책 결정.
 */
export class LlmAgent {
  private config: SimConfig;
  private client: LlmClient;

  constructor(config: SimConfig) {
    this.config = config;
    this.client = new LlmClient(config);
  }

  /** 사용 중인 모델명(로깅/provenance 용). 키 값은 포함하지 않는다. */
  modelName(): string {
    return this.client.modelName();
  }

  /** 다음 action 을 결정. 429/오류/스키마위반 시 재시도, 그래도 실패하면 throw(mock fallback 안 함). */
  async decide(state: ScreenState): Promise<LlmAction> {
    const prompt = this.buildPrompt(state);
    return withRetry(
      async () => {
        const raw = await this.client.rawComplete(prompt, { maxTokens: 256 });
        return llmActionSchema.parse(extractJson(raw));
      },
      this.config,
      "llmAgent"
    );
  }

  private buildPrompt(state: ScreenState): string {
    const ids = state.candidates.map((c) => c.id);
    const h = state.history;
    return [
      "You are simulating a real user performing a usability task on a web UI.",
      "Reply with ONLY a single JSON object (no prose, no markdown fences) for the next action.",
      "Allowed action types and their REQUIRED fields:",
      '- {"type":"click","target_id":"<candidate id>"}    (focus/inspect a candidate; all info is already shown on every card)',
      '- {"type":"compare_add","target_id":"<candidate id>"}      (UI B only)',
      '- {"type":"compare_remove","target_id":"<candidate id>"}   (UI B only)',
      '- {"type":"view_compare"}                                   (UI B only)',
      '- {"type":"select_final","target_id":"<candidate id>"}',
      '- {"type":"answer_survey","answer":{"difficulty":1-5,"satisfaction":1-5,"confidence":1-5}}',
      '- {"type":"finish"}',
      "RULES:",
      "- `target_id` is REQUIRED for click/compare_add/compare_remove/select_final and MUST be exactly one of the candidate ids listed below. Do not invent fields or ids.",
      "- Each entry in `candidates` includes its full attributes (price KRW, rating, battery_hours, weight_g, noise_cancel, water_resistant, warranty_months, codec) — the SAME information a participant sees on every card, for ALL candidates at once. Weigh the relevant attributes across ALL candidates per the task conditions (see scenarioText) before deciding. Clicking is optional (it does not reveal new info); do not click the same candidate repeatedly. When you have weighed the options, select_final, then answer_survey, then finish.",
      `- This is UI ${state.variant}. ${
        state.variant === "B"
          ? "You MAY use the comparison feature (compare_add / view_compare) but it is NOT required."
          : "There is NO comparison feature; do NOT attempt compare_add/compare_remove/view_compare."
      }`,
      "- Choose the single next action a thoughtful user would take. Do not force any particular candidate.",
      "- SURVEY: when step is `survey`, output answer_survey with your genuine post-task self-report, rated from your OWN experience of THIS task/interface. Use the SAME items/scale the human sees (below). Do not output preset/fixed numbers, and do not artificially vary — just report how it actually felt to you:",
      "    · difficulty (이 과업의 수행 난이도는 어땠나요?) — 1=낮음 … 5=높음",
      "    · satisfaction (인터페이스 사용 만족도는 어땠나요?) — 1=낮음 … 5=높음",
      "    · confidence (내 최종 선택에 대한 확신도는 어느 정도인가요?) — 1=낮음 … 5=높음",
      `current_step: ${state.step}`,
      `already_viewed_candidate_ids: ${JSON.stringify(h?.already_viewed_candidate_ids ?? [])}`,
      `recent_actions: ${JSON.stringify(h?.recent_actions ?? [])}`,
      `selected_compare_ids: ${JSON.stringify(state.compareTrayIds)}`,
      `remaining_reasonable_actions: ${JSON.stringify(state.availableActions)}`,
      `candidate ids you may use as target_id: ${JSON.stringify(ids)}`,
      "Current state JSON:",
      JSON.stringify(state, null, 2),
    ].join("\n");
  }
}
