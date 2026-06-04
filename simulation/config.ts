/** 시뮬레이션 설정. env 기반. 키 없으면 mock. */
export interface SimConfig {
  baseUrl: string;
  variant: "A" | "B";
  participant: "llm";
  scenarioId: string;
  provider: "anthropic" | "openai" | "mock";
  /** 명시 participant_id (CLI --participant-id=). 없으면 intro/session 이 dev-id 자동생성. */
  participantId?: string;
  /** LLM sampling temperature (LLM_TEMPERATURE, 기본 0.2 — 재현성 위해 낮게). */
  temperature: number;
  maxSteps: number;
  headless: boolean;
  /** LLM 호출 429/오류 시 최대 재시도 횟수 (LLM_MAX_RETRIES). */
  maxRetries: number;
  /** 재시도 기본 backoff ms (LLM_RETRY_BASE_MS). 응답의 retry-after 가 있으면 그것을 우선. */
  retryBaseMs: number;
  /** LLM 호출 사이 최소 간격 ms (LLM_CALL_DELAY_MS). Groq 무료 TPM 회피용 페이싱. */
  callDelayMs: number;
  /**
   * 실제 LLM 실패 시 mock 으로 대체할지 여부 (LLM_ALLOW_MOCK_FALLBACK).
   * 기본 false: clean LLM run 수집이 목적이라 fallback 을 섞지 않고 실패 시 run 을 중단한다.
   * true(개발용): 실패 step 을 mock 으로 채우되 used_mock_fallback=true / is_clean_llm_run=false 로 표시.
   */
  allowMockFallback: boolean;
}

function detectProvider(): SimConfig["provider"] {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (explicit === "anthropic" || explicit === "openai" || explicit === "mock") {
    return explicit;
  }
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "mock";
}

export function loadConfig(): SimConfig {
  const argv = process.argv.slice(2);
  const get = (flag: string, def?: string) => {
    const hit = argv.find((a) => a.startsWith(`--${flag}=`));
    return hit ? hit.split("=")[1] : def;
  };
  const variant = (get("variant", "A") === "B" ? "B" : "A") as "A" | "B";
  const num = (v: string | undefined, def: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };
  return {
    baseUrl: process.env.SIM_BASE_URL ?? get("baseUrl", "http://localhost:3000")!,
    variant,
    participant: "llm",
    scenarioId: get("scenario", "s1")!,
    provider: detectProvider(),
    participantId: get("participant-id"),
    temperature: num(process.env.LLM_TEMPERATURE, 0.2),
    maxSteps: Number(get("maxSteps", "40")),
    headless: get("headless", "true") !== "false",
    maxRetries: num(process.env.LLM_MAX_RETRIES, 3),
    retryBaseMs: num(process.env.LLM_RETRY_BASE_MS, 5000),
    callDelayMs: num(process.env.LLM_CALL_DELAY_MS, 0),
    allowMockFallback: process.env.LLM_ALLOW_MOCK_FALLBACK === "true",
  };
}
