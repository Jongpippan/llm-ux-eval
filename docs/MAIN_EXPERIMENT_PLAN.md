# 본실험 실행 계획 (MAIN_EXPERIMENT_PLAN)

> 본 문서는 **본실험(main experiment)의 실행 계획과 기준**만 정리한다.
> 결과 해석·논문 결론은 포함하지 않으며, 가상의 수치를 생성하지 않는다.
> 설계 원칙은 [docs/EXPERIMENT_DESIGN.md](EXPERIMENT_DESIGN.md), 실행 절차·로그 필드는 [docs/EXPERIMENT.md](EXPERIMENT.md), 분석 지표 정의는 [analysis/ANALYSIS_PLAN.md](../analysis/ANALYSIS_PLAN.md) 에 위임한다.
> 실행 패키지(배정·체크리스트·QC)는 [docs/MAIN_EXPERIMENT_ASSIGNMENT.md](MAIN_EXPERIMENT_ASSIGNMENT.md), [docs/HUMAN_MAIN_RUN_CHECKLIST.md](HUMAN_MAIN_RUN_CHECKLIST.md), [docs/LLM_MAIN_RUN_CHECKLIST.md](LLM_MAIN_RUN_CHECKLIST.md), [docs/MAIN_DATA_QC_CHECKLIST.md](MAIN_DATA_QC_CHECKLIST.md) 에 위임한다.

## 1. 본실험 목적
웹 사용성 평가에서 비교 지원 인터페이스(UI A=비교기능 없음, UI B=비교 테이블)를 자극으로 사용하여, LLM 기반 사용자 시뮬레이션이 실제 사용자(Human)와 어느 정도 정렬(alignment)되는지를 동일 조건에서 비교·관찰할 수 있는 데이터를 수집한다. 비교 축은 UI A vs B 가 아니라 **Human vs LLM** 이며, A/B 는 정렬을 관찰하기 위한 맥락이다. 흐름은 intro → experiment → explore(`/a` 또는 `/b`) → survey → complete 로 통일한다.

## 2. Human 조건 설계
- **1차 본실험 규모(확정)**: Human A 5 / Human B 5 (총 10). 권장 범위(조건당 약 8~15명)는 효과크기·일정 가정의 근거로 남기되, 1차는 자원·일정 제약상 조건당 5명으로 확정해 수집한다. 확정 수는 배정표에 기록한다.
- **A/B 배정 방식 — 1차는 between-subject 사용(권장·확정)**
  - between-subject: 서로 다른 10명을 A 5명 / B 5명으로 배정(난수 배정 후 기록). **한 사람은 한 조건만 1회** 수행.
  - ⚠️ **within-subject(한 사람이 A·B 둘 다) 비권장**: A·B 가 **동일 후보 목록·동일 과업**이라, 같은 사람이 두 번째 조건을 할 때 이미 후보/선택을 **기억**해 수행시간·선택·탐색이 오염된다(carryover/learning). 카운터밸런싱은 집단 평균의 순서 편향만 상쇄할 뿐 개인의 기억 오염은 제거하지 못한다. within 을 쓰려면 A용/B용으로 **난이도가 동등한 별도 후보 세트 2개**가 필요한데, 이는 "A·B 동일 목록" 통제를 깨고 새 confound 를 만들므로 본 연구에서는 채택하지 않는다.
  - LLM 은 매 run 이 독립 세션(이전 기억 없음)이라 carryover 가 없다 — `llm_A_*` / `llm_B_*` 각각 독립 실행.
- **participant_id 규칙(1차 확정)**: `human_A_001~human_A_005` / `human_B_001~human_B_005` 형태로 조건·반복을 식별 가능하게 부여한다. **`dev-<난수>` 자동 ID 사용 금지**(intro 입력 또는 `?pid=` 명시).
- **배정표 관리**: participant_id ↔ ui_variant 배정 결과를 실험자 측 별도 표로 관리하고 logs 와 대조한다.
- **pilot ↔ 본실험 데이터 구분**: 현재 보유한 human pilot(A 재수집 `ef974b0e` + B `6c0730e3`)은 **각 조건 n=1 의 pilot** 으로 파이프라인·UX 점검 근거일 뿐 **본실험 데이터가 아니다**. 본실험은 단일 고정 빌드에서 새로 수집한 데이터만 사용한다.

