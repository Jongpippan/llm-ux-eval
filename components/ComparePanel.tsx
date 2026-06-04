"use client";

import type { Candidate } from "@/lib/types";
import { TESTID } from "@/lib/testids";
import { CompareTable } from "@/components/CompareTable";

/**
 * B 전용: 화면 우측에 고정되어 항상 떠 있는 비교 영역.
 * - "비교 담기/해제"에 따라 실시간으로 내용이 갱신된다(별도 버튼 클릭 불필요).
 * - 비교 영역 안에서도 바로 최종 선택할 수 있다.
 */
export function ComparePanel({
  candidates,
  onRemove,
  onSelectFinal,
  finalId,
  onGotoSurvey,
}: {
  candidates: Candidate[];
  onRemove: (id: string) => void;
  onSelectFinal: (id: string) => void;
  finalId: string | null;
  onGotoSurvey: () => void;
}) {
  return (
    <aside className="compare-panel" data-testid={TESTID.comparePanel}>
      <div className="compare-panel-head">
        <strong>비교 영역</strong>
        <span className="muted small">({candidates.length})</span>
      </div>
      <div className="compare-panel-body">
        {candidates.length === 0 ? (
          <p className="compare-empty">
            카드의 <b>“비교 담기”</b>를 누르면 이곳에 후보가 실시간으로 추가되어
            나란히 비교됩니다. 비교 영역에서도 바로 최종 선택할 수 있습니다.
          </p>
        ) : (
          <CompareTable
            candidates={candidates}
            onRemove={onRemove}
            onSelectFinal={onSelectFinal}
            finalId={finalId}
          />
        )}
      </div>
      <div className="compare-panel-foot">
        <button
          className="btn-primary btn"
          data-testid={TESTID.btnGotoSurveyCompare}
          disabled={!finalId}
          onClick={onGotoSurvey}
        >
          최종 선택 완료 → 설문으로
        </button>
        {!finalId && (
          <span className="muted small">후보를 최종 선택해야 진행됩니다.</span>
        )}
      </div>
    </aside>
  );
}
