# Human Pilot QC Report

> 본 문서는 **이미 사용자가 수행한 human pilot(A·B 각 1회)** export 파일을 기계적으로 검수한 결과다.
> 결과를 해석하거나 논문 결론을 내리지 않는다. 데이터 정합성·실험 준비 관점의 점검만 수행한다.
> 본 pilot 데이터는 **본실험(main experiment) 데이터가 아니며**, 아래 "본실험 포함 여부"에 표시한다.

생성 기준일: 2026-06-01 / 갱신: 2026-06-01 (A 오염본 삭제 → A 재수집본 반영)

> **⚠️ 이력 요약:** A 의 최초 pilot(`c1063d17`)은 §3 정합성 문제(코드버전 전환 오염)로 **삭제**되었고, 이후 사용자가 **A pilot 을 재수집**했다(`ef974b0e`, §3-1). 현재 보유 pilot 은 **human_A_001(재수집·clean) + human_B_001** 2건이다.
>
> **⚠️ 설계 변경 주의:** 현재 보유한 모든 pilot(human·clean LLM)은 **"상세 클릭(open_detail)" 이 있던 옛 UI**에서 수집됐다. 이후 카드가 **모든 속성을 항상 표시**하고 상세 보기를 제거하는 설계 변경이 적용됐다(A/B 정보 접근 비용 비대칭 제거). 따라서 이 pilot 들은 **파이프라인·집계 검증 근거로는 유효하나, 행동 지표(특히 open_detail/click)는 신설계 본실험과 직접 비교할 수 없다.** 본실험은 신설계 단일 빌드에서 새로 수집한다.

## 1. 대상 파일

| 논리 ID | 원본(pilot/) | analysis/input/ 복사본 | 상태 |
|---|---|---|---|
| human_A_001 (구) | `..._c1063d17-...*` | — | **삭제됨** (오염, §3) |
| human_A_001 (재수집) | `session_/events_/export_ef974b0e-39bf-4b60-834f-918bf1b6637d.*` | `human_A_001_session.csv`, `human_A_001_events.csv`, `raw/human_A_001_export.json` | **보유 (clean, §3-1)** |
| human_B_001 | `session_/events_/export_6c0730e3-61f4-4f47-82ea-1088d9c71752.*` | `human_B_001_session.csv`, `human_B_001_events.csv`, `raw/human_B_001_export.json` | 보유 |

> 원본 `pilot/` 파일은 보존했고, 분석에는 `analysis/input/` 복사본을 사용한다. 아래 §3 은 삭제된 구 A 의 오염 기록(근거), §3-1 은 재수집된 현 A 의 검수 결과다.

## 2. 공통 검수

> A 열은 **재수집된 현 human_A_001(`ef974b0e`)** 기준이다. 삭제된 구 A(`c1063d17`)의 검수는 §3.

| 항목 | human_A_001 (재수집) | human_B_001 |
|---|---|---|
| participant_type = human | ✅ human | ✅ human |
| ui_variant 올바름 | ✅ A | ✅ B |
| 세션 수 (해당 조건) | 1 | 1 |
| session_id 비어있지 않음 | ✅ `ef974b0e…` | ✅ `6c0730e3…` |
| participant_id 구분 가능 | ⚠️ `dev-a4pubq` (dev 자동생성) | ⚠️ `dev-bkyf0z` (dev 자동생성) |
| task_duration_ms 존재 | ✅ 44,238 (~44초, 정상) | ✅ 1,352,559 (~22.5분) |
| final_selected_candidate_id 존재 | ✅ `c03` | ✅ `c06` |
| survey_difficulty | ✅ 4 | ✅ 4 |
| survey_satisfaction | ✅ 1 | ✅ 2 |
| survey_confidence | ✅ 3 | ✅ 4 |
| timestamp/elapsed_ms 비정상 공란 | 없음(0건) | 없음(0건) |
| finish 이벤트 / finished_at | ⚠️ 없음 / null | ⚠️ 없음 / null |

## 3. (이력) 구 A 검수 — `c1063d17` (삭제됨, 오염 근거)

> 아래는 **삭제된 최초 A pilot** 의 검수 기록이다. 재수집된 현 A 는 §3-1.

- ui_variant = A ✅
- 비교 기능 이벤트(`compare_add`/`compare_remove`/`view_compare`) **0건** ✅ (A는 비교 기능 없음 — 정상)
- event_type 분포: `experiment_start`×1, `view_condition`×6, `click_candidate`×7, `select_final`×1, `answer_survey`×1 (총 16)
- 흐름: intro → task → explore → select_final → survey 까지 기록됨. `open_detail` 없음(상세 패널 미사용 — 허용), `finish` 없음.

