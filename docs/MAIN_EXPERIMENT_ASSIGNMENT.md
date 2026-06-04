# 본실험 participant_id 배정표 (MAIN_EXPERIMENT_ASSIGNMENT)

> 본 문서는 **1차 본실험**의 participant_id 배정과 실행/수집 진행을 추적하는 작업표다.
> 결과 해석·결론·수치는 포함하지 않으며, 아직 **본실험 데이터는 수집 전(빈 상태)** 이다.
> 본실험 데이터는 **pilot / mock 데이터와 분리**해서 관리한다.
> 설계·기준은 [docs/MAIN_EXPERIMENT_PLAN.md](MAIN_EXPERIMENT_PLAN.md) 에 위임한다.

## 1. 1차 본실험 규모
- Human A: 5명 / Human B: 5명
- LLM A: 5회 / LLM B: 5회
- 총 20개 (Human 10 + LLM 10)
- participant_id: `human_A_001~005`, `human_B_001~005`, `llm_A_001~005`, `llm_B_001~005`

## 2. 배정표 (20행)

체크칸은 작업 진행 시 `☐` → `☑` 로 직접 갱신한다.

| participant_id | participant_type | ui_variant | 실행 URL / 명령어 | 완료 | export_json 수집 | events_csv 수집 | session_csv 수집 | 비고 |
|---|---|---|---|---|---|---|---|---|
| human_A_001 | human | A | `http://localhost:3000/?variant=A&participant=human&pid=human_A_001` | ☐ | ☐ | ☐ | ☐ | |
| human_A_002 | human | A | `http://localhost:3000/?variant=A&participant=human&pid=human_A_002` | ☐ | ☐ | ☐ | ☐ | |
| human_A_003 | human | A | `http://localhost:3000/?variant=A&participant=human&pid=human_A_003` | ☐ | ☐ | ☐ | ☐ | |
| human_A_004 | human | A | `http://localhost:3000/?variant=A&participant=human&pid=human_A_004` | ☐ | ☐ | ☐ | ☐ | |
| human_A_005 | human | A | `http://localhost:3000/?variant=A&participant=human&pid=human_A_005` | ☐ | ☐ | ☐ | ☐ | |
| human_B_001 | human | B | `http://localhost:3000/?variant=B&participant=human&pid=human_B_001` | ☐ | ☐ | ☐ | ☐ | |
| human_B_002 | human | B | `http://localhost:3000/?variant=B&participant=human&pid=human_B_002` | ☐ | ☐ | ☐ | ☐ | |
| human_B_003 | human | B | `http://localhost:3000/?variant=B&participant=human&pid=human_B_003` | ☐ | ☐ | ☐ | ☐ | |
| human_B_004 | human | B | `http://localhost:3000/?variant=B&participant=human&pid=human_B_004` | ☐ | ☐ | ☐ | ☐ | |
| human_B_005 | human | B | `http://localhost:3000/?variant=B&participant=human&pid=human_B_005` | ☐ | ☐ | ☐ | ☐ | |
| llm_A_001 | llm | A | `LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=A --participant-id=llm_A_001 --headless=true` | ☐ | ☐ | ☐ | ☐ | |
| llm_A_002 | llm | A | `LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=A --participant-id=llm_A_002 --headless=true` | ☐ | ☐ | ☐ | ☐ | |
| llm_A_003 | llm | A | `LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=A --participant-id=llm_A_003 --headless=true` | ☐ | ☐ | ☐ | ☐ | |
| llm_A_004 | llm | A | `LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=A --participant-id=llm_A_004 --headless=true` | ☐ | ☐ | ☐ | ☐ | |
| llm_A_005 | llm | A | `LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=A --participant-id=llm_A_005 --headless=true` | ☐ | ☐ | ☐ | ☐ | |
| llm_B_001 | llm | B | `LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=B --participant-id=llm_B_001 --headless=true` | ☐ | ☐ | ☐ | ☐ | |
| llm_B_002 | llm | B | `LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=B --participant-id=llm_B_002 --headless=true` | ☐ | ☐ | ☐ | ☐ | |
| llm_B_003 | llm | B | `LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=B --participant-id=llm_B_003 --headless=true` | ☐ | ☐ | ☐ | ☐ | |
| llm_B_004 | llm | B | `LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=B --participant-id=llm_B_004 --headless=true` | ☐ | ☐ | ☐ | ☐ | |
| llm_B_005 | llm | B | `LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=B --participant-id=llm_B_005 --headless=true` | ☐ | ☐ | ☐ | ☐ | |

