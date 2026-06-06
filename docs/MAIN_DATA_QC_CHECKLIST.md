# 본실험 데이터 수집 후 QC 체크리스트 (MAIN_DATA_QC_CHECKLIST.md)

> 본 문서는 **본실험(main experiment) 데이터 수집 직후** 데이터 정합성을 기계적으로 점검하기 위한 체크리스트·기록 양식이다.
> 결과 해석·논문 결론은 다루지 않는다. **QC 절차와 기록 양식만** 제공한다.
> 실제값은 수집 후 채운다. 본 문서에는 가짜 데이터·가짜 수치를 기입하지 않는다.

## 0. 전제 (사실)

- 1차 본실험 규모: **Human 10세션**(A 5 + B 5), **LLM uxagent 20세션**(A 10 + B 10, persona 20명 between), **LLM generic baseline 10세션**(A 5 + B 5). LLM 은 `agent_arch`(`uxagent`/`generic`)로 구분.
- 본실험 데이터 위치
  - human: `analysis/input/main/human/`
  - llm: `analysis/input/main/llm/`
- 제외 데이터 위치(본실험과 분리 보관)
  - mock: `analysis/input/excluded/mock/`
  - fallback: `analysis/input/excluded/fallback/`
- pilot 데이터는 `analysis/input/pilot/` 에 별도 보관(본실험과 분리).
- 세션당 파일 3종: `*_session.csv`, `*_events.csv`, `raw/*_export.json` (또는 prefix 식 `session_*` / `events_*` / `export_*`).
- 집계 스크립트
  - `python3 analysis/aggregate_sessions.py` (기본 scope=main)
  - `python3 analysis/aggregate_events.py`
  - 산출물: `analysis/out/`
  - mock·fallback(`participant_type=llm` 이면서 `is_clean_llm_run != true`)은 집계에서 **자동 제외**된다.
- provenance 필드: `llm_provider`, `llm_model`, `llm_temperature`, `used_mock_fallback`, `is_clean_llm_run`, `fallback_reason`, `agent_arch`, `persona_id`.

> **규모 주석**: 아래 §1~§10 의 점검 수치(10/20 등)는 본래 1차 Human10+LLM10(20세션) 기준으로 작성되었다. uxagent 20 + generic 10 도입으로 LLM 총 30세션이 되었으니, LLM 수치는 **agent_arch 별로 분리해**(uxagent A10/B10, generic A5/B5) 점검한다. human 수치는 그대로.

---

## 1. 파일 수량 확인

기대: human 10세션 / clean LLM 10세션, 각 세션 3파일.

- [ ] `analysis/input/main/human/` 에 human 세션 **10개** 존재 (A 5 + B 5)
- [ ] `analysis/input/main/llm/` 에 clean LLM 세션 **10개** 존재 (A 5 + B 5)
- [ ] 각 human 세션마다 `session.csv` / `events.csv` / `raw export.json` **3파일** 모두 존재
- [ ] 각 LLM 세션마다 `session.csv` / `events.csv` / `raw export.json` **3파일** 모두 존재
- [ ] 누락·중복·고아 파일(짝 없는 csv/json) 없음

## 2. participant_id 중복 확인

- [ ] human 세션 간 `participant_id` 중복 없음 (10개 모두 distinct)
- [ ] LLM 세션 간 `participant_id` 중복 없음 (10개 모두 distinct)
- [ ] `participant_id` 가 비어있거나 dev 자동생성(`dev-xxxx`) 패턴이 아닌, 명시 입력 ID 인지 확인
- [ ] human↔llm 짝짓기 의도가 있는 경우, 짝짓기 키 규칙이 일관되게 적용됨

## 3. A/B 수량 균형 확인

기대: type 별 A 5 / B 5.

- [ ] human: `ui_variant=A` **5세션**, `ui_variant=B` **5세션**
- [ ] llm: `ui_variant=A` **5세션**, `ui_variant=B` **5세션**
- [ ] `ui_variant` 값이 `A` / `B` 외 다른 값(빈 값·오타) 없음

