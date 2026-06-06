import type { LlmAction } from "@/lib/schema/llmAction";
import { llmActionSchema } from "@/lib/schema/llmAction";
import { z } from "zod";
import type { ScreenState } from "@/simulation/stateExtractor";
import type { SimConfig } from "@/simulation/config";
import { LlmClient, withRetry, extractJson } from "@/simulation/llm/client";
import { describePersona, type Persona } from "@/simulation/persona";
import { MemoryStream, type MemoryEntry } from "@/simulation/memory";
import { conductInterview } from "@/simulation/interview";

/**
 * UXAgent 식 PersonaAgent (AGENT_ARCH=uxagent).
 *
 * persona 와 Memory Stream 을 가지고 매 step:
 *  - Perception+Planning+Action 을 1회 LLM 호출로 결합 산출({observation, plan, action})
 *    (UXAgent 의 Perception/Planning/Action 모듈을 단일 동기 호출로 결합 — 단순화, 논문에 명시)
 *  - 일정 주기마다 Reflection(slow loop): 최근 기억을 종합한 고수준 통찰을 memory 에 추가
 *  - survey 단계: 고정 숫자 대신 Agent Interview(persona+trace 근거)로 3문항 자기보고
 *
 * 행동 어휘/스키마는 generic 경로와 동일(llmActionSchema). 변동은 persona 다양성에서 발생.
 * clean run 정책: 실패 시 throw → run.ts 가 정책 결정(mock 자동 fallback 안 함).
 */

const planResultSchema = z.object({
  observation: z.string(),
  plan: z.string(),
  action: z.unknown(),
});

export class PersonaAgent {
  private config: SimConfig;
  private client: LlmClient;
  private persona: Persona;
  private memory = new MemoryStream();
  private exploreSteps = 0;
  private reflectEvery: number;

  constructor(config: SimConfig, persona: Persona, client?: LlmClient) {
    this.config = config;
    this.persona = persona;
    this.client = client ?? new LlmClient(config);
    this.reflectEvery = Math.max(0, config.reflectEvery);
  }

  modelName(): string {
    return this.client.modelName();
  }

  /** run.ts 가 종료 후 reasoning trace(think-aloud)를 디스크에 저장하도록 노출. */
  exportTrace(): { persona_id: string; entries: MemoryEntry[] } {
    return { persona_id: this.persona.id, entries: this.memory.all() };
  }

  async decide(state: ScreenState): Promise<LlmAction> {
    if (state.step === "survey") {
      const answer = await conductInterview(
        this.config,
        this.client,
        this.persona,
        this.memory,
        state.variant,
        state.finalSelectedId ? "selected" : null
      );
      this.memory.add({
        step: this.exploreSteps,
        type: "reflection",
        text: `설문 자기보고: 난이도 ${answer.difficulty}/만족 ${answer.satisfaction}/확신 ${answer.confidence}. ${answer.freeText ?? ""}`.trim(),
        importance: 7,
      });
      return { type: "answer_survey", answer };
    }

    if (state.step === "complete") {
      return { type: "finish" };
    }

    // explore: 필요 시 reflection(slow loop) 먼저, 그다음 perception+planning+action
    this.exploreSteps += 1;
    if (this.reflectEvery > 0 && this.exploreSteps > 1 && this.exploreSteps % this.reflectEvery === 0) {
      await this.reflect(state).catch((e) =>
        console.warn(`[personaAgent] reflection skipped: ${String(e).slice(0, 120)}`)
      );
    }

    const query = this.contextQuery(state);
    const retrieved = this.memory.retrieve(query, 6);
    const prompt = this.buildPlanPrompt(state, retrieved);

    const action = await withRetry(
      async () => {
        const raw = await this.client.rawComplete(prompt, { maxTokens: 600 });
        const parsed = planResultSchema.parse(extractJson(raw));
        const act = llmActionSchema.parse(parsed.action);
        // 기억 적재: 관찰 → 계획 → 행동
        this.memory.add({ step: this.exploreSteps, type: "observation", text: parsed.observation, importance: 4 });
        this.memory.add({ step: this.exploreSteps, type: "plan", text: parsed.plan, importance: 6 });
        this.memory.add({
          step: this.exploreSteps,
          type: "action",
          text: "target_id" in act ? `${act.type}: ${act.target_id}` : act.type,
          importance: 5,
        });
        return act;
      },
      this.config,
      "personaAgent"
    );
    return action;
  }

  /** 현재 화면의 핵심을 메모리 회수용 query 로 요약. */
  private contextQuery(state: ScreenState): string {
    const names = state.candidates.map((c) => c.name).join(" ");
    const recent = state.history?.recent_actions?.join(" ") ?? "";
    return `${state.variant} ${names} ${recent}`;
  }

