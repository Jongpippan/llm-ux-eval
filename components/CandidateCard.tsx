"use client";

import type { Candidate } from "@/lib/types";
import { TESTID } from "@/lib/testids";
import { AttributeList } from "@/components/AttributeList";
import { CandidateThumb } from "@/components/CandidateThumb";

/**
 * A/B 공통 후보 카드. 비교 버튼(slot)만 B에서 children으로 주입한다.
 * 카드 표현/정보 항목은 A/B 동일 (통제). 모든 속성을 항상 카드에 표시한다
 * (상세 클릭 없이도 전체 정보 노출 — A/B 간 정보 접근 비용 비대칭 제거).
 */
export function CandidateCard({
  candidate,
  isSelectedFinal,
  onClickCard,
  onSelectFinal,
  compareSlot,
}: {
  candidate: Candidate;
  isSelectedFinal: boolean;
  onClickCard: (id: string) => void;
  onSelectFinal: (id: string) => void;
  /** B 전용 비교 버튼 영역. A에서는 미전달. */
  compareSlot?: React.ReactNode;
}) {
  return (
    <div
      className="card"
      data-testid={TESTID.candidateCard(candidate.id)}
      onClick={() => onClickCard(candidate.id)}
      style={{ borderColor: isSelectedFinal ? "var(--good)" : undefined }}
    >
      <CandidateThumb candidate={candidate} size="card" />
      <div className="card-head">
        <div className="card-name" title={candidate.name}>
          {candidate.name}
        </div>
        <div className="muted small card-brand">{candidate.brand}</div>
      </div>
      {/* 전체 속성 항상 표시 (가격·평점 포함) */}
      <AttributeList candidate={candidate} />
      <div className="row" style={{ marginTop: 10 }}>
        {compareSlot}
        <span className="spacer" />
        <button
          className={isSelectedFinal ? "btn-primary btn small" : "btn small"}
          data-testid={TESTID.btnSelectFinal(candidate.id)}
          onClick={(e) => {
            e.stopPropagation();
            onSelectFinal(candidate.id);
          }}
        >
          {isSelectedFinal ? "선택됨" : "최종 선택"}
        </button>
      </div>
    </div>
  );
}
