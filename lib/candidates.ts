import candidatesData from "@/data/candidates.json";
import type { Candidate, CandidatesFile, ScenarioCondition } from "@/lib/types";

const data = candidatesData as unknown as CandidatesFile;

export function getCandidates(): Candidate[] {
  return data.candidates;
}

export function getCandidateById(id: string): Candidate | undefined {
  return data.candidates.find((c) => c.id === id);
}

export function getAttributeLabels(): Record<string, string> {
  return data.attribute_labels;
}

/** 비교 테이블/카드에서 표시할 속성 키 순서 (A/B 동일). */
export const DISPLAY_ATTRIBUTES = [
  "price",
  "rating",
  "battery_hours",
  "weight_g",
  "noise_cancel",
  "water_resistant",
  "warranty_months",
  "codec",
] as const;

export type DisplayAttribute = (typeof DISPLAY_ATTRIBUTES)[number];

/**
 * 비교 테이블 우열 강조용 속성 방향성 (A↔B 통제: 값 자체는 A와 동일, B는 시각적 처리 보조만 추가).
 * - higher: 클수록 우수 / lower: 작을수록 우수 / boolean: true가 우수 / none: 순서 없음(강조 제외)
 */
export const ATTRIBUTE_DIRECTION: Record<DisplayAttribute, "higher" | "lower" | "boolean" | "none"> = {
  price: "lower",
  rating: "higher",
  battery_hours: "higher",
  weight_g: "lower",
  noise_cancel: "boolean",
  water_resistant: "boolean",
  warranty_months: "higher",
  codec: "none",
};

/**
 * 비교 대상 후보들 중 해당 속성에서 '가장 우수한' 후보 id 집합(동점은 모두 포함).
 * 후보가 2개 미만, 방향이 none, 또는 변별이 없을 때(전원 동일/boolean 차이 없음)는 빈 배열 → 강조 없음.
 */
export function bestIdsForAttribute(candidates: Candidate[], key: DisplayAttribute): string[] {
  const dir = ATTRIBUTE_DIRECTION[key];
  if (dir === "none" || candidates.length < 2) return [];
  const valueOf = (c: Candidate) => (c as unknown as Record<string, unknown>)[key];

  if (dir === "boolean") {
    const trues = candidates.filter((c) => valueOf(c) === true);
    // 전부 true 또는 전부 false면 차이가 없으므로 강조하지 않는다.
    if (trues.length === 0 || trues.length === candidates.length) return [];
    return trues.map((c) => c.id);
  }

  const nums = candidates.map((c) => Number(valueOf(c)));
  const target = dir === "higher" ? Math.max(...nums) : Math.min(...nums);
  if (nums.every((n) => n === target)) return []; // 전원 동일 → 변별 없음
  return candidates.filter((c) => Number(valueOf(c)) === target).map((c) => c.id);
}

/** A/B 공통 과업 시나리오. 1개면 충분(필요 시 배열에 추가). */
const SCENARIOS: ScenarioCondition[] = [
  {
    id: "s1",
    title: "상충하는 조건 속에서 균형 잡힌 이어폰 고르기",
    descriptionLines: [
      "**노이즈 캔슬링(ANC)을 지원**하고 **예산 150,000원 이하**인 무선 이어폰만 후보입니다.",
      "아래 **세 가지 속성이 서로 상충**하므로(더 싸면 무겁거나 재생시간이 짧고, 더 가벼우면 더 비싼 식) **세 조건을 모두 만족하는 절대적 정답은 없습니다.**",
      "세 속성의 균형을 스스로 따져 본인에게 가장 합리적이라고 판단되는 제품 하나를 최종 선택하세요.",
    ],
    tradeoffs: [
      "가격: 낮을수록 좋음",
      "재생시간: 길수록 좋음",
      "무게: 가벼울수록 좋음",
    ],
    maxPrice: 150000,
    requireNoiseCancel: true,
    rankBy: "tradeoff",
    weights: { price: 1, battery_hours: 1, weight_g: 1 },
  },
];

export function getScenarios(): ScenarioCondition[] {
  return SCENARIOS;
}

export function getScenario(id?: string): ScenarioCondition {
  if (id) {
    const found = SCENARIOS.find((s) => s.id === id);
    if (found) return found;
  }
  return SCENARIOS[0];
}

/**
 * 시나리오 조건을 만족하는 후보를 rankBy 기준으로 정렬해 반환.
 * mock agent가 "정답 후보"를 고르는 데 사용 (실험 데이터 생성 아님, 룰 기반 행동 결정용).
 */
export function filterAndRank(scenario: ScenarioCondition): Candidate[] {
  // 1) 하드 필터(ANC 등) 적용
  const passed = getCandidates().filter((c) => {
    if (scenario.maxPrice != null && c.price > scenario.maxPrice) return false;
    if (scenario.requireNoiseCancel && !c.noise_cancel) return false;
    if (scenario.requireWaterResistant && !c.water_resistant) return false;
    if (scenario.minBatteryHours != null && c.battery_hours < scenario.minBatteryHours)
      return false;
    return true;
  });

  // 필터 결과가 없으면(데이터 이상) 전체에서라도 항상 ≥1개 반환
  const pool = passed.length > 0 ? passed : getCandidates();

  // 2) 단일 평점 정렬
  if (scenario.rankBy === "rating") {
    return [...pool].sort((a, b) => b.rating - a.rating);
  }

  // 3) trade-off: 가격↓·재생시간↑·무게↓ 를 min-max 정규화 후 가중합산.
  //    (mock agent 가 결정적으로 "납득 가능한" 후보를 고르기 위한 행동 규칙. 실험 데이터가 아님.)
  const w = scenario.weights ?? { price: 1, battery_hours: 1, weight_g: 1 };
  const minMax = (vals: number[]) => {
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const span = hi - lo;
    return (v: number) => (span === 0 ? 0.5 : (v - lo) / span);
  };
  const nPrice = minMax(pool.map((c) => c.price));
  const nBatt = minMax(pool.map((c) => c.battery_hours));
  const nWeight = minMax(pool.map((c) => c.weight_g));
  const score = (c: Candidate) =>
    // 낮을수록 좋은 속성은 (1 - 정규화값)
    w.price * (1 - nPrice(c.price)) +
    w.battery_hours * nBatt(c.battery_hours) +
    w.weight_g * (1 - nWeight(c.weight_g));

  return [...pool].sort((a, b) => score(b) - score(a));
}
