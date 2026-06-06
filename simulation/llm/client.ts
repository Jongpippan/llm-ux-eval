import type { SimConfig } from "@/simulation/config";

/**
 * 공용 LLM 호출 클라이언트 + 재시도 래퍼.
 *
 * 기존 llmAgent 에 있던 provider 호출(anthropic|openai-호환) + 429/backoff + no-hang 정책을
 * 분리해, generic LlmAgent 와 UXAgent 식 PersonaAgent/Interview 가 동일한 하드닝을 공유한다.
 *
 * 정책(clean run 보존):
 * - 이 모듈은 mock 으로 자동 fallback 하지 않는다. 실패 시 throw → run loop(run.ts)가 정책 결정.
 * - 키 값은 절대 로그/에러 메시지에 넣지 않는다.
 */

/** 429 rate-limit 전용 에러. retryAfterMs 가 있으면 backoff 에 사용. */
export class RateLimitError extends Error {
  retryAfterMs?: number;
  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry-After 헤더(초) 또는 본문 "try again in Xs" 에서 대기 ms 를 추출. */
export function parseRetryAfterMs(headerVal: string | null, body: string): number | undefined {
  if (headerVal) {
    const secs = Number(headerVal);
    if (Number.isFinite(secs)) return Math.ceil(secs * 1000);
  }
  const m = body.match(/try again in\s+([\d.]+)\s*s/i);
  if (m) return Math.ceil(parseFloat(m[1]) * 1000);
  return undefined;
}

export interface CompleteOptions {
  /** 최대 출력 토큰(anthropic 필수). 기본 512 — 관찰+계획+action JSON 을 담을 여유. */
  maxTokens?: number;
  /** temperature override. 미지정 시 config.temperature. */
  temperature?: number;
}

export class LlmClient {
  private config: SimConfig;
  private provider: SimConfig["provider"];

  constructor(config: SimConfig) {
    this.config = config;
    this.provider = config.provider;
  }

  /** 사용 중인 모델명(로깅/provenance 용). 키 값은 포함하지 않는다. */
  modelName(): string {
    if (this.provider === "anthropic")
      return process.env.ANTHROPIC_MODEL ?? "anthropic-default";
    if (this.provider === "openai")
      return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    return "unknown";
  }

  /**
   * 단일 시도 호출(재시도 없음). 429 → RateLimitError, 그 외 비정상 → Error.
   * 재시도/backoff 는 withRetry 가 담당한다.
   */
  async rawComplete(prompt: string, opts: CompleteOptions = {}): Promise<string> {
    const temperature = opts.temperature ?? this.config.temperature;
    const maxTokens = opts.maxTokens ?? 512;
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
          max_tokens: maxTokens,
          temperature,
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
          temperature,
          max_tokens: maxTokens,
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

/**
 * 재시도/backoff 래퍼. fn(LLM 호출 + 파싱/검증)을 감싸 429/오류/스키마위반 시 재시도한다.
 * - 429: retry-after(or 본문 Xs) 만큼 대기 후 재시도
 * - 그 외: 지수 backoff(retryBaseMs * 2^attempt)
 * - 대기가 maxWaitMs 를 넘으면(일일/장기 한도 소진 등) 즉시 throw → run hang 방지
 * 모든 시도 실패 시 마지막 에러를 throw (mock fallback 은 하지 않음).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Pick<SimConfig, "maxRetries" | "retryBaseMs" | "maxWaitMs">,
  label = "llm"
): Promise<T> {
  const maxRetries = Math.max(0, config.maxRetries);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= maxRetries) break;
      const waitMs =
        err instanceof RateLimitError && err.retryAfterMs
          ? err.retryAfterMs
          : config.retryBaseMs * Math.pow(2, attempt);
      if (waitMs > config.maxWaitMs) {
        throw new Error(
          `rate-limit wait ${Math.round(waitMs / 1000)}s exceeds LLM_MAX_WAIT_MS(${Math.round(config.maxWaitMs / 1000)}s) — likely daily/long-window quota exhausted; aborting instead of waiting`
        );
      }
      const kind = err instanceof RateLimitError ? "429 rate-limit" : "error";
      console.warn(
        `[${label}] attempt ${attempt + 1}/${maxRetries + 1} ${kind}; retry in ${waitMs}ms: ${String(err).slice(0, 160)}`
      );
      await sleep(waitMs);
    }
  }
  throw new Error(
    `${label} failed after ${maxRetries + 1} attempt(s): ${String(lastErr).slice(0, 200)}`
  );
}

/** 응답 문자열에서 첫 JSON 객체를 추출해 파싱. */
export function extractJson(raw: string): unknown {
  const match = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : raw);
}
