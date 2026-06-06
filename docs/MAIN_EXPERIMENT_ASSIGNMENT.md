# 본실험 participant_id 배정표 (MAIN_EXPERIMENT_ASSIGNMENT)

> 본 문서는 **1차 본실험**의 participant_id 배정과 실행/수집 진행을 추적하는 작업표다.
> 결과 해석·결론·수치는 포함하지 않는다.
> 설계·기준은 [docs/MAIN_EXPERIMENT_PLAN.md](MAIN_EXPERIMENT_PLAN.md), LLM agent 아키텍처는 [docs/UXAGENT.md](UXAGENT.md) 에 위임한다.

## 1. 1차 본실험 규모 (확정 = 5/cell)
| 집단 | A | B | participant_id | agent_arch |
|---|---|---|---|---|
| Human | 5 | 5 | `human_A_001~005`, `human_B_001~005` | — |
| LLM **uxagent** (주 데이터) | 5 | 5 | `llm_ux_A_001~005`, `llm_ux_B_001~005` | `uxagent` |
| LLM **generic** (baseline) | 5 | 5 | `llm_A_001~005`, `llm_B_001~005` | `generic` |

- between 배정: 한 단위(사람/persona)는 한 조건만. uxagent 는 persona 1명 = 1 run.
- persona 배정(1차 사용): **p01~p05 → A**, **p11~p15 → B** (`simulation/personas/`). p06~p10·p16~p20 은 생성만 해둔 **예비**(미사용 — n 확장 시 사용).
- 실제 수집 현황·결과: [analysis/COLLECTION_STATUS.md](../analysis/COLLECTION_STATUS.md).

## 2. Human 배정 (5/5, between)
| participant_id | ui_variant | 실행 URL | 완료 | export 수집 |
|---|---|---|---|---|
| human_A_001 | A | `http://localhost:3000/?variant=A&participant=human&pid=human_A_001` | ☐ | ☐ |
| human_A_002 | A | `…&variant=A&…pid=human_A_002` | ☐ | ☐ |
| human_A_003 | A | `…&variant=A&…pid=human_A_003` | ☐ | ☐ |
| human_A_004 | A | `…&variant=A&…pid=human_A_004` | ☐ | ☐ |
| human_A_005 | A | `…&variant=A&…pid=human_A_005` | ☐ | ☐ |
| human_B_001 | B | `…&variant=B&…pid=human_B_001` | ☐ | ☐ |
| human_B_002 | B | `…&variant=B&…pid=human_B_002` | ☐ | ☐ |
| human_B_003 | B | `…&variant=B&…pid=human_B_003` | ☐ | ☐ |
| human_B_004 | B | `…&variant=B&…pid=human_B_004` | ☐ | ☐ |
| human_B_005 | B | `…&variant=B&…pid=human_B_005` | ☐ | ☐ |

## 3. LLM uxagent 배정 (between)

> **1차 확정 = 5/cell**: 실제 사용은 **A: llm_ux_A_001~005(p01~p05), B: llm_ux_B_001~005(p11~p15)**. 아래 표의 006~010 행(p06~p10, p16~p20)은 **예비**(미수집) — n 확장 시 사용.

실행 템플릿(서버 기동 + `.env.local` 주입 후): `AGENT_ARCH=uxagent npx tsx simulation/run.ts --variant={V} --persona-id={persona} --participant-id={pid} --headless=true`

| participant_id | ui_variant | persona | 완료 | export 수집 | trace 확인 |
|---|---|---|---|---|---|
| llm_ux_A_001 | A | p01 | ☐ | ☐ | ☐ |
| llm_ux_A_002 | A | p02 | ☐ | ☐ | ☐ |
| llm_ux_A_003 | A | p03 | ☐ | ☐ | ☐ |
| llm_ux_A_004 | A | p04 | ☐ | ☐ | ☐ |
| llm_ux_A_005 | A | p05 | ☐ | ☐ | ☐ |
| llm_ux_A_006 | A | p06 | ☐ | ☐ | ☐ |
| llm_ux_A_007 | A | p07 | ☐ | ☐ | ☐ |
| llm_ux_A_008 | A | p08 | ☐ | ☐ | ☐ |
| llm_ux_A_009 | A | p09 | ☐ | ☐ | ☐ |
| llm_ux_A_010 | A | p10 | ☐ | ☐ | ☐ |
| llm_ux_B_001 | B | p11 | ☐ | ☐ | ☐ |
| llm_ux_B_002 | B | p12 | ☐ | ☐ | ☐ |
| llm_ux_B_003 | B | p13 | ☐ | ☐ | ☐ |
| llm_ux_B_004 | B | p14 | ☐ | ☐ | ☐ |
| llm_ux_B_005 | B | p15 | ☐ | ☐ | ☐ |
| llm_ux_B_006 | B | p16 | ☐ | ☐ | ☐ |
| llm_ux_B_007 | B | p17 | ☐ | ☐ | ☐ |
| llm_ux_B_008 | B | p18 | ☐ | ☐ | ☐ |
| llm_ux_B_009 | B | p19 | ☐ | ☐ | ☐ |
| llm_ux_B_010 | B | p20 | ☐ | ☐ | ☐ |

## 4. LLM generic baseline 배정 (5/5)
실행 템플릿(`--persona-id` 없음, 기본 `AGENT_ARCH=generic`): `npx tsx simulation/run.ts --variant={V} --participant-id={pid} --headless=true`

| participant_id | ui_variant | 완료 | export 수집 |
|---|---|---|---|
| llm_A_001~005 | A | ☐☐☐☐☐ | ☐☐☐☐☐ |
| llm_B_001~005 | B | ☐☐☐☐☐ | ☐☐☐☐☐ |

> generic baseline 10건은 이미 수집되어 `analysis/input/main/llm/` 에 있고 `agent_arch=generic` 으로 표기됨(재수집 불필요). uxagent 20건이 신규 수집 대상.

## 5. 수집 파일명·저장 위치
| 수집물 | 파일명 | 저장 위치 |
|---|---|---|
| export JSON | `{pid}_export.json` | `analysis/input/main/{human|llm}/` |
| events CSV | `{pid}_events.csv` | `analysis/input/main/{human|llm}/` (선택; export 가 정본) |
| trace JSON | `trace_{sid}.json` | uxagent 만, `logs/` 자동 생성(정성 데이터) |

- Human → `analysis/input/main/human/`, LLM(uxagent·generic) → `analysis/input/main/llm/`.
- `agent_arch`·`persona_id` 는 export/session 에 자동 기록되어 분석에서 분리 집계된다.

### LLM 실행 사전 준비
- Ollama 서버 기동 + `qwen2.5:32b` pull 확인(`http://localhost:11434`).
- `.env.local`(Ollama 엔드포인트/모델) 주입: `set -a; . ./.env.local; set +a`.
- uxagent 는 사전에 `npx tsx simulation/generate-personas.ts --count=20` 로 persona 20명 생성(1회).

## 6. 관련 문서
- [docs/MAIN_EXPERIMENT_PLAN.md](MAIN_EXPERIMENT_PLAN.md) — 본실험 실행 계획·기준
- [docs/UXAGENT.md](UXAGENT.md) — LLM agent 아키텍처(uxagent/generic)
- [docs/LLM_MAIN_RUN_CHECKLIST.md](LLM_MAIN_RUN_CHECKLIST.md) — LLM 본실험 실행 체크리스트
- [docs/MAIN_DATA_QC_CHECKLIST.md](MAIN_DATA_QC_CHECKLIST.md) — 본실험 데이터 QC 체크리스트
