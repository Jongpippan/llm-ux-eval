import { surveyAnswerSchema, type LlmSurveyAnswer } from "@/lib/schema/llmAction";
import { LlmClient, withRetry, extractJson } from "@/simulation/llm/client";
import type { SimConfig } from "@/simulation/config";
import { describePersona, type Persona } from "@/simulation/persona";
import { MemoryStream } from "@/simulation/memory";

/**
 * UXAgent 식 Agent Interview.
 *
 * 과업 종료 후, persona 와 전체 reasoning trace(memory)를 근거로 연구자가 인터뷰하듯 질문해
 * human 과 **동일한 3문항(난이도/만족도/확신도, 1~5)** 의 자기보고를 받는다.
 * 고정 숫자를 강요하지 않으므로 persona·조건(A/B)·실제 경험에 따라 자연스러운 변동이 생긴다.
 */
export async function conductInterview(
  config: SimConfig,
  client: LlmClient,
  persona: Persona,
  memory: MemoryStream,
  variant: "A" | "B",
  finalChoiceId: string | null
): Promise<LlmSurveyAnswer> {
  const trace = MemoryStream.format(memory.all());
  const prompt = [
    describePersona(persona),
    "",
    `방금 웹 인터페이스(UI ${variant})에서 무선 이어폰을 고르는 과업을 마쳤습니다.`,
    variant === "B"
      ? "이 화면에는 후보를 비교 영역에 담아 값을 나란히 보고 속성별 우열을 강조해주는 비교 기능이 있었습니다."
      : "이 화면에는 비교 기능이 없어 각 후보 카드를 개별적으로 살펴봐야 했습니다.",
    finalChoiceId ? `당신의 최종 선택: ${finalChoiceId}` : "",
    "",
    "아래는 과업을 수행하는 동안 당신이 실제로 관찰하고 생각한 기록(think-aloud)입니다:",
    trace,
    "",
    "이제 사용성 연구자가 인터뷰를 합니다. 위 경험을 떠올리며 당신의 persona 답게, 솔직하게 답하세요.",
    "다음 세 가지를 1~5 정수로 자기보고하세요(미리 정해진 숫자/평균값을 내지 말고, 실제로 어떻게 느꼈는지에 근거):",
    "  · difficulty: 이 과업의 수행 난이도는 어땠나요? (1=매우 쉬움 … 5=매우 어려움)",
    "  · satisfaction: 인터페이스 사용 만족도는 어땠나요? (1=매우 불만족 … 5=매우 만족)",
    "  · confidence: 내 최종 선택에 대한 확신도는 어느 정도인가요? (1=전혀 확신 못 함 … 5=매우 확신)",
    "freeText 에는 그렇게 답한 이유를 당신의 말투로 1~2문장 적으세요.",
    '출력은 오직 JSON 하나: {"difficulty":N,"satisfaction":N,"confidence":N,"freeText":"..."} (마크다운/설명 금지).',
  ]
    .filter(Boolean)
    .join("\n");

  return withRetry(
    async () => {
      const raw = await client.rawComplete(prompt, {
        maxTokens: 400,
        // 자기보고는 persona/경험 기반 변동을 허용하되 과하지 않게.
        temperature: Math.max(config.temperature, 0.7),
      });
      return surveyAnswerSchema.parse(extractJson(raw));
    },
    config,
    "interview"
  );
}