## 3. LLM 조건 설계
- **provider**: OpenAI 호환 엔드포인트(`OPENAI_BASE_URL`). 기본은 **Groq 무료 티어**(`https://api.groq.com/openai/v1`) 또는 Ollama 로컬.
- **현재 검증 모델**: `llama-3.3-70b-versatile` (Groq). 본실험에서도 단일 모델을 고정해 사용한다.
- **temperature**: `LLM_TEMPERATURE=0.2` 고정(재현성).
- **pacing**: `LLM_CALL_DELAY_MS` — Groq 무료 티어는 **9000~12000ms** 권장(레이트리밋 회피).
- **retry/backoff**: 429 발생 시 `LLM_MAX_RETRIES=3`, `LLM_RETRY_BASE_MS=5000` 으로 지수 백오프.
- **clean run 기준**: 세션의 **모든 action 이 실제 LLM provider 에서 생성 + mock fallback 0** 일 때만 `is_clean_llm_run=true`, `used_mock_fallback=false`. 한 step 이라도 mock 이 섞이면 false. 기본 정책은 mock 자동 fallback 금지(실패 시 run 중단)이므로 오염 데이터가 애초에 생기지 않는다.
- **1차 반복 횟수(확정)**: LLM A 5 / LLM B 5 (총 10). 권장 범위(조건당 약 10~20회)는 temperature>0 변동성 흡수 근거로 남기되, 1차는 Human 과 균형을 맞춰 조건당 5회로 확정한다.
- **participant_id 규칙(1차 확정)**: `llm_A_001~llm_A_005` / `llm_B_001~llm_B_005` 형태로 조건·반복을 식별 가능하게 부여한다. `dev-<난수>` 자동 ID 금지.
- **키 관리**: API 키는 `.env.local`(gitignore)에만 둔다. 채팅·커밋·로그에 노출 금지.

## 4. 데이터 포함/제외 기준
| 데이터 | 판별 | 본실험 |
|---|---|---|
| human | `participant_type=human` | **포함** |
| clean real LLM | `participant_type=llm` + `is_clean_llm_run=true` + `used_mock_fallback=false` | **포함** |
| fallback 오염 LLM | `participant_type=llm` + `is_clean_llm_run=false` (mock 섞임) | **제외** |
| 순수 mock | `participant_type=llm` + `llm_provider=mock` | **제외**(흐름 검증용) |
| pilot | 현 보유 human pilot 등 | **제외**(본실험과 분리) |

- `analysis/aggregate_sessions.py` 는 `participant_type=llm` 이고 `is_clean_llm_run≠true` 인 세션(mock·fallback)을 자동 제외한다.
- mock 자유응답은 `"mock agent run"` 이며 real 과 섞이면 안 된다.

### 데이터 폴더 구조
- 본실험: `analysis/input/main/{human,llm}/`
- pilot: `analysis/input/pilot/{human,llm}/`
- 제외: `analysis/input/excluded/{mock,fallback}/`
- 분석 기본 scope 는 `main`. pilot 데이터를 분석 대상으로 삼을 때만 `ANALYSIS_SCOPE=pilot` 로 명시한다.

### QC 절차
- 수집 데이터의 QC 판정·체크 항목은 [docs/MAIN_DATA_QC_CHECKLIST.md](MAIN_DATA_QC_CHECKLIST.md) 에 위임한다.

## 5. 주요 지표 (각 1줄 정의)
- **`task_duration_to_final_ms`** (분석 canonical 성과 지표): 과업 시작(started_at) → **최종선택(select_final)** 까지 소요 시간(ms). 설문·finish·다운로드 등 과업 이후 시간은 제외한다. 분석 스크립트가 events 의 마지막 `select_final` elapsed_ms 로 파생 계산한다. *시간 분석은 이 값을 사용한다.*
- `task_duration_ms`(참고용): 앱이 기록한 시작~설문제출/finish 시점 값. 과업 이후 구간이 포함될 수 있어 **분석 기준으로 쓰지 않는다**(원본 보존·대조용).
- `survey_difficulty`: 사용 난이도 Likert 응답. 주관 지표.
- `survey_satisfaction`: 만족도 Likert 응답. 주관 지표.
- `survey_confidence`: 선택 확신도 Likert 응답. 주관 지표.
- `final_selected_candidate_id`: 최종 선택 후보 ID. 선택 일치도(RQ1) 산출 기반.
- `click_candidate_count`: 카드 클릭(후보 focus) 횟수. *events(`click_candidate`)에서 파생되는 향후 지표.* (상세 보기 제거 — 모든 정보가 카드에 항상 표시되어 `open_detail`/`detail_open_count` 는 더 이상 수집되지 않음.)
- `compare_action_count`: 비교 기능 사용 횟수(B 한정). *events(`compare_add`/`view_compare` 등)에서 파생되는 향후 지표.*
- `viewed_candidate_count`: 클릭한 distinct 후보 수. *events(`click_candidate`)에서 파생되는 향후 지표.*

