"use client";

import { useEffect, useState } from "react";
import { logEvent, downloadLogsFile, getLogs } from "@/lib/logger";
import { getSession } from "@/lib/session";
import { TESTID } from "@/lib/testids";
import {
  downloadSessionExport,
  downloadSessionJson,
  type SessionExportInput,
} from "@/lib/export";
import type { SessionInfo, SurveyAnswer } from "@/lib/types";

// 정적 배포(GitHub Pages 등, 서버 없음)에서는 결과를 참가자가 직접 export.json 으로 제출한다.
const STATIC = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";

function readFinalChoice(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("experiment_final_choice");
}

function readSurvey(): SurveyAnswer | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("experiment_survey");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SurveyAnswer;
  } catch {
    return null;
  }
}

export default function CompletePage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [logCount, setLogCount] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const s = getSession();
    setSession(s);
    setLogCount(getLogs(s?.session_id).length);
  }, []);

  function buildExportInput(finishedAt: number | null): SessionExportInput | null {
    if (!session) return null;
    return {
      session,
      finalChoiceId: readFinalChoice(),
      survey: readSurvey(),
      finishedAt,
      taskDurationMs: Date.now() - session.started_at,
      events: getLogs(session.session_id),
    };
  }

  async function finish() {
    const finalId = readFinalChoice();
    await logEvent("finish", {
      stepName: "complete",
      finalSelectedCandidateId: finalId,
    });
    setFinished(true);
    setLogCount(getLogs(session?.session_id).length);

    if (STATIC) {
      // 서버 없음: 결과 파일(export.json)을 자동 다운로드해 참가자가 제출하도록 유도.
      const input = buildExportInput(Date.now());
      if (input) downloadSessionJson(input);
      return;
    }
    // 서버 모드: finished_at 갱신 + export 산출물(서버) 저장
    if (session) {
      const survey = readSurvey();
      try {
        await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session,
            final_choice_id: finalId,
            survey,
            finished_at: Date.now(),
            task_duration_ms: Date.now() - session.started_at,
            events: getLogs(session.session_id),
          }),
        });
      } catch {
        /* ignore */
      }
    }
  }

  function exportJson() {
    const input = buildExportInput(finished ? Date.now() : null);
    if (input) downloadSessionJson(input);
  }
  function exportCsv() {
    const input = buildExportInput(finished ? Date.now() : null);
    if (input) downloadSessionExport(input);
  }

  return (
    <div className="stack">
      <h1>실험 완료</h1>
      <div className="card stack">
        <p>참여해 주셔서 감사합니다. 모든 행동 로그가 기록되었습니다.</p>
        {STATIC ? (
          <p className="small muted">
            아래 <b>‘실험 종료 & 결과 저장’</b> 버튼을 누르면 <b>결과 파일(export_…json)</b> 이
            자동으로 다운로드됩니다. <b>그 파일을 실험자에게 제출(메일/업로드)</b>해 주세요.
          </p>
        ) : (
          <p className="small muted">
            마지막으로 아래 <b>‘실험 종료’</b> 버튼을 눌러 완료를 기록해 주세요.
          </p>
        )}
        {session && (
          <p className="small muted">
            세션: <code>{session.session_id}</code> · 참여자{" "}
            <code>{session.participant_id}</code> · UI {session.ui_variant} ·{" "}
            {session.participant_type} · 이벤트 {logCount}건
          </p>
        )}
        <div className="row">
          <button className="btn-primary btn" data-testid={TESTID.btnFinish} onClick={finish}>
            {finished ? "완료됨" : STATIC ? "실험 종료 & 결과 저장" : "실험 종료(finish 기록)"}
          </button>
          {STATIC ? (
            <button className="btn" data-testid={TESTID.btnExportJson} onClick={exportJson}>
              결과 파일(JSON) 다시 받기
            </button>
          ) : (
            <>
              <button
                className="btn"
                data-testid={TESTID.btnExportJson}
                onClick={() => downloadLogsFile(session?.session_id)}
              >
                로그 JSON 내려받기
              </button>
              <button className="btn" data-testid={TESTID.btnExportCsv} onClick={exportCsv}>
                CSV 내려받기 (session JSON + events.csv + summary.csv)
              </button>
            </>
          )}
        </div>
        {finished && (
          <div className="banner">
            {STATIC
              ? "결과 파일(export_…json)이 다운로드되었습니다. 이 파일을 실험자에게 제출해 주세요. (안 받아졌으면 ‘결과 파일(JSON) 다시 받기’)"
              : "finish 이벤트가 기록되었습니다."}
          </div>
        )}
      </div>
    </div>
  );
}
