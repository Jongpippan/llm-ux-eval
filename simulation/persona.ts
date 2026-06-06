import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { LlmClient, withRetry, extractJson } from "@/simulation/llm/client";
import type { SimConfig } from "@/simulation/config";

/**
 * UXAgent 식 Persona Generator.
 *
 * 인구통계 분포 spec + 예시 persona 를 주고 LLM 으로 다양한 가상 사용자 persona 를 생성한다.
 * 생성 결과는 simulation/personas/ 에 저장되어 run 마다 재사용된다(재현·논문 보고용).
 *
 * 중요: persona 는 사용자가 trade-off 속성(가격/재생시간/무게/평점 등)을 **어떻게 weigh 하고**
 * 얼마나 신중히 탐색하며 자기보고하는지에만 영향을 준다. 과업의 하드 조건(ANC 지원, 예산 ≤150,000)은
 * persona 와 무관하게 모든 agent 에 공통으로 구속된다(실험 통제).
 */

export const personaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  age: z.number().int().min(18).max(80),
  gender: z.string().min(1),
  occupation: z.string().min(1),
  income_level: z.enum(["low", "middle", "high"]),
  tech_savviness: z.enum(["low", "medium", "high"]),
  patience: z.enum(["low", "medium", "high"]),
  shopping_style: z.string().min(1),
  priorities: z.string().min(1),
  bio: z.string().min(1),
});

export type Persona = z.infer<typeof personaSchema>;

const PERSONAS_DIR = path.join(process.cwd(), "simulation", "personas");

/** 인구통계 분포 spec. 예시 persona + 분포 설명을 프롬프트로 전달한다. */
export interface PersonaSpec {
  /** 대상 제품/맥락(무선 이어폰 구매). */
  context: string;
  /** 분포·다양성 가이드(연령/소득/기술친숙도/성향 등). */
  distribution: string;
  /** few-shot 예시 persona(다양성 유도용). */
  example: Persona;
}

export const DEFAULT_PERSONA_SPEC: PersonaSpec = {
  context:
    "무선 이어폰을 온라인에서 구매하려는 한국 소비자. 과업: ANC(노이즈 캔슬링) 지원 + 예산 150,000원 이하 조건을 만족하는 후보 중에서 가격/재생시간/무게 등 상충 속성을 따져 하나를 고른다.",
  distribution:
    "연령 20~60대 고루, 소득 low/middle/high 혼합, 기술 친숙도 low~high 혼합, 탐색 인내심(patience)도 다양하게. 어떤 속성을 더 중시하는지(가격 민감/배터리 중시/무게(휴대성) 중시/평점·브랜드 신뢰 중시 등)를 사람마다 다르게.",
  example: {
    id: "example",
    name: "김서연",
    age: 29,
    gender: "여성",
    occupation: "마케팅 매니저",
    income_level: "middle",
    tech_savviness: "high",
    patience: "medium",
    shopping_style: "리뷰와 스펙을 꼼꼼히 비교한 뒤 결정하는 신중형",
    priorities: "출퇴근 지하철에서 쓸 거라 ANC 성능과 배터리 지속시간을 가장 중시하고, 가격은 예산 안에서 합리적이면 됨",
    bio: "통근 시간이 길어 소음 차단이 중요한 직장인. 스펙 비교를 즐기지만 너무 오래 고민하지는 않는다.",
  },
};

