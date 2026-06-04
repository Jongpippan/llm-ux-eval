"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Candidate, SessionInfo, UiVariant } from "@/lib/types";
import { getCandidates, getScenario } from "@/lib/candidates";
import { getOrCreateSession } from "@/lib/session";
import { logEvent } from "@/lib/logger";
import { TESTID } from "@/lib/testids";
import { CandidateCard } from "@/components/CandidateCard";
import { ConditionBox } from "@/components/ConditionBox";
import { ComparePanel } from "@/components/ComparePanel";

const FINAL_KEY = "experiment_final_choice";

/**
 * A/B 공통 탐색 화면. variant="A"면 비교 기능 비활성, "B"면 활성.
 * 두 UI의 유일한 차이는 비교 기능 유무(통제).
 */
export function ExploreView({ variant }: { variant: UiVariant }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [finalId, setFinalId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const candidates = useMemo<Candidate[]>(() => getCandidates(), []);
  const scenario = useMemo(() => getScenario(), []);
  const enableCompare = variant === "B";

  useEffect(() => {
    const s = getOrCreateSession({ variant });
    setSession(s);
    void logEvent("view_condition", {
      stepName: "explore",
      detail: { scenario_id: scenario.id, variant },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  // B: 우측 비교 패널이 떠 있는 동안 본문이 패널과 겹치지 않도록 여백 확보
  useEffect(() => {
    if (!enableCompare) return;
    document.body.classList.add("has-compare-panel");
    return () => document.body.classList.remove("has-compare-panel");
  }, [enableCompare]);

  function positionOf(id: string): number {
    return candidates.findIndex((c) => c.id === id);
  }

  function handleClickCard(id: string) {
    void logEvent("click_candidate", {
      targetId: id,
      stepName: "explore",
      candidateId: id,
      candidatePosition: positionOf(id),
    });
  }
  function handleSelectFinal(id: string) {
    setFinalId(id);
    if (typeof window !== "undefined")
      window.localStorage.setItem(FINAL_KEY, id);
    void logEvent("select_final", {
      targetId: id,
      stepName: "explore",
      candidateId: id,
      candidatePosition: positionOf(id),
      finalSelectedCandidateId: id,
    });
  }
  function handleCompareAdd(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      // 비교 영역이 처음 채워질 때 = 비교 보기가 시작되는 시점
      if (prev.length === 0)
        void logEvent("view_compare", {
          stepName: "compare",
          detail: { reason: "panel_opened", ids: next },
          compareCount: next.length,
          currentCompareIds: next,
        });
      // compare_add 로그는 갱신된 비교 목록을 반영해 next 기준으로 기록
      void logEvent("compare_add", {
        targetId: id,
        stepName: "compare",
        candidateId: id,
        candidatePosition: positionOf(id),
        compareCount: next.length,
        currentCompareIds: next,
      });
      return next;
    });
  }
  function handleCompareRemove(id: string) {
    setCompareIds((prev) => {
      const next = prev.filter((x) => x !== id);
      void logEvent("compare_remove", {
        targetId: id,
        stepName: "compare",
        candidateId: id,
        candidatePosition: positionOf(id),
        compareCount: next.length,
        currentCompareIds: next,
      });
      return next;
    });
  }
  function gotoSurvey() {
    router.push("/survey");
  }

  if (!session) return null;

  const compareCandidates = candidates.filter((c) => compareIds.includes(c.id));

  return (
    <div className="stack">
      <div className="row">
        <h1 style={{ margin: 0 }}>
          후보 탐색 {variant === "B" ? "(비교 기능 O)" : "(기본)"}
        </h1>
        <span className="spacer" />
        <span className="muted small">UI {variant}</span>
      </div>

      <ConditionBox scenario={scenario} />

      {finalId && (
        <div className="banner" data-testid={TESTID.selectedFinalBanner}>
          최종 선택: <b>{candidates.find((c) => c.id === finalId)?.name}</b>
        </div>
      )}

      <div className="grid-cards">
        {candidates.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            isSelectedFinal={finalId === c.id}
            onClickCard={handleClickCard}
            onSelectFinal={handleSelectFinal}
            compareSlot={
              enableCompare ? (
                compareIds.includes(c.id) ? (
                  <button
                    className="btn small btn-danger"
                    data-testid={TESTID.btnCompareRemove(c.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCompareRemove(c.id);
                    }}
                  >
                    비교 해제
                  </button>
                ) : (
                  <button
                    className="btn small"
                    data-testid={TESTID.btnCompareAdd(c.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCompareAdd(c.id);
                    }}
                  >
                    비교 담기
                  </button>
                )
              ) : undefined
            }
          />
        ))}
      </div>

      {enableCompare && (
        <ComparePanel
          candidates={compareCandidates}
          onRemove={handleCompareRemove}
          onSelectFinal={handleSelectFinal}
          finalId={finalId}
          onGotoSurvey={gotoSurvey}
        />
      )}

      <div className="row">
        <button
          className="btn-primary btn"
          data-testid={TESTID.btnGotoSurvey}
          disabled={!finalId}
          onClick={gotoSurvey}
        >
          최종 선택 완료 → 설문으로
        </button>
        {!finalId && <span className="muted small">후보를 최종 선택해야 진행됩니다.</span>}
      </div>
    </div>
  );
}
