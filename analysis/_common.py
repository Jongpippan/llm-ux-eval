"""
공통 유틸: 세션/이벤트 로그를 읽어 집계 가능한 형태로 제공한다.
표준 라이브러리만 사용한다 (pandas 등 외부 의존 없음).

입력 디렉토리 (둘 다, 재귀):
  - logs/            : 서버가 저장한 실측 로그 (mock/실험 공통). 파일명 = `events_{sid}.csv`, `session_{sid}.json` 등
  - analysis/input/  : human pilot 등 외부에서 받은 export 파일. descriptive 파일명도 인식
                       (예: `human_A_001_events.csv`, `human_A_001_session.csv`, `raw/human_A_001_export.json`)

파일명 규칙 (둘 다 인식):
  - prefix 식: `{role}_{key}.{ext}`  (role ∈ session|events|export)   예) events_6c07...csv
  - suffix 식: `{key}_{role}.{ext}`  (role ∈ session|events|export)   예) human_A_001_events.csv

레코드 1건 우선순위:
  - 세션: export(json) → session(json) → session(csv)
  - 이벤트: export(json) 내부 events → events(json) → events(csv)

본 스크립트는 실험 데이터를 생성하거나 결과를 해석/결론짓지 않는다.
단지 존재하는 로그를 기계적으로 집계한 표(CSV)를 만든다.
"""
import csv
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGS_DIR = os.path.join(ROOT, "logs")
INPUT_DIR = os.path.join(ROOT, "analysis", "input")
MAIN_DIR = os.path.join(INPUT_DIR, "main")
PILOT_DIR = os.path.join(INPUT_DIR, "pilot")
OUT_DIR = os.path.join(ROOT, "analysis", "out")

# 분석 범위(ANALYSIS_SCOPE): main(기본) | pilot | all.
#  - main: analysis/input/main/ 만 (본실험 데이터)
#  - pilot: analysis/input/pilot/ 만 (pilot 데이터 — 별도 분석)
#  - all: main + pilot
# analysis/input/excluded/ (mock·fallback) 와 logs/ 는 분석 대상에서 항상 제외한다.
SCOPE = (os.environ.get("ANALYSIS_SCOPE") or "main").lower()
if SCOPE == "pilot":
    INPUT_ROOTS = [PILOT_DIR]
elif SCOPE == "all":
    INPUT_ROOTS = [MAIN_DIR, PILOT_DIR]
else:
    SCOPE = "main"
    INPUT_ROOTS = [MAIN_DIR]

_PREFIX_RE = re.compile(r"^(session|events|export)_(.+)\.(csv|json)$")
_SUFFIX_RE = re.compile(r"^(.+)_(session|events|export)\.(csv|json)$")

_PREFIX_RE = re.compile(r"^(session|events|export)_(.+)\.(csv|json)$")
_SUFFIX_RE = re.compile(r"^(.+)_(session|events|export)\.(csv|json)$")


def ensure_out_dir():
    os.makedirs(OUT_DIR, exist_ok=True)


def _safe_load_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _load_csv_rows(path):
    try:
        with open(path, "r", encoding="utf-8", newline="") as f:
            return list(csv.DictReader(f))
    except Exception:
        return []


def _classify(filename):
    """파일명 → (key, role, ext) 또는 None. role ∈ {session,events,export}."""
    m = _PREFIX_RE.match(filename)
    if m:
        role, key, ext = m.group(1), m.group(2), m.group(3)
        return key, role, ext
    m = _SUFFIX_RE.match(filename)
    if m:
        key, role, ext = m.group(1), m.group(2), m.group(3)
        return key, role, ext
    return None


_registry_cache = None


def _registry():
    """입력 루트들을 재귀 스캔해 key → {role_ext: path} 레지스트리를 만든다."""
    global _registry_cache
    if _registry_cache is not None:
        return _registry_cache
    reg = {}
    for root in INPUT_ROOTS:
        if not os.path.isdir(root):
            continue
        for dirpath, _dirs, files in os.walk(root):
            for fn in files:
                hit = _classify(fn)
                if not hit:
                    continue
                key, role, ext = hit
                rec = reg.setdefault(key, {})
                # 동일 role_ext 가 여러 디렉토리에 있으면 먼저 발견된 것을 유지(logs 우선)
                rec.setdefault(f"{role}_{ext}", os.path.join(dirpath, fn))
    _registry_cache = reg
    return reg