## 6. 분석 구조 (지표 정의는 ANALYSIS_PLAN 에 위임)
- **Human A vs Human B**: 비교 기능 유무에 따른 사용자 결과·행동 차이 관찰.
- **LLM A vs LLM B**: 동일 자극에 대한 LLM 결과·행동 차이 관찰.
- **A→B 차이의 "방향" 비교**: Human 의 A→B 변화 방향과 LLM 의 A→B 변화 방향이 같은 쪽을 향하는지 정렬성 관찰(RQ1·RQ2).
- **(가능 시) 선택 결과·탐색 경로 유사도**: `final_selected_candidate_id` 일치도, 클릭 시퀀스 유사도(향후 events 파생 지표).
- 구체적 지표·산식·집계 컬럼은 [analysis/ANALYSIS_PLAN.md](../analysis/ANALYSIS_PLAN.md) 에 위임한다.

## 7. 본실험 전 체크리스트
- [ ] **단일 고정 빌드**에서만 수집(수집 중 코드버전 전환 금지 — pilot A 오염 재발 방지).
- [ ] 1차 규모(Human A 5 / Human B 5 / LLM A 5 / LLM B 5, 총 20) 확정·배정표 반영.
- [ ] `participant_id` 명시 입력(human `human_A_001…`, llm `llm_A_001…`), `dev-<난수>` 금지.
- [ ] `analysis/input/{main,pilot,excluded}/` 폴더 구조로 수집·분리(분석 기본 scope=main).
- [ ] `participant_type`(`human`|`llm`) / `ui_variant`(A|B) 명시.
- [ ] `LLM_TEMPERATURE=0.2` 고정, 단일 모델(`llama-3.3-70b-versatile`) 고정.
- [ ] Groq 무료 티어 한도·pacing 확인(`LLM_CALL_DELAY_MS` 9000~12000), 429 retry 설정 확인.
- [ ] 완료 화면 `btn-finish` 클릭으로 **finish 로그 기록**(미완료 세션 제외).
- [ ] `logs/` · `analysis/input/` 초기화(`.gitkeep` 만 잔존) 후 재수집.
- [ ] A·B 배정표(participant_id ↔ ui_variant) 확정·logs 대조.
- [ ] `.env.local` 키 설정 확인(채팅/커밋 노출 없음).

## 8. 본실험 후 로그 정리 절차
1. **clean LLM vs mock 분리**: provenance 필드(`is_clean_llm_run`, `used_mock_fallback`, `llm_provider`, `llm_model`, `fallback_reason`)로 clean real LLM 세션만 선별, mock·fallback 세션은 별도 보관.
2. **제외 데이터 표시**: 제외 사유(fallback 오염/mock/미완료/pilot)를 파일명·배정표에 명시해 분석 입력과 혼동 방지.
3. **백업/익명화**: PII 미수집(session_id/participant_id 만 사용) 상태 확인 후 원본 로그를 백업. `logs/` · `analysis/out/` 은 gitignore 되므로 커밋 금지.
4. **분리 보관**: 본실험 입력은 `analysis/input/`(human·llm clean), runtime/mock 은 `logs/` 로 유지.

## 9. 관련 문서
- [docs/EXPERIMENT_DESIGN.md](EXPERIMENT_DESIGN.md) — 실험 설계 원칙·데이터 구분
- [docs/EXPERIMENT.md](EXPERIMENT.md) — 실행 절차·로그 필드·export 구조
- [docs/MAIN_EXPERIMENT_ASSIGNMENT.md](MAIN_EXPERIMENT_ASSIGNMENT.md) — participant_id ↔ ui_variant 배정표
- [docs/HUMAN_MAIN_RUN_CHECKLIST.md](HUMAN_MAIN_RUN_CHECKLIST.md) — Human 본실험 실행 체크리스트
- [docs/LLM_MAIN_RUN_CHECKLIST.md](LLM_MAIN_RUN_CHECKLIST.md) — LLM 본실험 실행 체크리스트
- [docs/MAIN_DATA_QC_CHECKLIST.md](MAIN_DATA_QC_CHECKLIST.md) — 본실험 수집 데이터 QC 체크리스트
- [docs/LLM_PILOT_CHECKLIST.md](LLM_PILOT_CHECKLIST.md) — LLM run 점검 체크리스트
- [analysis/ANALYSIS_PLAN.md](../analysis/ANALYSIS_PLAN.md) — 분석 파이프라인·지표 정의
- [analysis/PILOT_QC_REPORT.md](../analysis/PILOT_QC_REPORT.md) — pilot QC 상세
