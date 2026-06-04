# 실험 설계 (EXPERIMENT_DESIGN)

본 문서는 실험의 **설계 원칙과 데이터 구분 규칙**을 정리한다. 실행 절차는 [docs/EXPERIMENT.md](EXPERIMENT.md), testid 계약은 [docs/TESTID.md](TESTID.md)에 위임한다. 결과 해석·결론은 포함하지 않는다.

## 1. 연구 목적·RQ
웹 인터페이스 사용성 평가에서 LLM 기반 사용자 시뮬레이션이 실제 사용자(Human)와 얼마나 정렬(alignment)되는지를, 비교 지원 인터페이스 사례를 통해 검증한다. 비교 축은 UI A vs B 가 아니라 **Human vs LLM** 이며, A/B 는 정렬을 관찰하기 위한 자극·맥락이다. **RQ1** 결과 정렬(선택 일치도·수행시간·Likert), **RQ2** 행동 정렬(탐색 경로·클릭·비교사용), **RQ3** 보조 UX 평가도구로서의 활용 가능성.

## 2. 실험 조건 (UI A / UI B) 과 A/B 통제 원칙
- **UI A**: 비교 기능이 없는 기본 인터페이스. 후보 목록을 탐색하며 최종 선택.
- **UI B**: 비교 지원 인터페이스. A와 동일한 후보를 대상으로 비교 기능을 제공.
- **A/B 통제 (변경 금지)**: A·B 는 동일 후보 데이터·동일 정보항목·동일 속성 값·동일 과업 흐름을 공유한다. **유일한 차이 = 비교 기능 유무**.
- **정보 접근 동일성**: 모든 후보 카드는 **모든 속성을 항상 표시**한다(상세 클릭/패널 없음). 과거에는 A 가 상세 클릭으로만 전체 정보를 보고 B 는 비교함에 담으면 표로 즉시 보였는데, 이 "정보 접근 비용" 비대칭은 비교 기능과 무관한 confound 였으므로 제거했다. 이제 B 의 이점은 **정보 노출량이 아니라 나란히 비교 + 우열 강조**뿐이다.
- **B 의 비교 지원** = 값 병치(co-location) + 속성별 우열 강조(가장 우수한 값에 `▲`/하이라이트, 동점이면 모두). 비교 개수 제한 없음. 강조는 A와 같은 값 위에 얹는 **시각적 보조**일 뿐 새 정보값을 추가하지 않는다. LLM 시뮬레이션도 `state.compareView` 로 동일 단서를 받는다.
- 이 차이를 추가로 늘리지 않는다(통제 변수).

## 3. 참가자/데이터 유형 구분
- `participant_type` = `human` | `llm`. **주의:** 시뮬레이션(mock·real)은 둘 다 `participant_type=llm` 으로 기록된다(sim 이 `participant=llm` 로 진입). 따라서 **mock 과 real LLM 의 구분은 `participant_type` 이 아니라 provenance 필드로 한다.**
- **provenance(LLM run 출처)**: `llm_provider`, `llm_model`, `llm_temperature`, `used_mock_fallback`, `is_clean_llm_run`, `fallback_reason` (session json/csv·export 에 기록).

#### 식별성(participant_id)
- 본실험·시뮬레이션 모두 **`participant_id` 명시 입력을 권장**한다 — human 은 intro 화면에서 입력, LLM 은 `--participant-id` 로 지정. `dev-<난수>` 자동 ID 는 pilot/개발용으로만 사용한다.
- `participant_id` 는 session / events / export / summary 에 **동일하게 기록**되어 데이터 추적 단위를 고정한다.

#### 재현성(reproducibility)
- LLM 데이터는 **temperature 를 고정**하여 수집한다(기본 `0.2`). 이 값은 provenance 의 `llm_temperature` 에 기록되어 run 간 비교·재현 근거가 된다.

| 데이터 | 판별 | 실험 데이터 여부 |
|---|---|---|
| human | `participant_type=human` | O (실제 사용자) |
| **clean real LLM** | `participant_type=llm` + `is_clean_llm_run=true` + `used_mock_fallback=false` | O (real LLM) |
| fallback 오염 LLM | `participant_type=llm` + `is_clean_llm_run=false` (mock 섞임) | **X (제외)** |
| 순수 mock | `participant_type=llm` + `llm_provider=mock` | X (흐름 검증용) |

### clean LLM run 기준 & 오염 제외 원칙
- **clean LLM run = 세션의 모든 action 이 실제 LLM provider 에서 생성되고 mock fallback 이 0** 일 때만 인정(`is_clean_llm_run=true`).
- mock 이 한 step 이라도 섞이면 `is_clean_llm_run=false` → **real LLM 실험 데이터로 집계하지 않는다**(`analysis/aggregate_sessions.py` 가 자동 제외).
- `sim:llm` 기본 정책은 LLM 실패 시 mock 자동 대체 금지(실패 시 run 중단). 따라서 fallback 오염 데이터가 애초에 생기지 않는다(개발용 `LLM_ALLOW_MOCK_FALLBACK=true` 일 때만 생성되며 그 경우 자동 flag).
- mock 자유응답은 `"mock agent run"` — real 과 섞이면 안 된다.