### ⚠️ A 세션 데이터 정합성 문제 (중요)
이벤트 append 순서를 보면 **세션 중간에 코드 버전이 바뀐 흔적**이 있다:

- rows 0–8 (`view_condition`×2, `click_candidate`×7): `participant_id` **빈 값**, `step_name` **빈 값**.
- `experiment_start`(정상적으로 가장 먼저여야 함)가 row 9에 뒤늦게 등장하며, 이후 rows 9–15만 `participant_id=dev-3qtc2x`·`step_name` 정상.
- elapsed_ms 가 row1=2 → row2=1,879,243 으로 급증, 총 task_duration ≈ 6.44시간.

**원인 후보:** 이 pilot은 개발 중 dev 서버에서, logger에 `participant_id`/`step_name` 자동첨부가 적용되기 **전→후**에 걸쳐 동일 localStorage 세션으로 수행된 것으로 보인다(초기 이벤트는 구버전 logger, 이후는 신버전). 큰 task_duration 은 탭을 열어둔 채 유휴 상태가 길었던 것으로 추정.

**판정:** 구 human_A_001(`c1063d17`)은 **수행시간·초기 이벤트 필드가 신뢰 불가**하여 **본실험 분석에 부적합** → 삭제됨.

## 3-1. 재수집 A 검수 — `ef974b0e` (현 human_A_001)

사용자가 A pilot 을 재수집한 결과. 구 A 의 오염 항목이 모두 해소됨:

- ui_variant = A ✅, participant_type = human ✅
- 비교 기능 이벤트(`compare_add`/`compare_remove`/`view_compare`) **0건** ✅ (A 정상)
- event_type 분포: `experiment_start`×1, `view_condition`×4, `open_detail`×5, `select_final`×1, `answer_survey`×1 (총 12)
- **전 행 `participant_id`(dev-a4pubq)·`step_name` 정상 기록** ✅ (구 A 의 빈 값 문제 해소)
- 이벤트 순서 정상(`experiment_start`가 가장 먼저, `elapsed_ms` 단조 증가), **task_duration ≈ 44초(정상)** ✅ (구 A 의 ~6.44시간 비정상 해소)
- 흐름: intro → task → explore → detail(`open_detail`×5) → select_final → survey 완비. final=`c03`, survey 4/1/3.
- ⚠️ 경미: participant_id 가 dev 자동생성(`dev-a4pubq`), `finish` 이벤트 없음/`finished_at`=null (B 와 동일 패턴 — 분석엔 무영향, 수행시간은 설문 제출 시점 기록).

**판정:** 현 human_A_001 은 **필드 정합성 양호(clean)**. 단일 회차 pilot 이므로 본실험 데이터로 직접 포함하기보다 **pilot** 용도로 취급.

## 4. B 조건 검수 (human_B_001)

- ui_variant = B ✅
- 비교 기능 사용: `compare_add`×20, `view_compare`×4 → **B에서 비교 기능이 실제로 발견·사용됨** ✅
- `compare_remove` 0건(담기만 하고 해제는 안 함).
- event_type 분포: `experiment_start`×2, `view_condition`×10, `view_compare`×4, `compare_add`×20, `select_final`×2, `answer_survey`×1 (총 39)
- 모든 행에 `participant_id`/`step_name` 정상 기록 ✅. timestamp/elapsed 공란 0건 ✅.
- 흐름: intro → task → explore → compare → select_final → survey 까지 기록됨. `finish` 없음.

### ⚠️ B 세션 경미 사항
- `experiment_start`×2, `select_final`×2, `view_condition`×10 처럼 **중복/과다 기록**이 있다. intro·explore 재진입이나 컴포넌트 재마운트로 인한 반복 로깅으로 추정(데이터 무결성 문제는 아님, 단 "이벤트 수" 절대값 해석 시 주의).

**판정:** human_B_001 은 **필드 정합성 양호**. 단일 pilot 이므로 본실험 데이터로 직접 포함하기보다 **pilot(파이프라인·UX 점검)** 용도로 취급.

## 5. 본실험 포함 여부 (명시)

| 논리 ID | 분류 | 본실험 포함 | 사유 |
|---|---|---|---|
| human_A_001 (구 `c1063d17`) | pilot / human / A | **삭제됨** | 코드버전 전환 오염 → 삭제 |
| human_A_001 (재 `ef974b0e`) | pilot / human / A | **pilot로만** | 재수집·clean(§3-1). 단일 회차, dev participant_id |
| human_B_001 | pilot / human / B | **pilot로만** | 필드 양호하나 단일 회차·중복 이벤트, dev participant_id |