## 4. human / llm 구분 확인

- [ ] human 세션 전부 `participant_type=human`
- [ ] llm 세션 전부 `participant_type=llm`
- [ ] llm 세션 provenance 로 real-LLM 임을 확인 (`llm_provider` 기록, `is_clean_llm_run=true`)
- [ ] human 세션에는 LLM provenance 값이 채워져 있지 않음(또는 비어있음 — human 무관 필드)
- [ ] `participant_type` 가 `human` / `llm` 외 다른 값 없음

## 5. pilot / mock / fallback 제외 확인

- [ ] `analysis/input/main/` 안에 **pilot 파일이 섞이지 않음**
- [ ] `analysis/input/main/` 안에 **mock 파일이 섞이지 않음** (`used_mock_fallback=true` 세션 없음)
- [ ] `analysis/input/main/` 안에 **fallback 오염 세션이 섞이지 않음** (`participant_type=llm` & `is_clean_llm_run != true` 없음)
- [ ] mock 데이터는 `analysis/input/excluded/mock/` 에 분리 보관됨
- [ ] fallback 데이터는 `analysis/input/excluded/fallback/` 에 분리 보관됨
- [ ] pilot 데이터는 `analysis/input/pilot/` 에 분리 보관됨
- [ ] `aggregate_sessions.py` 실행 시 콘솔에 출력되는 **제외 목록**에 main 세션이 포함되지 않음

## 6. 필수 필드 비어있지 않음 확인

대상 필드(세션당, 비어있지 않은지): `task_duration_ms`, `final_selected_candidate_id`, `survey_difficulty`, `survey_satisfaction`, `survey_confidence`.

- [ ] 모든 세션(human 10 + llm 10)에서 `task_duration_ms` 비어있지 않음
- [ ] 모든 세션에서 `final_selected_candidate_id` 비어있지 않음
- [ ] 모든 세션에서 `survey_difficulty` 비어있지 않음
- [ ] 모든 세션에서 `survey_satisfaction` 비어있지 않음
- [ ] 모든 세션에서 `survey_confidence` 비어있지 않음
- [ ] survey 3종 값이 응답 척도 범위 내(스케일 외 이상값 없음)

## 7. LLM clean run 필드 확인

- [ ] 모든 llm 세션 `is_clean_llm_run=true`
- [ ] 모든 llm 세션 `used_mock_fallback=false`
- [ ] 모든 llm 세션 `llm_model` 기록됨(비어있지 않음)
- [ ] 모든 llm 세션 `llm_temperature` 기록됨(재현성)
- [ ] `fallback_reason` 이 비어있음(또는 fallback 미발생 표시) — 값이 있으면 clean 여부 재확인
- [ ] llm 세션 간 `llm_model` / `llm_temperature` 가 비교 전제에 맞게 일관됨
- [ ] **`agent_arch`** 기록됨 — uxagent run=`uxagent`, baseline=`generic` (분석에서 분리 집계)
- [ ] uxagent 세션은 **`persona_id`** 기록됨, generic 세션은 비어 있음
- [ ] uxagent A10/B10 의 persona_id 가 배정표(p01~p10→A, p11~p20→B)와 일치, 중복 없음

## 8. B 조건 compare action 여부 확인 (기록만 — 자동 실패 처리 금지)

> compare action = `compare_add` + `compare_remove` + `view_compare` 이벤트 수 합.
> **B 에서 compare 미사용이라도 자동 실패로 처리하지 않는다.** 사용 여부를 기록만 한다.

- [ ] human B 5세션 각각의 compare action count 를 §10 비고에 **기록** (0 이어도 실패 아님)
- [ ] llm B 5세션 각각의 compare action count 를 §10 비고에 **기록** (0 이어도 실패 아님)
- [ ] compare action 이 0 인 B 세션이 있으면 그 사실만 기록(원인 추정·결론 금지)

