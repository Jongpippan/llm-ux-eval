"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { TESTID } from "@/lib/testids";
import { getOrCreateSession } from "@/lib/session";
import { logEvent } from "@/lib/logger";
import type { ParticipantType, UiVariant } from "@/lib/types";

function IntroInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [variant, setVariant] = useState<UiVariant>(
    params.get("variant") === "B" ? "B" : "A"
  );
  const [participant, setParticipant] = useState<ParticipantType>(
    params.get("participant") === "llm" ? "llm" : "human"
  );
  const [participantId, setParticipantId] = useState<string>(
    params.get("pid") ?? ""
  );

  function start() {
    const pid = participantId.trim() || undefined; // 미입력 시 session 이 dev-id 생성
    const session = getOrCreateSession({
      variant,
      participant,
      participantId: pid,
    });
    void logEvent("experiment_start", {
      stepName: "intro",
      detail: {
        variant,
        participant,
        participant_id: session.participant_id,
      },
    });
    const q = new URLSearchParams({
      variant,
      participant,
      pid: session.participant_id,
    });
    router.push(`/experiment?${q.toString()}`);
  }

  return (
    <div className="stack">
      <h1>비교 인터페이스 사용성 실험</h1>
      <div className="card">
        <p>안녕하세요. 본 실험은 무선 이어폰 후보 중 조건에 맞는 제품을 선택하는 과업입니다.</p>
        <p className="small muted">
          표시되는 제품/브랜드는 모두 <b>가상의 예시 데이터</b>이며 실제 제품이 아닙니다.
        </p>
        <ul className="small">
          <li>과업 조건을 확인합니다.</li>
          <li>후보를 탐색하고 (UI {variant}) 최종 1개를 선택합니다.</li>
          <li>사후 설문(난이도/만족도/확신도)에 응답합니다.</li>
        </ul>

        <div className="stack" style={{ gap: 8, marginTop: 8 }}>
          <label className="small">
            <div>
              <b>참여자 ID (participant_id)</b>
            </div>
            <input
              data-testid={TESTID.inputParticipantId}
              type="text"
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              placeholder="예: P01 (미입력 시 dev-xxxx 자동 생성)"
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>

          <label className="small">
            <div>
              <b>참여자 유형 (participant_type)</b>
            </div>
            <select
              data-testid={TESTID.selectParticipantType}
              value={participant}
              onChange={(e) => setParticipant(e.target.value as ParticipantType)}
              style={{ marginTop: 4 }}
            >
              <option value="human">human</option>
              <option value="llm">llm</option>
            </select>
          </label>

          <label className="small">
            <div>
              <b>UI 조건 (ui_variant)</b>
            </div>
            <select
              data-testid={TESTID.selectVariant}
              value={variant}
              onChange={(e) => setVariant(e.target.value as UiVariant)}
              style={{ marginTop: 4 }}
            >
              <option value="A">A (비교 기능 없음)</option>
              <option value="B">B (비교 기능 있음)</option>
            </select>
          </label>
        </div>

        <p className="small muted" style={{ marginTop: 8 }}>
          현재 조건: UI <b>{variant}</b> / 참여자 <b>{participant}</b> / ID{" "}
          <b>{participantId.trim() || "(미입력 → 자동 생성)"}</b>
        </p>
        <p className="small muted">
          실험용으로는 <b>participant_id / participant_type 을 명시 입력</b>하는 것을 권장합니다.
        </p>

        <button
          className="btn-primary btn"
          data-testid={TESTID.btnStart}
          onClick={start}
        >
          실험 시작
        </button>
      </div>
      <p className="small muted">
        조건 변경: <code>?variant=A|B&participant=human|llm&pid=P01</code> 쿼리로도 지정 가능
      </p>
    </div>
  );
}

export default function Page() {
  // suppress hydration warning for searchParams CSR bailout
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  useEffect(() => {}, []);
  return (
    <Suspense fallback={null}>
      <IntroInner />
    </Suspense>
  );
}
