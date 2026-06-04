#!/usr/bin/env python3
"""
이벤트 단위 집계.
logs/ 의 event 데이터를 읽어 A/B variant·participant_type 별 event_type 분포를 CSV로 만든다.

생성물 (analysis/out/):
  - events_long.csv         : 모든 세션의 event 를 합친 원자료 (고정 컬럼)
  - events_by_type.csv      : (ui_variant, participant_type, event_type) 별 발생 수

기초 집계만 수행한다. 결과 해석/결론 문장은 생성하지 않는다.
데이터가 없으면 안내 후 정상 종료(exit 0).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import (  # noqa: E402
    OUT_DIR,
    SCOPE,
    load_events,
    session_ids,
    write_csv,
)

EVENT_COLUMNS = [
    "session_id",
    "participant_id",
    "participant_type",
    "ui_variant",
    "event_type",
    "step_name",
    "timestamp",
    "elapsed_ms",
    "target_id",
    "candidate_id",
    "candidate_position",
    "compare_count",
    "current_compare_ids",
    "final_selected_candidate_id",
    "survey_difficulty",
    "survey_satisfaction",
    "survey_confidence",
]

BY_TYPE_COLUMNS = [
    "ui_variant",
    "participant_type",
    "event_type",
    "count",
    "session_count",
]


def _norm(e):
    """event dict(JSON 또는 CSV row)를 EVENT_COLUMNS 키로 정규화."""
    out = {}
    for c in EVENT_COLUMNS:
        v = e.get(c)
        if isinstance(v, list):
            v = "|".join(str(x) for x in v)
        out[c] = v
    return out


def main():
    ids = session_ids()
    if not ids:
        print(f"[aggregate_events] scope='{SCOPE}' 에 이벤트 데이터가 없습니다. (no event data)")
        print(f"  analysis/input/{SCOPE}/ 를 채우거나 ANALYSIS_SCOPE=pilot|all 로 실행하세요.")
        return 0

    all_events = []
    for sid in ids:
        for e in load_events(sid):
            all_events.append(_norm(e))

    if not all_events:
        print("[aggregate_events] 읽을 수 있는 이벤트가 없습니다. (no readable events)")
        return 0

    write_csv(os.path.join(OUT_DIR, "events_long.csv"), EVENT_COLUMNS, all_events)

    # (variant, ptype, event_type) 별 count + distinct session
    counts = {}
    sess_sets = {}
    for e in all_events:
        key = (e.get("ui_variant", ""), e.get("participant_type", ""), e.get("event_type", ""))
        counts[key] = counts.get(key, 0) + 1
        sess_sets.setdefault(key, set()).add(e.get("session_id"))

    by_type_rows = []
    for key in sorted(counts.keys()):
        variant, ptype, etype = key
        by_type_rows.append(
            {
                "ui_variant": variant,
                "participant_type": ptype,
                "event_type": etype,
                "count": counts[key],
                "session_count": len(sess_sets[key]),
            }
        )

    write_csv(os.path.join(OUT_DIR, "events_by_type.csv"), BY_TYPE_COLUMNS, by_type_rows)

    print(f"[aggregate_events] {len(all_events)} 이벤트 집계 완료.")
    print(f"  -> {os.path.join(OUT_DIR, 'events_long.csv')}")
    print(f"  -> {os.path.join(OUT_DIR, 'events_by_type.csv')}")
    print("  (이 스크립트는 표 집계만 수행하며 결과를 해석/결론짓지 않습니다.)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