## 9. A 조건 compare action 없음 확인

> A 조건은 비교 기능이 없으므로 compare action = 0 이 기대값이다.

- [ ] human A 5세션 모두 compare action count = **0**
- [ ] llm A 5세션 모두 compare action count = **0**
- [ ] A 세션에서 `compare_add` / `compare_remove` / `view_compare` 이벤트가 0 이 아니면 원인 점검(코드버전 오염·로깅 오류 가능성)

---

## 10. QC 결과 기록 양식 (수집 후 채움)

> 실제값·통과여부는 **수집 후** 채운다. 아래 표에는 가짜 수치를 넣지 않는다.
> 통과여부 표기: 통과 / 실패 / 보류(기록만). §8(B compare)은 통과·실패 대신 **기록**으로 남긴다.

### 10-1. 항목별 점검표

| 항목 | 기대 | 실제 | 통과여부 | 비고 |
|---|---|---|---|---|
| (1) human 세션 수 | 10 (A5+B5) |  |  |  |
| (1) llm 세션 수 | 10 (A5+B5) |  |  |  |
| (1) 세션당 파일 3종 | 모두 존재 |  |  |  |
| (2) human participant_id 중복 | 0 (10 distinct) |  |  |  |
| (2) llm participant_id 중복 | 0 (10 distinct) |  |  |  |
| (3) human A/B 균형 | A5 / B5 |  |  |  |
| (3) llm A/B 균형 | A5 / B5 |  |  |  |
| (4) human participant_type | 전부 human |  |  |  |
| (4) llm participant_type | 전부 llm |  |  |  |
| (5) main/ 에 pilot/mock/fallback 혼입 | 없음 |  |  |  |
| (5) excluded/ 분리 보관 | mock·fallback 분리 |  |  |  |
| (6) task_duration_ms 비공란 | 20/20 |  |  |  |
| (6) final_selected_candidate_id 비공란 | 20/20 |  |  |  |
| (6) survey_difficulty 비공란 | 20/20 |  |  |  |
| (6) survey_satisfaction 비공란 | 20/20 |  |  |  |
| (6) survey_confidence 비공란 | 20/20 |  |  |  |
| (7) llm is_clean_llm_run=true | 10/10 |  |  |  |
| (7) llm used_mock_fallback=false | 10/10 |  |  |  |
| (7) llm llm_model 기록 | 10/10 |  |  |  |
| (7) llm llm_temperature 기록 | 10/10 |  |  |  |
| (9) A compare action = 0 | human A 5 / llm A 5 모두 0 |  |  |  |

### 10-2. B 조건 compare action 기록표 (기록 전용 — 통과/실패 판정 안 함)

| 세션 | type | participant_id | compare action count | 비고 |
|---|---|---|---|---|
| human B #1 | human |  |  |  |
| human B #2 | human |  |  |  |
| human B #3 | human |  |  |  |
| human B #4 | human |  |  |  |
| human B #5 | human |  |  |  |
| llm B #1 | llm |  |  |  |
| llm B #2 | llm |  |  |  |
| llm B #3 | llm |  |  |  |
| llm B #4 | llm |  |  |  |
| llm B #5 | llm |  |  |  |

### 10-3. 종합

| 구분 | 값 |
|---|---|
| QC 수행일 |  |
| 수행자 |  |
| 집계 스크립트 실행 여부 (`aggregate_sessions.py` / `aggregate_events.py`) |  |
| 제외 목록 콘솔 출력에 main 세션 포함 여부 |  |
| 미통과 항목 수 |  |
| 후속 조치(재수집·재집계 등) |  |

---

## 11. 관련 문서

- `analysis/PILOT_QC_REPORT.md` — human pilot A·B 상세 QC 결과(참고)
- `analysis/ANALYSIS_PLAN.md` — 분석 파이프라인 점검 계획·집계 동작
- `analysis/README.md` — 스크립트 사용법·입출력 요약
