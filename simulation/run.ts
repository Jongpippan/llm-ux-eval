import { chromium, type Browser, type Page } from "@playwright/test";
import { loadConfig, type SimConfig } from "@/simulation/config";
import { extractState, type ScreenState } from "@/simulation/stateExtractor";
import { executeAction, clickTransition } from "@/simulation/actionExecutor";
import { MockAgent } from "@/simulation/agents/mockAgent";
import { LlmAgent } from "@/simulation/agents/llmAgent";
import type { LlmAction } from "@/lib/schema/llmAction";

/**
 * Playwright runner.
 * intro → experiment(condition) → explore(A|B) → survey → complete 까지 루프 구동.
 *
 * clean LLM run 정책:
 * - LLM 호출 실패 시 기본적으로 mock 으로 섞지 않는다(LLM_ALLOW_MOCK_FALLBACK=true 일 때만 허용).
 * - mock 이 한 번이라도 섞이면 used_mock_fallback=true / is_clean_llm_run=false.
 * - 모든 action 이 실제 LLM 에서 나오고 fallback 이 없을 때만 is_clean_llm_run=true.
 * 실제 실험 데이터 생성 금지 — end-to-end 흐름 + provenance 기록만 보장.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const config = loadConfig();
  console.log("[sim] config:", JSON.stringify(config)); // config 에는 키 값이 없다

  const useLlm = config.provider !== "mock";
  const llm = useLlm ? new LlmAgent(config) : null;
  const mock = new MockAgent(config.scenarioId);
  const model = llm ? llm.modelName() : "mock";

  // --- provenance 상태 ---
  let usedMockFallback = false;
  let fallbackReason: string | null = null;
  let cleanFailed = false;

  // --- 행동 이력(루프 방지용) ---
  const recentActions: string[] = [];
  const viewed = new Set<string>();
  const pushHistory = (a: LlmAction) => {
    const label = "target_id" in a ? `${a.type}:${a.target_id}` : a.type;
    recentActions.push(label);
    if (recentActions.length > 12) recentActions.shift();
    if (a.type === "click") viewed.add(a.target_id);
  };

  /** 한 step 의 action 결정. 실패 시 정책에 따라 mock(허용 시) 또는 null(clean 실패). */
  const decide = async (state: ScreenState): Promise<LlmAction | null> => {
    const s: ScreenState = {
      ...state,
      history: {
        recent_actions: [...recentActions],
        already_viewed_candidate_ids: [...viewed],
      },
    };
    if (!llm) return mock.decide(s); // pure mock run
    if (config.callDelayMs > 0) await sleep(config.callDelayMs); // TPM 회피 페이싱
    try {
      return await llm.decide(s);
    } catch (err) {
      const reason = String(err).slice(0, 200);
      if (config.allowMockFallback) {
        usedMockFallback = true;
        fallbackReason = fallbackReason ?? reason;
        console.warn(`[sim] LLM step failed; LLM_ALLOW_MOCK_FALLBACK=true → mock for THIS step (run no longer clean). reason: ${reason}`);
        return mock.decide(s);
      }
      cleanFailed = true;
      fallbackReason = reason;
      console.error(`[sim] LLM step failed and mock fallback disabled → ABORT (clean run failed). reason: ${reason}`);
      return null;
    }
  };

  let browser: Browser | null = null;
  let steps = 0;
  try {
    browser = await chromium.launch({ headless: config.headless });
    const page: Page = await browser.newPage();

    const pidQuery = config.participantId
      ? `&pid=${encodeURIComponent(config.participantId)}`
      : "";
    const startUrl = `${config.baseUrl}/?variant=${config.variant}&participant=llm&scenario=${config.scenarioId}${pidQuery}`;
    await page.goto(startUrl, { waitUntil: "domcontentloaded" });
    await clickTransition(page, "btn-start").catch(() => {});
    await clickTransition(page, "btn-goto-explore").catch(() => {});

    let lastStep = "";
    while (steps < config.maxSteps) {
      steps += 1;
      const state = await extractState(page, config.variant);
      console.log(`[sim] step ${steps} @${state.step}`);

      if (state.step === "complete") {
        const action = await decide(state);
        if (!action) break;
        await executeAction(page, action);
        pushHistory(action);
        console.log("[sim] finished (complete + finish action)");
        break;
      }

      if (state.step === "explore") {
        if (state.finalSelectedId) {
          await clickTransition(page, "btn-goto-survey").catch(() => {});
          continue;
        }
        const action = await decide(state);
        if (!action) break;
        console.log("[sim]   action:", JSON.stringify(action));
        await executeAction(page, action);
        pushHistory(action);
        continue;
      }

      if (state.step === "survey") {
        const action = await decide(state);
        if (!action) break;
        console.log("[sim]   action:", JSON.stringify(action));
        await executeAction(page, action);
        pushHistory(action);
        continue;
      }

      if (state.step === "intro") {
        await clickTransition(page, "btn-start").catch(() => {});
      } else if (state.step === "experiment") {
        await clickTransition(page, "btn-goto-explore").catch(() => {});
      } else if (state.step === lastStep) {
        console.warn("[sim] stuck at", state.step, "— aborting loop");
        break;
      }
      lastStep = state.step;
    }

    const isCleanLlmRun = useLlm && !usedMockFallback && !cleanFailed;
    console.log(
      `[sim] provenance: provider=${config.provider} model=${model} used_mock_fallback=${usedMockFallback} is_clean_llm_run=${isCleanLlmRun}${cleanFailed ? " (CLEAN RUN FAILED)" : ""}`
    );

    if (cleanFailed) {
      console.error("[sim] CLEAN RUN FAILED — 이 run 은 실험 데이터로 저장/인정하지 않는다. reason:", fallbackReason);
      // provenance POST 생략(clean 실패 run 보존 금지). logs 는 검증 단계에서 정리.
    } else {
      await postProvenance(page, config, model, usedMockFallback, isCleanLlmRun, fallbackReason).catch(
        (e) => console.warn("[sim] provenance post failed:", String(e).slice(0, 150))
      );
    }

    console.log(`[sim] done in ${steps} steps. logs saved under ./logs/`);
    if (cleanFailed) process.exitCode = 2;
  } finally {
    if (browser) await browser.close();
  }
}

