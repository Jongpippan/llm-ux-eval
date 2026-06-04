import { logEventSchema } from "@/lib/schema/logEvent";
import { getSession } from "@/lib/session";
import type { LogEvent, LogEventType, StepName } from "@/lib/types";

const LOG_KEY_PREFIX = "experiment_logs:"; // + session_id

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function logKey(sessionId: string): string {
  return LOG_KEY_PREFIX + sessionId;
}

function readLocal(sessionId: string): LogEvent[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(logKey(sessionId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as LogEvent[];
  } catch {
    return [];
  }
}

function writeLocal(sessionId: string, events: LogEvent[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(logKey(sessionId), JSON.stringify(events));
}

/**
 * 단일 이벤트를 기록한다.
 * - elapsed_ms: 세션 started_at 기준 경과 시간(ms)
 * - localStorage에 누적 + POST /api/log (네트워크 실패해도 localStorage는 유지)
 */
/** event_type → 합리적 기본 step_name 매핑 (호출부가 명시하지 않을 때 사용). */
const DEFAULT_STEP_BY_EVENT: Record<LogEventType, StepName> = {
  experiment_start: "intro",
  view_condition: "task",
  click_candidate: "explore",
  open_detail: "detail",
  compare_add: "compare",
  compare_remove: "compare",
  view_compare: "compare",
  select_final: "explore",
  answer_survey: "survey",
  finish: "complete",
};

export interface LogEventExtra {
  targetId?: string | null;
  detail?: Record<string, unknown>;
  stepName?: StepName | null;
  candidateId?: string | null;
  candidatePosition?: number | null;
  compareCount?: number | null;
  currentCompareIds?: string[] | null;
  finalSelectedCandidateId?: string | null;
  surveyDifficulty?: number | null;
  surveySatisfaction?: number | null;
  surveyConfidence?: number | null;
}

export async function logEvent(
  eventType: LogEventType,
  opts?: LogEventExtra
): Promise<void> {
  const session = getSession();
  if (!session) {
    // 세션 없으면 기록 불가 (silent)
    return;
  }

  const now = Date.now();
  const event: LogEvent = {
    event_type: eventType,
    timestamp: now,
    ui_variant: session.ui_variant,
    participant_type: session.participant_type,
    session_id: session.session_id,
    target_id: opts?.targetId ?? null,
    action_detail: opts?.detail ?? {},
    elapsed_ms: now - session.started_at,
    // --- 분석 필드 자동 첨부 + 인자 ---
    participant_id: session.participant_id ?? null,
    step_name: opts?.stepName ?? DEFAULT_STEP_BY_EVENT[eventType] ?? null,
    candidate_id: opts?.candidateId ?? null,
    candidate_position: opts?.candidatePosition ?? null,
    compare_count: opts?.compareCount ?? null,
    current_compare_ids: opts?.currentCompareIds ?? null,
    final_selected_candidate_id: opts?.finalSelectedCandidateId ?? null,
    survey_difficulty: opts?.surveyDifficulty ?? null,
    survey_satisfaction: opts?.surveySatisfaction ?? null,
    survey_confidence: opts?.surveyConfidence ?? null,
  };

  // zod 검증 (실패하면 콘솔 경고하고 그대로 진행하지 않음)
  const parsed = logEventSchema.safeParse(event);
  if (!parsed.success) {
    if (isBrowser()) console.warn("logEvent invalid", parsed.error.flatten());
    return;
  }

  // 1) localStorage 누적 (export.json 의 원천 — 정적 배포에서도 동작)
  const events = readLocal(session.session_id);
  events.push(event);
  writeLocal(session.session_id, events);

  // 2) 서버 전송 (best-effort). 정적 export 배포(서버 없음)에서는 스킵해 불필요한 404 를 피한다.
  if (process.env.NEXT_PUBLIC_STATIC_EXPORT === "1") return;
  try {
    await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    });
  } catch {
    /* 오프라인/서버 미동작 시 localStorage 백업으로 충분 */
  }
}

export function getLogs(sessionId?: string): LogEvent[] {
  const sid = sessionId ?? getSession()?.session_id;
  if (!sid) return [];
  return readLocal(sid);
}

export function exportLogsAsJson(sessionId?: string): string {
  return JSON.stringify(getLogs(sessionId), null, 2);
}

export function clearLogs(sessionId?: string): void {
  const sid = sessionId ?? getSession()?.session_id;
  if (!sid || !isBrowser()) return;
  window.localStorage.removeItem(logKey(sid));
}

/** 브라우저에서 JSON 파일 다운로드를 트리거. */
export function downloadLogsFile(sessionId?: string): void {
  if (!isBrowser()) return;
  const sid = sessionId ?? getSession()?.session_id;
  if (!sid) return;
  const blob = new Blob([exportLogsAsJson(sid)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `logs_${sid}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
