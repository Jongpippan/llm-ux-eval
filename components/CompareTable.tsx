"use client";

import type { Candidate } from "@/lib/types";
import {
  DISPLAY_ATTRIBUTES,
  getAttributeLabels,
  bestIdsForAttribute,
} from "@/lib/candidates";
import { formatAttr } from "@/components/AttributeList";
import { CandidateThumb } from "@/components/CandidateThumb";
import { TESTID } from "@/lib/testids";

/**
 * B 전용: 여러 후보를 동일 항목으로 나란히 비교하는 테이블. 정보 항목은 A와 동일(통제).
 * onSelectFinal/finalId가 주어지면 비교표 안에서도 바로 최종 선택할 수 있다.
 */
export function CompareTable({
  candidates,
  onRemove,
  onSelectFinal,
  finalId,
}: {
  candidates: Candidate[];
  onRemove: (id: string) => void;
  onSelectFinal?: (id: string) => void;
  finalId?: string | null;
}) {
  const labels = getAttributeLabels();
  const showBest = candidates.length >= 2;
  return (
    <div>
      {showBest && (
        <p className="compare-legend">
          <span className="ct-best-mark">▲</span> 표시는 해당 속성에서 가장 우수한 값입니다 (동점이면 모두 표시).
        </p>
      )}
      <div style={{ overflowX: "auto" }}>
        <table className="compare" data-testid={TESTID.compareTable}>
          <thead>
            <tr>
              <th>속성</th>
              {candidates.map((c) => (
                <th key={c.id} data-testid={TESTID.compareTableRow(c.id)}>
                  <div className="ct-col-head">
                    <div className="ct-col-top">
                      <CandidateThumb candidate={c} size="mini" />
                      <button
                        className="btn small btn-danger"
                        data-testid={TESTID.btnCompareRemove(c.id)}
                        style={{ padding: "0 6px" }}
                        onClick={() => onRemove(c.id)}
                      >
                        ×
                      </button>
                    </div>
                    <div className="ct-name" title={c.name}>
                      {c.name}
                    </div>
                  </div>
                  {onSelectFinal && (
                    <button
                      className={
                        finalId === c.id
                          ? "btn-primary btn small ct-select"
                          : "btn small ct-select"
                      }
                      data-testid={TESTID.btnSelectFinal(c.id)}
                      onClick={() => onSelectFinal(c.id)}
                    >
                      {finalId === c.id ? "선택됨" : "최종 선택"}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DISPLAY_ATTRIBUTES.map((k) => {
              const bestIds = bestIdsForAttribute(candidates, k);
              return (
                <tr key={k}>
                  <th>{labels[k] ?? k}</th>
                  {candidates.map((c) => {
                    const isBest = bestIds.includes(c.id);
                    return (
                      <td
                        key={c.id}
                        className={isBest ? "best" : undefined}
                        data-best={isBest ? "true" : undefined}
                      >
                        {formatAttr(k, (c as unknown as Record<string, unknown>)[k])}
                        {isBest && (
                          <span
                            className="ct-best-mark"
                            title="이 속성에서 가장 우수"
                            aria-label="이 속성에서 가장 우수"
                          >
                            ▲
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