function buildGenPrompt(spec: PersonaSpec, count: number, seedExample: Persona): string {
  return [
    "당신은 사용성 연구용 가상 사용자(persona)를 설계하는 도우미입니다.",
    `다음 맥락의 소비자 persona ${count}명을 서로 충분히 다르게 생성하세요.`,
    `맥락: ${spec.context}`,
    `다양성 가이드: ${spec.distribution}`,
    "각 persona 는 아래 JSON 스키마를 정확히 따르는 객체입니다(필드명/타입 엄수):",
    JSON.stringify(
      {
        id: "p01 처럼 두 자리 일련번호",
        name: "한국어 가명",
        age: "정수 18~80",
        gender: "문자열",
        occupation: "문자열",
        income_level: "low|middle|high",
        tech_savviness: "low|medium|high",
        patience: "low|medium|high",
        shopping_style: "구매 결정 방식(한 문장)",
        priorities: "이어폰에서 특히 중시하는 점(한 문장). 단, ANC 지원·예산 150,000원 이하는 모두 공통 전제이므로 그 안에서 무엇을 더 따지는지를 적을 것",
        bio: "1~2문장 내러티브",
      },
      null,
      2
    ),
    "예시(참고용, 이 사람은 결과에 포함하지 말 것):",
    JSON.stringify(seedExample, null, 2),
    `출력은 오직 JSON 객체 하나: {"personas": [ ...${count}명... ]} 형식. 마크다운/설명 금지. id 는 p01..p${String(count).padStart(2, "0")} 로 부여.`,
  ].join("\n");
}

const genResultSchema = z.object({ personas: z.array(personaSchema) });

/** LLM 으로 persona 를 생성한다(디스크 저장은 하지 않음). 다양성을 위해 example 을 seed 로 섞는다. */
export async function generatePersonas(
  config: SimConfig,
  count: number,
  spec: PersonaSpec = DEFAULT_PERSONA_SPEC
): Promise<Persona[]> {
  const client = new LlmClient(config);
  const prompt = buildGenPrompt(spec, count, spec.example);
  const result = await withRetry(
    async () => {
      const raw = await client.rawComplete(prompt, {
        // persona 1명당 ~300토큰 + 여유. count 에 비례해 출력 상한을 키운다.
        maxTokens: Math.min(12000, 1200 + count * 350),
        // 다양성이 핵심이므로 생성 단계는 temperature 를 높게.
        temperature: Math.max(config.temperature, 0.9),
      });
      return genResultSchema.parse(extractJson(raw));
    },
    config,
    "persona-gen"
  );
  // id 를 p01.. 로 정규화(LLM 이 누락/중복했을 수 있음).
  return result.personas.map((p, i) => ({ ...p, id: `p${String(i + 1).padStart(2, "0")}` }));
}

/** persona 목록을 simulation/personas/ 에 저장(개별 파일 + index.json). */
export async function savePersonas(personas: Persona[]): Promise<void> {
  await fs.mkdir(PERSONAS_DIR, { recursive: true });
  for (const p of personas) {
    await fs.writeFile(
      path.join(PERSONAS_DIR, `${p.id}.json`),
      JSON.stringify(p, null, 2),
      "utf-8"
    );
  }
  await fs.writeFile(
    path.join(PERSONAS_DIR, "index.json"),
    JSON.stringify(personas.map((p) => p.id), null, 2),
    "utf-8"
  );
}

/** 저장된 persona 1개 로드. */
export async function loadPersona(personaId: string): Promise<Persona> {
  const file = path.join(PERSONAS_DIR, `${personaId}.json`);
  const raw = await fs.readFile(file, "utf-8");
  return personaSchema.parse(JSON.parse(raw));
}

/** 저장된 persona id 목록. */
export async function listPersonaIds(): Promise<string[]> {
  try {
    const raw = await fs.readFile(path.join(PERSONAS_DIR, "index.json"), "utf-8");
    return z.array(z.string()).parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** persona 를 프롬프트에 넣을 한국어 자기소개 문자열로 직렬화. */
export function describePersona(p: Persona): string {
  return [
    `당신은 ${p.name}(${p.age}세, ${p.gender}, ${p.occupation})입니다.`,
    `소득 수준: ${p.income_level}, 기술 친숙도: ${p.tech_savviness}, 탐색 인내심: ${p.patience}.`,
    `구매 성향: ${p.shopping_style}`,
    `중시하는 점: ${p.priorities}`,
    `배경: ${p.bio}`,
  ].join("\n");
}