#### 데이터 포함/제외 요약
- **포함**: human / clean LLM(`is_clean_llm_run=true`).
- **제외**: LLM fallback·mixed(`is_clean_llm_run=false`) / mock.
- **분리**: pilot 은 본실험과 분리하며, 파이프라인 검증 근거로만 사용한다(본실험 집계 제외).

## 4. pilot 데이터 vs 본실험(main) 데이터
현재 보유 데이터는 **pilot 뿐**이며, 아래 둘 모두 **본실험 데이터가 아니다**.

| 항목 | participant_id | 위치 | QC 결과 | 본실험 포함 |
|---|---|---|---|---|
| Human pilot A (재수집) | `human_A_001` (`ef974b0e`) | `pilot/`(원본), `analysis/input/`(복사본) | clean(필드 정상·duration 44초·compare 0) | X (pilot) |
| Human pilot B | `human_B_001` (`6c0730e3`) | `pilot/`(원본), `analysis/input/`(복사본) | 필드 양호(비교 사용됨) | X (pilot) |
| mock 로그 | (runtime 생성) | `logs/` | 흐름 검증용 | X |

> 현재 보유 human pilot 은 **A(재수집·clean) + B 각 1건**이다. A 의 최초 수집본(`c1063d17`)은 오염으로 삭제됐고 재수집본으로 대체됐다(이력: PILOT_QC_REPORT §3·§3-1·§7-1). 모두 pilot 이며 본실험 데이터 아님.

> **보유 현황(한 줄)**: 현재 human A·B + clean LLM A·B 각 1회가 `analysis/input/` 에 있으며, **n=1·pilot 이고 본실험 데이터가 아니다**.

상세 QC 는 [analysis/PILOT_QC_REPORT.md](../analysis/PILOT_QC_REPORT.md) 참조. **본실험 상세 실행 계획**은 [docs/MAIN_EXPERIMENT_PLAN.md](MAIN_EXPERIMENT_PLAN.md) 로 위임한다.

**분리 보관 규칙**: `analysis/input/` = pilot 입력(`human_A_00N_*`), `logs/` = runtime(mock 등). 본실험 시작 전 `logs/` 와 `analysis/input/` 을 비우고(`.gitkeep` 만 잔존), **단일 고정 빌드**에서 본실험 데이터를 재수집한다.

## 5. 수집 데이터 항목 ↔ 로그 필드 (요약)
| 종류 | 항목 | 주요 로그 필드 |
|---|---|---|
| 행동 | 클릭/탐색 경로, 비교 사용 | `event_type`, `target_id`, `candidate_id`, `compare_count`, `current_compare_ids` |
| 성과 | 최종 선택, 수행 시간 | `final_selected_candidate_id`, `elapsed_ms`/`duration` |
| 주관 | 난이도/만족도/확신도 | `survey_difficulty`, `survey_satisfaction`, `survey_confidence` |

필드 전체 정의·export 파일 구조는 [docs/EXPERIMENT.md](EXPERIMENT.md) §4 에 위임한다.

## 6. 본실험 전 통제 점검
- [ ] **단일 고정 빌드**에서 수집(코드버전 전환 금지 — human_A_001 오염 재발 방지).
- [ ] `participant_id` / `participant_type`(`human`|`llm`) **명시 입력** (`dev-<난수>` 자동 생성 금지).
- [ ] 완료 화면 `btn-finish` 까지 도달해 **finish 로그** 기록(미완료 세션 제외).
- [ ] mock·검증 로그 전부 삭제, `logs/`·`analysis/input/` 초기화 후 재수집.
- [ ] A·B 배정표(participant_id ↔ ui_variant) 별도 관리·로그 대조.

## 7. 관련 문서
- [논문계획서.md](../논문계획서.md) — 연구 목적·RQ·분석 방법
- [docs/MAIN_EXPERIMENT_PLAN.md](MAIN_EXPERIMENT_PLAN.md) — 본실험 상세 실행 계획
- [docs/EXPERIMENT.md](EXPERIMENT.md) — 실행 절차·로그 필드·export 구조
- [docs/TESTID.md](TESTID.md) — data-testid 계약·LLM action 매핑
- [analysis/PILOT_QC_REPORT.md](../analysis/PILOT_QC_REPORT.md) — pilot QC 상세
- [analysis/ANALYSIS_PLAN.md](../analysis/ANALYSIS_PLAN.md) — 분석 파이프라인 점검 계획
- [analysis/README.md](../analysis/README.md) — 분석 집계 스크립트 사용법·산출물