def session_ids():
    """발견된 세션 레코드 key 목록 (logs/ + analysis/input/)."""
    return sorted(_registry().keys())


def _num(v):
    if v is None or v == "":
        return None
    try:
        f = float(v)
        return int(f) if f.is_integer() else f
    except (TypeError, ValueError):
        return None


def _bool(v):
    """JSON bool 또는 CSV 문자열("true"/"false"/"")을 bool|None 으로."""
    if isinstance(v, bool):
        return v
    if v in ("true", "True", "1"):
        return True
    if v in ("false", "False", "0"):
        return False
    return None


def load_session(sid):
    """세션 1건의 요약 dict 반환. 없으면 None."""
    rec = _registry().get(sid, {})
    # 1) export json (session + survey + events 동형) → session json
    data = None
    for kkey in ("export_json", "session_json"):
        if kkey in rec:
            data = _safe_load_json(rec[kkey])
            if data is not None:
                break
    if data is not None:
        sess = data.get("session", {})
        survey = data.get("survey") or {}
        events = data.get("events") or []
        return {
            "session_id": sess.get("session_id", sid),
            "participant_id": sess.get("participant_id", ""),
            "participant_type": sess.get("participant_type", ""),
            "ui_variant": sess.get("ui_variant", ""),
            "scenario_id": sess.get("scenario_id", ""),
            "started_at": sess.get("started_at"),
            "finished_at": data.get("finished_at"),
            "task_duration_ms": data.get("task_duration_ms"),
            "final_choice_id": data.get("final_choice_id"),
            "survey_difficulty": survey.get("difficulty"),
            "survey_satisfaction": survey.get("satisfaction"),
            "survey_confidence": survey.get("confidence"),
            "event_count": len(events) if events else None,
            "llm_provider": data.get("llm_provider"),
            "llm_model": data.get("llm_model"),
            "llm_temperature": data.get("llm_temperature"),
            "used_mock_fallback": _bool(data.get("used_mock_fallback")),
            "is_clean_llm_run": _bool(data.get("is_clean_llm_run")),
            "fallback_reason": data.get("fallback_reason"),
            "agent_arch": data.get("agent_arch"),
            "persona_id": data.get("persona_id"),
        }
    # 2) session csv (1행 요약)
    if "session_csv" in rec:
        rows = _load_csv_rows(rec["session_csv"])
        if rows:
            r = rows[0]
            return {
                "session_id": r.get("session_id", sid),
                "participant_id": r.get("participant_id", ""),
                "participant_type": r.get("participant_type", ""),
                "ui_variant": r.get("ui_variant", ""),
                "scenario_id": r.get("scenario_id", ""),
                "started_at": _num(r.get("started_at")),
                "finished_at": _num(r.get("finished_at")),
                "task_duration_ms": _num(r.get("task_duration_ms")),
                "final_choice_id": r.get("final_choice_id") or None,
                "survey_difficulty": _num(r.get("survey_difficulty")),
                "survey_satisfaction": _num(r.get("survey_satisfaction")),
                "survey_confidence": _num(r.get("survey_confidence")),
                "event_count": _num(r.get("event_count")),
                "llm_provider": r.get("llm_provider") or None,
                "llm_model": r.get("llm_model") or None,
                "llm_temperature": _num(r.get("llm_temperature")),
                "used_mock_fallback": _bool(r.get("used_mock_fallback")),
                "is_clean_llm_run": _bool(r.get("is_clean_llm_run")),
                "fallback_reason": r.get("fallback_reason") or None,
                "agent_arch": r.get("agent_arch") or None,
                "persona_id": r.get("persona_id") or None,
            }
    return None


def load_events(sid):
    """세션 1건의 event 목록(dict list) 반환."""
    rec = _registry().get(sid, {})
    if "export_json" in rec:
        data = _safe_load_json(rec["export_json"])
        if data and data.get("events"):
            return data["events"]
    if "events_json" in rec:
        data = _safe_load_json(rec["events_json"])
        if isinstance(data, list):
            return data
    if "events_csv" in rec:
        return _load_csv_rows(rec["events_csv"])
    return []


def mean(values):
    nums = [v for v in values if isinstance(v, (int, float))]
    if not nums:
        return None
    return round(sum(nums) / len(nums), 4)


def write_csv(path, columns, rows):
    ensure_out_dir()
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(columns)
        for r in rows:
            w.writerow([r.get(c, "") if r.get(c) is not None else "" for c in columns])
