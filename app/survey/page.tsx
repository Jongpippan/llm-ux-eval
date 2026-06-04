"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { logEvent } from "@/lib/logger";
import { getSession } from "@/lib/session";
import { TESTID } from "@/lib/testids";
import { LikertGroup } from "@/components/LikertGroup";
import type { SurveyAnswer } from "@/lib/types";

const SURVEY_KEY = "experiment_survey";

export default function SurveyPage() {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [freeText, setFreeText] = useState("");

  const canSubmit = difficulty != null && satisfaction != null && confidence != null;

  async function submit() {
    if (!canSubmit) return;
    const answer: SurveyAnswer = {
      difficulty: difficulty!,
      satisfaction: satisfaction!,
      confidence: confidence!,
      freeText: freeText || undefined,
    };
    if (typeof window !== "undefined")
      window.localStorage.setItem(SURVEY_KEY, JSON.stringify(answer));

    await logEvent("answer_survey", {
      stepName: "survey",
      detail: { ...answer },
      surveyDifficulty: answer.difficulty,
      surveySatisfaction: answer.satisfaction,
      surveyConfidence: answer.confidence,
    });

    // 세션 결과를 서버에 저장 (best-effort)
    const session = getSession();
    const finalId =
      typeof window !== "undefined"
        ? window.localStorage.getItem("experiment_final_choice")
        : null;
    if (session && process.env.NEXT_PUBLIC_STATIC_EXPORT !== "1") {
      try {
        await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session,
            final_choice_id: finalId,
            survey: answer,
            finished_at: null,
            task_duration_ms: Date.now() - session.started_at,
          }),
        });
      } catch {
        /* ignore */
      }
    }
    router.push("/complete");
  }

  return (
    <div className="stack">
      <h1>사후 설문</h1>
      <div className="card stack">
        <LikertGroup
          testidGroup={TESTID.surveyDifficulty}
          optionTestid={TESTID.surveyDifficultyOption}
          label="이 과업의 수행 난이도는 어땠나요?"
          value={difficulty}
          onChange={setDifficulty}
        />
        <LikertGroup
          testidGroup={TESTID.surveySatisfaction}
          optionTestid={TESTID.surveySatisfactionOption}
          label="인터페이스 사용 만족도는 어땠나요?"
          value={satisfaction}
          onChange={setSatisfaction}
        />
        <LikertGroup
          testidGroup={TESTID.surveyConfidence}
          optionTestid={TESTID.surveyConfidenceOption}
          label="내 최종 선택에 대한 확신도는 어느 정도인가요?"
          value={confidence}
          onChange={setConfidence}
        />
        <div>
          <div>
            <b>자유 응답 (선택)</b>
          </div>
          <textarea
            data-testid={TESTID.surveyFreetext}
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={3}
            style={{ width: "100%", marginTop: 6 }}
            placeholder="의견이 있다면 자유롭게 작성해주세요."
          />
        </div>
        <div className="row">
          <button
            className="btn-primary btn"
            data-testid={TESTID.btnSubmitSurvey}
            disabled={!canSubmit}
            onClick={submit}
          >
            설문 제출
          </button>
          {!canSubmit && (
            <span className="muted small">세 항목 모두 응답해야 제출할 수 있습니다.</span>
          )}
        </div>
      </div>
    </div>
  );
}
