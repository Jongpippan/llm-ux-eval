import type { LlmAction } from "@/lib/schema/llmAction";
import { llmActionSchema } from "@/lib/schema/llmAction";
import type { ScreenState } from "@/simulation/stateExtractor";
import type { SimConfig } from "@/simulation/config";

/**
 * 실제 LLM agent. provider(anthropic|openai-compatible)로 매 step action JSON 을 받는다.
 *
 * 중요(clean run 정책): 이 agent 는 **mock 으로 자동 fallback 하지 않는다.**
 * 429/오류/스키마 위반 시 retry/backoff 후에도 실패하면 throw 한다.
 * mock 대체 여부는 run loop(run.ts)가 LLM_ALLOW_MOCK_FALLBACK 정책에 따라 결정하고,
 * 그 경우 세션을 used_mock_fallback=true / is_clean_llm_run=false 로 표시한다.
 */

/** 429 rate-limit 전용 에러. retryAfterMs 가 있으면 backoff 에 사용. */
class RateLimitError extends Error {
  retryAfterMs?: number;
  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry-After 헤더(초) 또는 본문 "try again in Xs" 에서 대기 ms 를 추출. */
function parseRetryAfterMs(headerVal: string | null, body: string): number | undefined {
  if (headerVal) {
    const secs = Number(headerVal);
    if (Number.isFinite(secs)) return Math.ceil(secs * 1000);
  }
  const m = body.match(/try again in\s+([\d.]+)\s*s/i);
  if (m) return Math.ceil(parseFloat(m[1]) * 1000);
  return undefined;
}

export class LlmAgent {
  private config: SimConfig;
  private provider: SimConfig["provider"];

  constructor(config: SimConfig) {
    this.config = config;
    this.provider = config.provider;
  }

  /** 사용 중인 모델명(로깅/provenance 용). 키 값은 포함하지 않는다. */
  modelName(): string {
    if (this.provider === "anthropic")
      return process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest";
    if (this.provider === "openai")
      return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    return "unknown";
  }

  /**
   * 다음 action 을 결정한다. 실패 시 retry/backoff 후에도 안 되면 throw (mock fallback 안 함).
   * - 429: retry-after(or 본문 Xs) 만큼 대기 후 재시도
   * - 그 외 오류/스키마 위반: 지수 backoff(retryBaseMs * 2^attempt) 후 재시도
   */
  async decide(state: ScreenState): Promise<LlmAction> {
    const prompt = this.buildPrompt(state);
    const maxRetries = Math.max(0, this.config.maxRetries);
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const raw = await this.callProvider(prompt);
        const json = this.extractJson(raw);
        return llmActionSchema.parse(json);
      } catch (err) {
        lastErr = err;
        if (attempt >= maxRetries) break;
        const waitMs =
          err instanceof RateLimitError && err.retryAfterMs
            ? err.retryAfterMs
            : this.config.retryBaseMs * Math.pow(2, attempt);
        const kind = err instanceof RateLimitError ? "429 rate-limit" : "error";
        console.warn(
          `[llmAgent] attempt ${attempt + 1}/${maxRetries + 1} ${kind}; retry in ${waitMs}ms: ${String(err).slice(0, 160)}`
        );
        await sleep(waitMs);
      }
    }
    throw new Error(
      `LLM decide failed after ${maxRetries + 1} attempt(s): ${String(lastErr).slice(0, 200)}`
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
      "- Every card already shows ALL attribute values; you do not need to open any detail. Do NOT keep clicking the same candidate repeatedly; once you have inspected enough, proceed to select_final, then answer_survey, then finish.",
      `- This is UI ${state.variant}. ${
        state.variant === "B"
          ? "You MAY use the comparison feature (compare_add / view_compare) but it is NOT required."
          : "There is NO comparison feature; do NOT attempt compare_add/compare_remove/view_compare."
      }`,
      "- Choose the single next action a thoughtful user would take. Do not force any particular candidate.",
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

  private extractJson(raw: string): unknown {
    const match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw);
  }

  /** 실제 provider 호출. 429 → RateLimitError, 그 외 비정상 → Error. 키 값은 절대 로그/에러에 넣지 않는다. */
  private async callProvider(prompt: string): Promise<string> {
    if (this.provider === "anthropic") {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error("no ANTHROPIC_API_KEY");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.modelName(),
          max_tokens: 256,
          temperature: this.config.temperature,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) await this.throwForStatus(res);
      const data = (await res.json()) as { content?: Array<{ text?: string }> };
      return data.content?.[0]?.text ?? "";
    }
    if (this.provider === "openai") {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error("no OPENAI_API_KEY");
      // OpenAI 호환 백엔드(Groq/Ollama/OpenRouter 등)는 OPENAI_BASE_URL 로 엔드포인트를 바꾼다.
      const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: this.modelName(),
          temperature: this.config.temperature,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) await this.throwForStatus(res);
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content ?? "";
    }
    throw new Error("unknown provider");
  }

  /** 비정상 HTTP 응답을 적절한 에러로 변환. 429 는 retry-after 를 담아 RateLimitError 로. (키 미포함) */
  private async throwForStatus(res: Response): Promise<never> {
    const body = await res.text().catch(() => "");
    const snippet = body.slice(0, 300);
    if (res.status === 429) {
      const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"), body);
      throw new RateLimitError(`API 429 rate limit: ${snippet}`, retryAfterMs);
    }
    throw new Error(`API ${res.status}: ${snippet}`);
  }
}
