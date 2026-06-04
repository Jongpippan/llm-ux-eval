/** 공유 타입. data/candidates.json 및 zod 스키마(lib/schema/*)와 일치해야 한다. */

export type UiVariant = "A" | "B";
export type ParticipantType = "human" | "llm";

export interface Candidate {
  id: string;
  name: string;
  brand: string;
  price: number; // KRW
  rating: number; // 0..5
  battery_hours: number;
  weight_g: number;
  noise_cancel: boolean;
  water_resistant: boolean;
  warranty_months: number;
  codec: string;
}

export interface CandidatesFile {
  category: string;
  currency: string;
  attribute_labels: Record<string, string>;
  candidates: Candidate[];
}

/** A/B 공통 과업 시나리오 조건. */
export interface ScenarioCondition {
  id: string;
  title: string;
  /**
   * 사용자에게 보여줄 도입 설명. 각 원소 = 한 줄(문장)로 렌더된다.
   * `**...**` 로 감싼 부분은 볼드 처리된다. 하드 필터(ANC·예산)와 과업 목표를 요약.
   */
  descriptionLines: string[];
  /** 서로 상충하는 trade-off 조건을 불렛으로 표시(읽기 쉽도록). 표시 전용 — 정렬 로직은 weights 사용. */
  tradeoffs?: string[];
  /** 정량 제약 (mock agent가 필터링에 사용) */
  maxPrice?: number;
  requireNoiseCancel?: boolean;
  requireWaterResistant?: boolean;
  minBatteryHours?: number;
  /**
   * 상충(trade-off) 속성 정렬 방식.
   * "rating": 단일 속성 평점 내림차순.
   * "tradeoff": 아래 weights 로 가격↓/재생시간↑/무게↓ 를 정규화·가중합산해 정렬.
   * (mock agent 가 결정적으로 후보를 고르기 위한 행동 규칙. 실험 결과 데이터가 아님.)
   */
  rankBy: "rating" | "tradeoff";
  /** rankBy="tradeoff" 일 때 적용할 가중치. 합이 1일 필요는 없다. */
  weights?: {
    /** 가격: 낮을수록 선호 */
    price: number;
    /** 재생시간: 길수록 선호 */
    battery_hours: number;
    /** 무게: 가벼울수록 선호 */
    weight_g: number;
  };
}

export interface SessionInfo {
  session_id: string;
  participant_id: string;
  ui_variant: UiVariant;
  participant_type: ParticipantType;
  scenario_id: string;
  started_at: number; // epoch ms
}

export const LOG_EVENT_TYPES = [
  "experiment_start",
  "view_condition",
  "click_candidate",
  "open_detail",
  "compare_add",
  "compare_remove",
  "view_compare",
  "select_final",
  "answer_survey",
  "finish",
] as const;
export type LogEventType = (typeof LOG_EVENT_TYPES)[number];

/** 진행 단계명. 분석 시 단계별 그룹핑에 사용. */
export const STEP_NAMES = [
  "intro",
  "task",
  "explore",
  "detail",
  "compare",
  "survey",
  "complete",
] as const;
export type StepName = (typeof STEP_NAMES)[number];

export interface LogEvent {
  // --- 필수 8개 (기존) ---
  event_type: LogEventType;
  timestamp: number; // epoch ms
  ui_variant: UiVariant;
  participant_type: ParticipantType;
  session_id: string;
  target_id: string | null;
  action_detail: Record<string, unknown>;
  elapsed_ms: number;
  // --- 추가 분석 필드 (모두 optional/nullable) ---
  participant_id?: string | null;
  step_name?: StepName | null;
  candidate_id?: string | null;
  candidate_position?: number | null;
  compare_count?: number | null;
  current_compare_ids?: string[] | null;
  final_selected_candidate_id?: string | null;
  survey_difficulty?: number | null;
  survey_satisfaction?: number | null;
  survey_confidence?: number | null;
}

export interface SurveyAnswer {
  difficulty: number; // Likert 1..5
  satisfaction: number; // 1..5
  confidence: number; // 1..5
  freeText?: string;
}

/**
 * LLM 시뮬레이션 run 의 출처(provenance) 메타. human/mock 세션에는 없거나 의미 없음(모두 optional).
 * - is_clean_llm_run: 세션의 모든 action 이 실제 LLM provider 에서 나왔고 mock fallback 이 전혀 없을 때만 true.
 * - used_mock_fallback: 한 step이라도 mock 으로 대체됐으면 true → is_clean_llm_run=false.
 */
export interface LlmRunMeta {
  llm_provider: string | null;
  llm_model: string | null;
  llm_temperature: number | null;
  used_mock_fallback: boolean | null;
  is_clean_llm_run: boolean | null;
  fallback_reason: string | null;
}

export interface SessionResult {
  session: SessionInfo;
  final_choice_id: string | null;
  survey: SurveyAnswer | null;
  finished_at: number | null;
  task_duration_ms: number | null;
  // LLM run provenance (optional — human/mock 세션엔 없음)
  llm_provider?: string | null;
  llm_model?: string | null;
  llm_temperature?: number | null;
  used_mock_fallback?: boolean | null;
  is_clean_llm_run?: boolean | null;
  fallback_reason?: string | null;
}