/** 페이지 localStorage 에서 세션/이벤트를 읽어 provenance 와 함께 서버에 최종 기록(export/csv/session 재생성). */
async function postProvenance(
  page: Page,
  config: SimConfig,
  model: string,
  usedMockFallback: boolean,
  isCleanLlmRun: boolean,
  fallbackReason: string | null
): Promise<void> {
  const data = (await page.evaluate(() => {
    const raw = localStorage.getItem("experiment_session");
    const session = raw ? JSON.parse(raw) : null;
    const sid = session?.session_id as string | undefined;
    const events = sid ? JSON.parse(localStorage.getItem("experiment_logs:" + sid) || "[]") : [];
    const surveyRaw = localStorage.getItem("experiment_survey");
    const survey = surveyRaw ? JSON.parse(surveyRaw) : null;
    const final = localStorage.getItem("experiment_final_choice");
    return { session, events, survey, final };
  })) as {
    session: { session_id?: string; started_at?: number } | null;
    events: Array<{ timestamp?: number }>;
    survey: unknown;
    final: string | null;
  };

  if (!data.session?.session_id) return;
  const startedAt = data.session.started_at ?? 0;
  const lastTs = data.events.length
    ? Math.max(...data.events.map((e) => Number(e.timestamp) || 0))
    : startedAt;

  const body = {
    session: data.session,
    final_choice_id: data.final ?? null,
    survey: data.survey ?? null,
    finished_at: lastTs || null,
    task_duration_ms: startedAt ? lastTs - startedAt : null,
    events: data.events,
    llm_provider: config.provider,
    llm_model: model,
    llm_temperature: config.provider === "mock" ? null : config.temperature,
    used_mock_fallback: usedMockFallback,
    is_clean_llm_run: isCleanLlmRun,
    fallback_reason: fallbackReason,
  };
  const res = await fetch(`${config.baseUrl}/api/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log(`[sim] provenance posted to /api/session: HTTP ${res.status} (is_clean_llm_run=${isCleanLlmRun})`);
}

main().catch((err) => {
  console.error("[sim] error:", err);
  process.exit(1);
});