  /** Slow loop: 최근 기억을 종합한 고수준 통찰을 생성해 memory 에 추가. */
  private async reflect(state: ScreenState): Promise<void> {
    const recent = this.memory.retrieve(this.contextQuery(state), 8);
    if (recent.length === 0) return;
    const prompt = [
      describePersona(this.persona),
      "",
      "지금까지 무선 이어폰 고르기 과업을 수행하며 관찰·생각한 기록입니다:",
      MemoryStream.format(recent),
      "",
      "이 기록을 종합해, 당신의 현재 선호와 다음 전략에 대한 고수준 통찰을 한국어 1~2문장으로 적으세요.",
      "(예: 어떤 속성을 가장 중시하게 됐는지, 어떤 후보가 유력한지, 무엇을 더 확인할지)",
      '출력은 JSON 하나: {"insight":"..."} (설명/마크다운 금지).',
    ].join("\n");
    const insightSchema = z.object({ insight: z.string() });
    const { insight } = await withRetry(
      async () => insightSchema.parse(extractJson(await this.client.rawComplete(prompt, { maxTokens: 250 }))),
      this.config,
      "reflection"
    );
    this.memory.add({ step: this.exploreSteps, type: "reflection", text: insight, importance: 8 });
  }

  private buildPlanPrompt(state: ScreenState, retrieved: MemoryEntry[]): string {
    const ids = state.candidates.map((c) => c.id);
    const h = state.history;
    // step 예산의 절반을 넘기면 무한 탐색/루프를 막기 위해 종료(select_final)를 강하게 유도한다.
    const budget = this.config.maxSteps;
    const half = Math.floor(budget * 0.5);
    const urgency =
      this.exploreSteps >= half
        ? `- ⚠️ 당신은 이미 ${this.exploreSteps} step 탐색했습니다(상한 ${budget}). 충분히 봤습니다. **같은 후보를 다시 클릭하지 말고**, 지금까지 본 정보로 당신의 우선순위에 가장 맞는 후보를 **이번 step 에 select_final** 하세요.`
        : "- 같은 후보를 반복해서 클릭하지 마세요(클릭해도 새 정보는 없습니다). 핵심 후보 몇 개만 확인하면 충분합니다.";
    return [
      describePersona(this.persona),
      "",
      "당신은 위 persona 로서 웹 인터페이스에서 무선 이어폰을 고르는 사용성 과업을 수행 중입니다.",
      "당신답게(이 persona 의 성향·우선순위·인내심에 맞게) 행동하세요. 단, 과업의 하드 조건은 누구에게나 공통입니다:",
      "  · ANC(노이즈 캔슬링) 지원 + 가격 150,000원 이하 후보 중에서 고를 것.",
      "  · 가격↓ / 재생시간↑ / 무게↓ 등은 서로 상충하므로 당신의 우선순위대로 가중해 판단할 것(절대 정답 없음).",
      "",
      "지금까지의 기억(관찰/계획/반성 중 관련된 것):",
      MemoryStream.format(retrieved),
      "",
      "다음 한 단계의 행동을 고르세요. 출력은 오직 JSON 하나(마크다운/설명 금지):",
      '{"observation":"지금 화면에서 당신이 주목한 점(한국어 1문장)",',
      ' "plan":"당신의 우선순위에 비춘 다음 의도(한국어 1문장)",',
      ' "action": <아래 중 하나> }',
      "action 형식:",
      '- {"type":"click","target_id":"<candidate id>"}    (카드를 주목/검토; 모든 정보는 이미 카드에 표시됨)',
      '- {"type":"compare_add","target_id":"<candidate id>"}      (UI B 전용)',
      '- {"type":"compare_remove","target_id":"<candidate id>"}   (UI B 전용)',
      '- {"type":"view_compare"}                                   (UI B 전용)',
      '- {"type":"select_final","target_id":"<candidate id>"}',
      '- {"type":"finish"}',
      "RULES:",
      "- `target_id` 는 click/compare_add/compare_remove/select_final 에 필수이며 아래 candidate ids 중 하나여야 함. 필드/ID 지어내기 금지.",
      "- 각 candidate 는 전체 속성(price KRW, rating, battery_hours, weight_g, noise_cancel, water_resistant, warranty_months, codec)을 포함하며, 이는 참가자가 카드에서 보는 정보와 동일합니다(14개 후보 전체를 한눈에). 클릭은 선택(새 정보 안 나옴); 같은 후보 반복 클릭 금지.",
      `- 이것은 UI ${state.variant} 입니다. ${
        state.variant === "B"
          ? "비교 기능(compare_add / view_compare)을 써도 되고 안 써도 됩니다 — 당신 성향대로."
          : "비교 기능이 없습니다. compare_add/compare_remove/view_compare 시도 금지."
      }`,
      "- 충분히 따져봤다면 select_final 하세요. 그 다음 단계(설문)는 자동으로 진행됩니다.",
      urgency,
      `current_step: ${state.step}`,
      `already_viewed_candidate_ids: ${JSON.stringify(h?.already_viewed_candidate_ids ?? [])}`,
      `recent_actions: ${JSON.stringify(h?.recent_actions ?? [])}`,
      `selected_compare_ids: ${JSON.stringify(state.compareTrayIds)}`,
      `candidate ids you may use as target_id: ${JSON.stringify(ids)}`,
      "Current state JSON:",
      JSON.stringify(state, null, 2),
    ].join("\n");
  }
}
