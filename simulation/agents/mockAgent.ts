import type { LlmAction } from "@/lib/schema/llmAction";
import { llmActionSchema } from "@/lib/schema/llmAction";
import { filterAndRank, getScenario } from "@/lib/candidates";
import type { ScreenState } from "@/simulation/stateExtractor";

/**
 * 룰 기반 mock agent. API 키 없이 동작.
 * 하드 필터(ANC·예산)를 통과한 후보를 filterAndRank 가 trade-off 가중점수로 정렬하면
 * 그 1순위(균형 점수가 가장 높은 후보)를 결정적으로 고른다.
 * B 에서는 상위 2개를 비교에 담고, 1순위 상세를 열람한 뒤 최종 선택한다.
 * (실험 데이터 생성이 아니라, end-to-end 흐름이 도는지 보장하기 위한 골격)
 */
export class MockAgent {
  private scenarioId: string;
  private clicked = new Set<string>();
  private comparedDone = false;

  constructor(scenarioId = "s1") {
    this.scenarioId = scenarioId;
  }

  private bestCandidateId(): string {
    const scenario = getScenario(this.scenarioId);
    const ranked = filterAndRank(scenario);
    return ranked[0]?.id ?? "c01";
  }

  decide(state: ScreenState): LlmAction {
    const scenario = getScenario(this.scenarioId);
    const ranked = filterAndRank(scenario);
    const top = ranked.slice(0, 2).map((c) => c.id);
    const best = this.bestCandidateId();

    if (state.step === "explore") {
      // B: 상위 후보 2개를 비교에 담는다 (우측 비교 패널은 담는 즉시 자동 표시됨)
      if (state.variant === "B" && !this.comparedDone) {
        const notAdded = top.find((id) => !state.compareTrayIds.includes(id));
        if (notAdded) return this.validate({ type: "compare_add", target_id: notAdded });
        this.comparedDone = true;
      }
      // 최고 후보 카드를 한 번 클릭(탐색 신호) — 정보는 카드에 이미 다 표시됨
      if (!this.clicked.has(best)) {
        this.clicked.add(best);
        return this.validate({ type: "click", target_id: best });
      }
      // 최종 선택
      if (!state.finalSelectedId) {
        return this.validate({ type: "select_final", target_id: best });
      }
      // 선택 완료 → 전이는 runner가 goto_survey 처리
      return this.validate({ type: "select_final", target_id: best });
    }

    if (state.step === "survey") {
      return this.validate({
        type: "answer_survey",
        answer: { difficulty: 2, satisfaction: 4, confidence: 4, freeText: "mock agent run" },
      });
    }

    if (state.step === "complete") {
      return this.validate({ type: "finish" });
    }

    // 기본값
    return this.validate({ type: "finish" });
  }

  private validate(a: LlmAction): LlmAction {
    return llmActionSchema.parse(a);
  }
}