> 현 보유 pilot(A 재수집 + B)은 **pilot**이며 main experiment 데이터가 아니다. 본실험 시작 전 `logs/`·`analysis/input/`을 비우고, 깨끗한 빌드/단일 코드버전에서 재수집할 것.

## 6. 집계 가능성 확인 (analysis script)

`analysis/aggregate_sessions.py`, `analysis/aggregate_events.py` 가 `analysis/input/` 의 pilot 파일을 읽어 정상 집계함(상세는 [ANALYSIS_PLAN.md](ANALYSIS_PLAN.md)):

- `sessions_grouped.csv`: (A,human)=1세션, (B,human)=1세션 — ui_variant × participant_type 그룹핑 ✅
- 평균 수행시간·난이도/만족도/확신도, 최종 선택 후보 분포 집계 ✅ (A: 44,238ms·4/1/3·final c03 / B: 1,352,559ms·4/2/4·final c06)
- `events_by_type.csv`: **A compare action = 0** ✅, **B compare_add=20 / view_compare=4** 확인 ✅
- 현 집계 기준(A 재수집 + B): 총 51 events(A 12 + B 39), 2세션.

## 7. 권고 (요약 — 상세는 본 보고서 §3–5, 문구 점검은 README/체크리스트 참조)

1. 본실험에서는 participant_id 를 **명시 입력**(예: `?pid=P01`)하여 dev 자동생성 ID 사용을 피한다.
2. 본실험은 **고정된 단일 빌드**로 수집한다(코드 변경 중 수집 금지) — A_001 오염 재발 방지.
3. 완료 화면 `finish`(`btn-finish`) 클릭이 누락되면 `finished_at`/`finish` 이벤트가 비므로, 진행 안내를 명확히 한다(아래 §8).
4. pilot 데이터와 본실험/ mock 데이터를 디렉토리·파일명으로 분리 유지(`analysis/input/` = pilot, `logs/` = 런타임).

## 7-1. 파일 삭제·재수집 기록

- **(삭제) 구 human_A_001 (`c1063d17`) 관련 파일 전체 삭제** (사용자 지시, 2026-06-01): 오염(§3)으로 본실험 부적합 판정되어 6개 삭제 — `pilot/{session,events,export}_c1063d17-...`, `analysis/input/human_A_001_{session,events}.csv`, `analysis/input/raw/human_A_001_export.json`.
  - 부수: `logs/` 에 남아 있던 미완성 런타임 로그도 정리. (※ 그 세션 `ef974b0e` 는 실제로는 사용자의 A pilot 진행 중 세션이었고, 이후 완성·재수집됨 — 아래 참조.)
- **(재수집) 현 human_A_001 (`ef974b0e`) 추가** (2026-06-01): 사용자가 A pilot 을 재수집해 `pilot/` 에 export 추가. clean 검수 통과(§3-1) 후 `analysis/input/human_A_001_{session,events}.csv` + `raw/human_A_001_export.json` 로 복사.
- 현 재집계 결과: sessions = (A,human) 1 + (B,human) 1 = **2세션**, events = 51건(A 12 + B 39). A compare action = 0, B compare > 0.

## 8. 본 QC 과정에서의 코드/문구 수정 기록

- **`app/complete/page.tsx` (문구만 추가, 동작 변경 없음):** 완료 화면에 "마지막으로 ‘실험 종료’ 버튼을 눌러 완료를 기록해 달라"는 안내 문단 1개 추가.
  - **이유:** human pilot A·B **둘 다 `finish` 이벤트가 없고 `finished_at`이 null**이었다(2/2). 완료 단계(`btn-finish`) 클릭이 필수임이 화면상 충분히 드러나지 않아, 참가자가 설문 제출 후 종료를 누르지 않고 이탈한 것으로 보인다. 기능/흐름은 그대로 두고 안내 문구만 보강해 본실험에서 `finish` 누락을 줄인다.
- 그 외 과업 설명·A/B 안내·설문 문항·비교 기능 안내는 **유도성/모호성 문제로 볼 근거가 단일 pilot 으로는 부족**하여 변경하지 않음(문구 기능 변경 금지 원칙 유지). 상세 점검 내역:
  - 과업 설명: A·B 동일 `ConditionBox`(조건 텍스트+상충 3조건 불렛)로 통제됨 — A/B 간 안내 문구 차이 없음 ✅
  - B 비교 안내("비교 담기"): 라벨이 중립적이며 과한 유도 문구 아님. pilot 에서 실제 사용됨(compare_add 20) ✅
  - 설문 3문항(난이도/만족도/확신도): pilot 에서 모두 정상 응답 기록 ✅
  - A pilot 의 `open_detail` 부재·`finish` 부재는 위에서 다룸. 추가 변경은 본실험 다회 관찰 후 판단 권장.
