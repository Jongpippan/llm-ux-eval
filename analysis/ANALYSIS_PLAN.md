# 분석 파이프라인 점검 계획 (ANALYSIS_PLAN.md)

> 본 문서는 **본실험(main experiment) 전에 분석 파이프라인이 정상 동작하는지 점검**하기 위한 계획서다.
> 집계 가능성·스크립트 무결성 확인이 목적이며, **결과 해석·논문 결론은 다루지 않는다.**

## 1. 목적

- `aggregate_sessions.py` / `aggregate_events.py` 가 pilot 입력을 **에러 없이 집계**하는지 확인한다.
- 그룹핑 키(`ui_variant`, `participant_type`, `agent_arch`)가 의도대로 묶이는지 확인한다(LLM 은 `agent_arch` 로 generic baseline ↔ uxagent 분리).
- 본실험 데이터 수집 전, 데이터 없음·mock·pilot·real 분리 동작을 검증한다.
- 어디까지나 **파이프라인 점검**이며, pilot 수치로 실험 결론을 내리지 않는다.

## 2. 입력 구조 & 분석 범위(scope)

`analysis/input/` 하위를 용도별로 분리하고, **`ANALYSIS_SCOPE` 환경변수**로 스캔 범위를 정한다(`_common.py`).

| 디렉토리 | 용도 | 분석 대상 |
|---|---|---|
| `analysis/input/main/{human,llm}/` | **본실험** 데이터 | scope=main(기본) |
| `analysis/input/pilot/{human,llm}/` | pilot 데이터(검증 근거) | scope=pilot 일 때만 |
| `analysis/input/excluded/{mock,fallback}/` | mock·fallback 오염 | **항상 제외** |
| `logs/` | runtime/mock 산출 | **분석 제외**(입력 아님) |

- `ANALYSIS_SCOPE`: `main`(기본, `analysis/input/main/` 만) · `pilot`(`analysis/input/pilot/` 만) · `all`(main+pilot). `excluded/`·`logs/` 는 어떤 scope 에서도 스캔하지 않는다.
- 파일명은 **prefix 식**(`events_{sid}.csv`)과 **suffix 식**(`human_A_001_events.csv`) 을 모두 인식하며, 한 세션의 `session`/`events`/`export` 파일은 같은 `key` 로 묶인다(export json 의 events 우선).
- 수집물 배치: human → `analysis/input/main/human/`, clean LLM → `analysis/input/main/llm/`, 오염 run → `analysis/input/excluded/`.

## 3. 실행 방법

```bash
python3 analysis/aggregate_sessions.py            # 기본 scope=main (본실험)
python3 analysis/aggregate_events.py
ANALYSIS_SCOPE=pilot python3 analysis/aggregate_sessions.py   # pilot 분석
ANALYSIS_SCOPE=all   python3 analysis/aggregate_sessions.py   # main+pilot
```

산출물 위치: `analysis/out/`. 데이터 없음(해당 scope 비어 있음)이면 안내 후 exit 0.

| 파일 | 내용 |
|---|---|
| `sessions_long.csv` | 세션 1건 = 1행 (원자료) |
| `sessions_grouped.csv` | `(ui_variant, participant_type, agent_arch)` 별 session_count, **mean_task_duration_to_final_ms**(분석 canonical), mean_task_duration_ms(참고), mean_survey_difficulty/satisfaction/confidence, mean_event_count, final_choice_distribution. `agent_arch` 로 generic baseline ↔ uxagent 분리(human 은 공란) → Human/generic-LLM/uxagent-LLM 3-way 대조 |

> **수행시간 정의(중요)**: 분석의 과업 수행시간은 **`task_duration_to_final_ms` = 시작(started_at) → 마지막 `select_final`** 이다(설문 제출·finish·다운로드 제외). events 에서 파생 계산한다. 앱 기록 `task_duration_ms`(설문제출/finish 시점)는 원본 대조용으로만 둔다.
| `events_long.csv` | 전체 event 합본 (고정 컬럼) |
| `events_by_type.csv` | `(ui_variant, participant_type, event_type)` 별 count, session_count |

`sessions_long.csv` 에는 LLM provenance 컬럼(`llm_provider`, `llm_model`, `llm_temperature`, `used_mock_fallback`, `is_clean_llm_run`, `fallback_reason`, `agent_arch`, `persona_id`)이 포함된다.

## 3-1. LLM 데이터 구분 & clean run 필터 (중요)

- 시뮬레이션은 mock·real 모두 `participant_type=llm` 으로 기록된다 → **provenance 로 구분**한다.
- `aggregate_sessions.py` 는 **`participant_type=llm` 이면서 `is_clean_llm_run != true` 인 세션(순수 mock·fallback 오염)을 `sessions_grouped.csv` 집계에서 제외**하고, 제외 목록을 콘솔에 출력한다. human 세션은 영향 없음.
- 따라서 **clean LLM A/B 비교 전제**: real LLM 결과로 인정하는 것은 `is_clean_llm_run=true` 세션뿐이다. fallback 섞인 run 을 human↔LLM 비교에 쓰지 않는다.
- pilot/human/mock/llm 구분: human=`participant_type=human`(pilot 은 `analysis/input/`), mock/real-llm=`participant_type=llm`(`llm_provider`/`is_clean_llm_run` 로 세분), runtime/mock 로그는 `logs/`.
- provenance 재현성: clean LLM run 은 `llm_temperature` 를 함께 기록해 동일 조건 재현·비교가 가능하도록 하고, 각 세션에 `participant_id` 를 명시(권장)해 human↔llm 짝짓기·중복 식별을 용이하게 한다.

