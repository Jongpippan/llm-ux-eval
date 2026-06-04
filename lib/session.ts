import type { ParticipantType, SessionInfo, UiVariant } from "@/lib/types";

const STORAGE_KEY = "experiment_session";

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "sess-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** 개발/기본용 participant_id (실험에서는 명시 입력 권장). */
function genDevParticipantId(): string {
  return "dev-" + Math.random().toString(36).slice(2, 8);
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function parseVariant(v: string | null): UiVariant {
  return v === "B" ? "B" : "A";
}

function parseParticipant(p: string | null): ParticipantType {
  return p === "llm" ? "llm" : "human";
}

/**
 * URL query(?variant=A&participant=human&scenario=s1)와 localStorage를 사용해
 * 세션을 가져오거나 새로 만든다. 클라이언트 전용(window guard).
 *
 * variant/participant가 query로 명시되면 그것을 우선하고 세션을 갱신한다.
 */
export function getOrCreateSession(opts?: {
  variant?: UiVariant;
  participant?: ParticipantType;
  participantId?: string;
  scenarioId?: string;
}): SessionInfo {
  let variant: UiVariant = opts?.variant ?? "A";
  let participant: ParticipantType = opts?.participant ?? "human";
  let participantId: string | undefined = opts?.participantId;
  let scenarioId = opts?.scenarioId ?? "s1";
  let participantIdSpecified = Boolean(opts?.participantId);

  if (isBrowser()) {
    const url = new URL(window.location.href);
    const qVariant = url.searchParams.get("variant");
    const qParticipant = url.searchParams.get("participant");
    const qPid = url.searchParams.get("pid");
    const qScenario = url.searchParams.get("scenario");
    if (!opts?.variant && qVariant) variant = parseVariant(qVariant);
    if (!opts?.participant && qParticipant) participant = parseParticipant(qParticipant);
    if (!opts?.participantId && qPid) {
      participantId = qPid;
      participantIdSpecified = true;
    }
    if (!opts?.scenarioId && qScenario) scenarioId = qScenario;

    // participant가 명시적으로 주어지지 않았는지(opt/쿼리 모두 없음) 여부
    const participantSpecified = Boolean(opts?.participant) || Boolean(qParticipant);

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const existing = JSON.parse(raw) as SessionInfo;
        // variant가 같으면 기존 세션 재사용.
        // participant/participant_id가 이번 호출에서 명시되지 않았다면 기존 세션 값을 유지한다.
        // (예: /a, /b 페이지 URL에는 participant/pid 쿼리가 없으므로 intro에서 정해진 값을 이어받음)
        if (
          existing.ui_variant === variant &&
          (!participantSpecified || existing.participant_type === participant) &&
          (!participantIdSpecified || existing.participant_id === participantId)
        ) {
          // 기존 세션에 participant_id가 없던 경우(구버전) 안전 보강
          if (!existing.participant_id) {
            existing.participant_id = participantId ?? genDevParticipantId();
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
          }
          return existing;
        }
      } catch {
        /* ignore corrupt */
      }
    }
  }

  const session: SessionInfo = {
    session_id: genId(),
    participant_id: participantId ?? genDevParticipantId(),
    ui_variant: variant,
    participant_type: participant,
    scenario_id: scenarioId,
    started_at: Date.now(),
  };

  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
  return session;
}

export function getSession(): SessionInfo | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionInfo;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (isBrowser()) window.localStorage.removeItem(STORAGE_KEY);
}
