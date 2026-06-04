/**
 * Export 유틸: 완료 화면에서 세션 JSON / events CSV / session summary CSV 를 생성·다운로드한다.
 * CSV 컬럼은 분석 용이성을 위해 고정한다. (lib/export.ts ↔ app/api/session/route.ts 동형 유지)
 *
 * 실제/가짜 실험 데이터를 생성하지 않는다 — localStorage 에 누적된 실측 로그만 직렬화한다.
 */
import type {
  LogEvent,
  SessionInfo,
  SurveyAnswer,
  SessionResult,
  LlmRunMeta,
} from "@/lib/types";

/** 완료 화면이 export 하는 세션 JSON 의 형태(서버 export_{sid}.json 과 동형). */
export interface SessionExport extends SessionResult {
  events: LogEvent[];
}

export interface SessionExportInput {
  session: SessionInfo;
  finalChoiceId: string | null;
  survey: SurveyAnswer | null;
  finishedAt: number | null;
  taskDurationMs: number | null;
  events: LogEvent[];
  /** LLM run provenance (optional — human/브라우저 export 시엔 없음). */
  llm?: LlmRunMeta | null;
}

/** session JSON: metadata + final choice + survey + duration + (LLM provenance) + 전체 events */
export function buildSessionExport(input: SessionExportInput): SessionExport {
  return {
    session: input.session,
    final_choice_id: input.finalChoiceId,
    survey: input.survey,
    finished_at: input.finishedAt,
    task_duration_ms: input.taskDurationMs,
    llm_provider: input.llm?.llm_provider ?? null,
    llm_model: input.llm?.llm_model ?? null,
    llm_temperature: input.llm?.llm_temperature ?? null,
    used_mock_fallback: input.llm?.used_mock_fallback ?? null,
    is_clean_llm_run: input.llm?.is_clean_llm_run ?? null,
    fallback_reason: input.llm?.fallback_reason ?? null,
    events: input.events,
  };
}

// --- CSV 헬퍼 -------------------------------------------------------------

/** CSV 셀 이스케이프: 콤마/따옴표/개행 포함 시 큰따옴표로 감싸고 내부 " 는 "" 로. */
function csvCell(value: unknown): string {
  let str: string;
  if (value == null) str = "";
  else if (typeof value === "string") str = value;
  else if (Array.isArray(value)) str = value.join("|");
  else if (typeof value === "object") str = JSON.stringify(value);
  else str = String(value);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

/** events.csv 고정 컬럼 */
export const EVENTS_CSV_COLUMNS = [
  "session_id",
  "participant_id",
  "participant_type",
  "ui_variant",
  "event_type",
  "step_name",
  "timestamp",
  "elapsed_ms",
  "target_id",
  "candidate_id",
  "candidate_position",
  "compare_count",
  "current_compare_ids",
  "final_selected_candidate_id",
  "survey_difficulty",
  "survey_satisfaction",
  "survey_confidence",
  "action_detail",
] as const;

/** events 단위 CSV 문자열 생성. */
export function buildEventsCsv(events: LogEvent[]): string {
  const lines: string[] = [EVENTS_CSV_COLUMNS.join(",")];
  for (const e of events) {
    lines.push(
      csvRow([
        e.session_id,
        e.participant_id ?? "",
        e.participant_type,
        e.ui_variant,
        e.event_type,
        e.step_name ?? "",
        e.timestamp,
        e.elapsed_ms,
        e.target_id ?? "",
        e.candidate_id ?? "",
        e.candidate_position ?? "",
        e.compare_count ?? "",
        e.current_compare_ids ?? "", // array → "|" join
        e.final_selected_candidate_id ?? "",
        e.survey_difficulty ?? "",
        e.survey_satisfaction ?? "",
        e.survey_confidence ?? "",
        e.action_detail ?? {}, // object → JSON string
      ])
    );
  }
  return lines.join("\n");
}

/** session_summary.csv 고정 컬럼 */
export const SESSION_SUMMARY_CSV_COLUMNS = [
  "session_id",
  "participant_id",
  "participant_type",
  "ui_variant",
  "scenario_id",
  "started_at",
  "finished_at",
  "task_duration_ms",
  "final_choice_id",
  "survey_difficulty",
  "survey_satisfaction",
  "survey_confidence",
  "event_count",
  "llm_provider",
  "llm_model",
  "llm_temperature",
  "used_mock_fallback",
  "is_clean_llm_run",
  "fallback_reason",
] as const;

/** 세션 1행 요약 CSV (header + 1 row). */
export function buildSessionSummaryCsv(input: SessionExportInput): string {
  const s = input.session;
  const sv = input.survey;
  const m = input.llm;
  const header = SESSION_SUMMARY_CSV_COLUMNS.join(",");
  const row = csvRow([
    s.session_id,
    s.participant_id ?? "",
    s.participant_type,
    s.ui_variant,
    s.scenario_id,
    s.started_at,
    input.finishedAt ?? "",
    input.taskDurationMs ?? "",
    input.finalChoiceId ?? "",
    sv?.difficulty ?? "",
    sv?.satisfaction ?? "",
    sv?.confidence ?? "",
    input.events.length,
    m?.llm_provider ?? "",
    m?.llm_model ?? "",
    m?.llm_temperature ?? "",
    m?.used_mock_fallback ?? "",
    m?.is_clean_llm_run ?? "",
    m?.fallback_reason ?? "",
  ]);
  return header + "\n" + row;
}

// --- 브라우저 다운로드 ----------------------------------------------------

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function downloadTextFile(filename: string, text: string, mime: string): void {
  if (!isBrowser()) return;
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * export_{sid}.json **한 개만** 다운로드 (참가자 제출용 — 분석은 이 파일만 있으면 충분).
 * 정적 배포(GitHub Pages, 서버 로그 없음)에서 데이터 수집의 정본 산출물.
 */
export function downloadSessionJson(input: SessionExportInput): void {
  const sid = input.session.session_id;
  downloadTextFile(
    `export_${sid}.json`,
    JSON.stringify(buildSessionExport(input), null, 2),
    "application/json"
  );
}

/** 완료 화면에서 호출: session JSON + events CSV + session summary CSV 다운로드. */
export function downloadSessionExport(input: SessionExportInput): void {
  const sid = input.session.session_id;
  const files: Array<[name: string, text: string, mime: string]> = [
    [
      `export_${sid}.json`,
      JSON.stringify(buildSessionExport(input), null, 2),
      "application/json",
    ],
    [`events_${sid}.csv`, buildEventsCsv(input.events), "text/csv"],
    [`session_${sid}.csv`, buildSessionSummaryCsv(input), "text/csv"],
  ];
  // 브라우저(특히 Chromium)는 단일 클릭 제스처에서 연속 다운로드를 차단할 수 있어
  // 첫 파일만 받히는 경우가 있다. 파일 간 미세 시차를 두어 3개 모두 안정적으로 받게 한다.
  files.forEach(([name, text, mime], i) => {
    if (i === 0) downloadTextFile(name, text, mime);
    else if (isBrowser())
      window.setTimeout(() => downloadTextFile(name, text, mime), i * 300);
  });
}