## 4. human pilot A/B (각 1회) QC 절차

본실험 전 점검 시 아래 컬럼/이벤트를 확인한다. (상세 검수는 `PILOT_QC_REPORT.md`)

- `participant_type` = human, `ui_variant` = A / B 로 올바르게 분류되는지
- **compare action count**: A 조건 = 0, B 조건 > 0 (A는 비교 기능 없음, B는 있음)
- survey 3종(`survey_difficulty` / `satisfaction` / `confidence`) 값 산출 여부
- `task_duration_ms` 이상치(비정상 장시간) 점검
- `final_choice_id` 후보 분포 산출 여부

### 집계 확인 결과 (사실, 해석 금지)

- **현재(A 재수집본 + B)**: `sessions_grouped.csv` = (A,human)=1, (B,human)=1, events = 51건(A 12 + B 39). A/B·human 그룹핑 정상.
- `events_by_type.csv`: **A compare action = 0**, **B `compare_add`=20·`view_compare`=4** 확인.
- 평균 수행시간 / 난이도 / 만족도 / 확신도, 최종 선택 후보 분포 모두 **산출됨** (A: 44,238ms·4/1/3·c03 / B: 1,352,559ms·4/2/4·c06).

> 위 수치는 **n=1 수준의 집계 확인용**이며, 그 자체로 의미를 부여하지 않는다(§6).

## 5. 본실험 전 점검 체크리스트

- [ ] 입력 로그가 없을 때 두 스크립트가 **에러 없이 "로그 없음" 안내 후 exit 0** 으로 종료
- [ ] pilot 입력(`analysis/input/`)에 대해 두 스크립트가 정상 집계 (4종 CSV 생성)
- [ ] 그룹핑 키 동작 확인: A/B는 `ui_variant`, human↔LLM은 `participant_type`
- [ ] compare action count A=0 / B>0 가 `events_by_type.csv` 에 반영됨
- [ ] survey 3종 평균이 `sessions_grouped.csv` 에 산출됨
- [ ] `task_duration_ms` 이상치(예: A_001 ~6.44시간) 식별 가능
- [ ] **mock(`logs/`) / pilot(`analysis/input/`) / real** 분리 유지 확인
- [ ] 본실험 시작 전 `logs/`·`analysis/input/`·`analysis/out/` 의 mock·pilot 산출물 정리

## 6. 과해석 금지 주의

- A 의 최초 수집본은 오염으로 **삭제**되었고, 현 `human_A_001` 은 **재수집된 clean 데이터**다(이력: `PILOT_QC_REPORT.md` §3·§3-1·§7-1).
- pilot 은 현재 **A·B 각 1회(조건당 n=1)** 다. 평균·분포·후보 분포에 **통계적 의미를 부여하지 말 것.**
- 단일 pilot 회차를 **본실험 결론으로 일반화하지 말 것.**
- **mock 로그를 실험 결과로 혼동하지 말 것.** 산출물은 입력 로그에 전적으로 의존한다.

## 6-1. 향후 분석 지표 (미구현 — 본실험 데이터 수집 후)

> 아래 지표는 **현재 미구현**이며, 본실험 데이터가 충분히 모인 뒤 분석 스크립트에 추가될 예정이다.
> 본 절은 **정의·계산 명세만** 기술하며, 계산 코드나 수치 결과는 생성하지 않는다. 결론 문장 작성 금지(§6).

- **click_candidate_count**: `events_long.csv` 에서 `event_type=click_candidate` 인 이벤트 수. (상세 보기 제거 — 모든 정보가 카드에 항상 표시되므로 `open_detail`/detail_open_count 는 더 이상 수집되지 않는다.)
- **viewed_candidate_count**: `click_candidate` 된 candidate 의 **distinct candidate 수**(중복 제거).
- **compare_action_count**: `compare_add` + `compare_remove` + `view_compare` 이벤트 수 합. A 조건은 비교 기능이 없어 **A=0 기대**.
- **final choice distribution**: 그룹별(`ui_variant`, `participant_type`) `final_selected_candidate_id` 의 분포(후보별 선택 횟수·비율).
- **A/B별 평균 설문 점수**: `ui_variant`(A/B) 별 `survey_difficulty` / `satisfaction` / `confidence` 의 평균.
- **human vs llm 방향 일치 여부**: 동일 지표에서 A→B 변화의 **부호**(증가/감소/동일)를 human 과 llm 간 비교하여 변화 방향이 일치하는지 판정.
- **선택 결과 일치 여부**: 같은 조건에서 human / llm 의 `final_selected_candidate_id` 가 동일한지(**exact match**)를 기준으로 한 일치율.
- **탐색 경로 유사도 후보**: viewed candidate set overlap, **Jaccard similarity**(두 set 의 교집합/합집합), (선택) sequence **edit distance**(이벤트/후보 열람 순서 열의 편집 거리).

## 7. 관련 문서

- `analysis/README.md` — 스크립트 사용법·입출력 요약
- `analysis/PILOT_QC_REPORT.md` — human pilot A·B 상세 QC 결과
- `docs/EXPERIMENT_DESIGN.md` — pilot/본실험·human/llm/mock 데이터 구분, A/B 통제
- `docs/EXPERIMENT.md` — 실험 실행 절차
- `docs/MAIN_EXPERIMENT_PLAN.md` — 본실험 설계·진행 계획
