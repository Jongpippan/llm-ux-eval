#!/usr/bin/env python3
"""
세션 단위 집계.
logs/ 의 세션 데이터를 읽어 A/B variant·participant_type 별로 묶을 수 있는 CSV를 생성한다.

생성물 (analysis/out/):
  - sessions_long.csv      : 세션 1건 = 1행 (원자료)
  - sessions_grouped.csv   : (ui_variant, participant_type) 그룹별 기초 집계

기초 집계 함수만 둔다: 세션 수, 평균 수행시간, 평균 난이도/만족도/확신도, 평균 이벤트 수.
결과 해석/결론 문장은 생성하지 않는다. 데이터가 없으면 안내 후 정상 종료(exit 0).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import (  # noqa: E402
    OUT_DIR,
    SCOPE,
    _num,
    load_events,
    load_session,
    mean,
    session_ids,
    write_csv,
)


def duration_to_final_ms(key, started_at):
    """과업 수행시간(분석 canonical) = 시작(started_at) → **마지막 select_final** 시점.
    설문 제출·finish·다운로드 등 과업 이후 시간은 제외한다. select_final 이 없으면 None.
    각 이벤트의 elapsed_ms(= timestamp - started_at)를 우선 사용한다."""
    sels = [e for e in load_events(key) if e.get("event_type") == "select_final"]
    if not sels:
        return None
    last = sels[-1]
    el = _num(last.get("elapsed_ms"))
    if el is not None:
        return el
    ts = _num(last.get("timestamp"))
    if ts is not None and isinstance(started_at, (int, float)):
        return ts - started_at
    return None

SESSION_COLUMNS = [
    "session_id",
    "participant_id",
    "participant_type",
    "ui_variant",
    "scenario_id",
    "started_at",
    "finished_at",
    "task_duration_to_final_ms",
    "task_duration_ms",
    "final_choice_id",
    "survey_difficulty",
    "survey_satisfaction",
    "survey_confidence",
    "event_count",
    "llm_provider",
    "llm_model",
    "llm_temperature",
    "used_mock_fallback",
    "is_clean_llm_run",
    "fallback_reason",
]

GROUP_COLUMNS = [
    "ui_variant",
    "participant_type",
    "session_count",
    "mean_task_duration_to_final_ms",
    "mean_task_duration_ms",
    "mean_survey_difficulty",
    "mean_survey_satisfaction",
    "mean_survey_confidence",
    "mean_event_count",
    "final_choice_distribution",  # id:count|id:count
]


def main():
    ids = session_ids()
    if not ids:
        print(f"[aggregate_sessions] scope='{SCOPE}' 에 세션 데이터가 없습니다. (no session data)")
        print(f"  analysis/input/{SCOPE}/ 를 채우거나 ANALYSIS_SCOPE=pilot|all 로 실행하세요.")
        return 0
    print(f"[aggregate_sessions] scope='{SCOPE}'")

    sessions = []
    for sid in ids:
        s = load_session(sid)
        if s is None:
            continue
        # 분석 canonical 수행시간: 시작 → 최종선택(select_final). events 에서 파생.
        s["task_duration_to_final_ms"] = duration_to_final_ms(sid, s.get("started_at"))
        sessions.append(s)
    if not sessions:
        print("[aggregate_sessions] 읽을 수 있는 세션이 없습니다. (no readable sessions)")
        return 0

    write_csv(os.path.join(OUT_DIR, "sessions_long.csv"), SESSION_COLUMNS, sessions)

    # clean LLM run 필터: participant_type=='llm' 인데 is_clean_llm_run 이 True 가 아니면
    # (mock 또는 fallback 오염) real LLM 결과로 집계하지 않는다(grouped 에서 제외).
    excluded = [
        s for s in sessions
        if s.get("participant_type") == "llm" and s.get("is_clean_llm_run") is not True
    ]
    included = [s for s in sessions if s not in excluded]
    if excluded:
        print(f"  [주의] is_clean_llm_run != true 인 llm 세션 {len(excluded)}건은 real LLM 집계에서 제외:")
        for s in excluded:
            print(f"    - {s.get('session_id')} (provider={s.get('llm_provider')}, used_mock_fallback={s.get('used_mock_fallback')})")

    # (ui_variant, participant_type) 그룹핑 (clean LLM 만, human/은 그대로)
    groups = {}
    for s in included:
        key = (s.get("ui_variant", ""), s.get("participant_type", ""))
        groups.setdefault(key, []).append(s)

    grouped_rows = []
    for (variant, ptype), rows in sorted(groups.items()):
        dist = {}
        for r in rows:
            fid = r.get("final_choice_id")
            if fid:
                dist[fid] = dist.get(fid, 0) + 1
        dist_str = "|".join(f"{k}:{v}" for k, v in sorted(dist.items()))
        grouped_rows.append(
            {
                "ui_variant": variant,
                "participant_type": ptype,
                "session_count": len(rows),
                "mean_task_duration_to_final_ms": mean([r.get("task_duration_to_final_ms") for r in rows]),
                "mean_task_duration_ms": mean([r.get("task_duration_ms") for r in rows]),
                "mean_survey_difficulty": mean([r.get("survey_difficulty") for r in rows]),
                "mean_survey_satisfaction": mean([r.get("survey_satisfaction") for r in rows]),
                "mean_survey_confidence": mean([r.get("survey_confidence") for r in rows]),
                "mean_event_count": mean([r.get("event_count") for r in rows]),
                "final_choice_distribution": dist_str,
            }
        )

    write_csv(os.path.join(OUT_DIR, "sessions_grouped.csv"), GROUP_COLUMNS, grouped_rows)

    print(f"[aggregate_sessions] {len(sessions)} 세션 집계 완료.")
    print(f"  -> {os.path.join(OUT_DIR, 'sessions_long.csv')}")
    print(f"  -> {os.path.join(OUT_DIR, 'sessions_grouped.csv')}")
    print("  (이 스크립트는 표 집계만 수행하며 결과를 해석/결론짓지 않습니다.)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
