"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getScenario } from "@/lib/candidates";
import { getOrCreateSession } from "@/lib/session";
import { logEvent } from "@/lib/logger";
import { ConditionBox } from "@/components/ConditionBox";
import { TESTID } from "@/lib/testids";
import type { ParticipantType, UiVariant } from "@/lib/types";

function ExperimentInner() {
  const router = useRouter();
  const params = useSearchParams();
  const variant = (params.get("variant") === "B" ? "B" : "A") as UiVariant;
  const participant = (params.get("participant") === "llm"
    ? "llm"
    : "human") as ParticipantType;
  const pid = params.get("pid") ?? undefined;
  const scenario = useMemo(() => getScenario(), []);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getOrCreateSession({ variant, participant, participantId: pid });
    void logEvent("view_condition", {
      stepName: "task",
      detail: { scenario_id: scenario.id, variant },
    });
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goExplore() {
    const base = variant === "B" ? "/b" : "/a";
    router.push(pid ? `${base}?pid=${encodeURIComponent(pid)}` : base);
  }

  if (!ready) return null;

  return (
    <div className="stack">
      <h1>과업 조건 확인</h1>
      <ConditionBox scenario={scenario} />
      <div className="card small muted">
        조건을 확인했다면 아래 버튼을 눌러 후보 탐색(UI {variant}) 화면으로 이동하세요.
      </div>
      <div className="row">
        <button
          className="btn-primary btn"
          data-testid={TESTID.btnGotoExplore}
          onClick={goExplore}
        >
          후보 탐색 시작
        </button>
      </div>
    </div>
  );
}

export default function ExperimentPage() {
  return (
    <Suspense fallback={null}>
      <ExperimentInner />
    </Suspense>
  );
}