## 3. A/B 배정 메모

### Human — between-subject (1차 확정)
- 본 배정표는 **between-subject**: 참가자별로 **하나의 ui_variant 만 1회** 수행한다(A 5명, B 5명 = **서로 다른 10명**).
- `human_A_*` 는 A, `human_B_*` 는 B. 실제 모집 시 난수 배정 후 결과를 기록하는 방식도 가능하다.
- ⚠️ **같은 사람에게 A·B 를 모두 시키지 말 것**: A·B 가 동일 후보 목록·동일 과업이므로 두 번째 조건은 기억(carryover)으로 오염된다. within-subject 는 본 설계에서 비권장(상세: [docs/MAIN_EXPERIMENT_PLAN.md](MAIN_EXPERIMENT_PLAN.md) A/B 배정 방식).

### LLM (variant당 반복)
- LLM 은 참가자 개념이 아니라 **variant당 5회 반복** 실행이다(A 5회, B 5회).
- 반복 간 조건은 동일하게 고정하고, temperature>0 의 변동성만 반복으로 흡수한다.

### 주의 — participant_id ↔ ui_variant 매핑 관리
- participant_id 와 ui_variant 의 실제 매핑은 **실험자가 본 배정표에서 직접 관리**한다.
- 위 표의 매핑은 예시이며, 실제 배정(특히 human 난수 배정)을 바꿀 경우 표의 `ui_variant` 와 실행 URL 의 `variant=` / `pid=` 값을 함께 일관되게 수정한다.
- 수집된 logs 의 participant_id·variant 와 본 표를 대조하여 불일치가 없는지 확인한다.

## 4. 수집 파일명·저장 위치 규칙

각 실행 직후 수집물 3종을 즉시 저장한다.

| 수집물 | 파일명 | 저장 위치 |
|---|---|---|
| export JSON | `{pid}_export.json` | `analysis/input/main/{human|llm}/` |
| events CSV | `{pid}_events.csv` | `analysis/input/main/{human|llm}/` |
| session CSV | `{pid}_session.csv` | `analysis/input/main/{human|llm}/` |

- Human 수집물 → `analysis/input/main/human/`
- LLM 수집물 → `analysis/input/main/llm/`
- 예) `human_A_001_export.json`, `human_A_001_events.csv`, `human_A_001_session.csv` → `analysis/input/main/human/`
- 예) `llm_A_001_export.json`, `llm_A_001_events.csv`, `llm_A_001_session.csv` → `analysis/input/main/llm/`

### LLM 실행 사전 준비 (env / pacing)
- Groq 무료 티어는 레이트리밋 회피를 위한 **pacing 필요**.
- `.env.local` 에 API 키 / 모델 / temperature 설정 후 키를 주입한다: `set -a; . ./.env.local; set +a`
- 이후 위 표의 명령어로 실행한다.
- 간단형 `npm run sim:llm -- --variant=A --participant-id=llm_A_001` 도 가능하나, 동일하게 **env 주입과 pacing 설정이 선행되어야 한다**.

## 5. 관련 문서
- [docs/HUMAN_MAIN_RUN_CHECKLIST.md](HUMAN_MAIN_RUN_CHECKLIST.md) — Human 본실험 실행 체크리스트
- [docs/LLM_MAIN_RUN_CHECKLIST.md](LLM_MAIN_RUN_CHECKLIST.md) — LLM 본실험 실행 체크리스트
- [docs/MAIN_DATA_QC_CHECKLIST.md](MAIN_DATA_QC_CHECKLIST.md) — 본실험 데이터 QC 체크리스트
- [docs/MAIN_EXPERIMENT_PLAN.md](MAIN_EXPERIMENT_PLAN.md) — 본실험 실행 계획·기준
