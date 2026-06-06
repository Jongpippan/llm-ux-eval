# UXAgent 식 LLM 시뮬레이션 (persona 기반)

본 문서는 LLM 사용자 시뮬레이션의 **agent 아키텍처**를 정리한다. 참고논문 [1](UXAgent, Lu·Zhu et al., arXiv 2504.09407)의 구조를 본 연구 규모에 맞게 **핵심만 충실히** 옮기고(=핵심 충실판), 일부를 명시적으로 단순화했다. 실행 절차는 [LLM_MAIN_RUN_CHECKLIST.md](LLM_MAIN_RUN_CHECKLIST.md), 설계·데이터 구분은 [EXPERIMENT_DESIGN.md](EXPERIMENT_DESIGN.md) 에 위임한다.

## 1. 두 가지 agent 아키텍처 (`agent_arch`)
LLM run 은 `agent_arch` provenance 로 구분되며, 분석에서 별도 그룹으로 집계된다.

| `agent_arch` | 설명 | 용도 |
|---|---|---|
| `generic` | 상태(JSON) → action(JSON) **단일 호출** 반복. persona·기억 없음. | **baseline**. 단일 generic agent ×N = 사실상 "같은 사용자 N회". |
| `uxagent` | persona + Memory Stream + Planning/Reflection + Agent Interview 설문. | 본 연구의 주 LLM 데이터. persona 다양성이 사용자 표본의 변동 원천. |

> generic 을 baseline 으로 함께 보고하면, persona/기억 도입이 Human 정렬을 개선하는지를 대조할 수 있다(Human vs generic-LLM vs uxagent-LLM 3-way).

CLI: `AGENT_ARCH=uxagent ... --persona-id=p01` (기본은 `generic`). 코드: `simulation/config.ts`.

## 2. UXAgent[1] 원 구조 ↔ 본 구현 매핑
| UXAgent[1] 모듈 | 본 구현 | 파일 |
|---|---|---|
| **Persona Generator** | 인구통계 분포 spec + 예시 persona 로 LLM 이 다양한 persona N명 생성·저장 | `simulation/persona.ts`, `simulation/generate-personas.ts`, `simulation/personas/*.json` |
| **Perception → Planning → Action** (fast loop) | 매 step **단일 호출**로 `{observation, plan, action}` 결합 산출 | `simulation/agents/personaAgent.ts` |
| **Reflection** (slow loop) | `REFLECT_EVERY`(기본 4) step 마다 최근 기억 종합 → 고수준 통찰 | `personaAgent.reflect()` |
| **Memory Stream** | 관찰/계획/행동/반성을 자연어 엔트리로 누적, 가중 회수 | `simulation/memory.ts` |
| **Agent Interview** | 종료 후 persona+trace 근거로 인터뷰 → Human 과 동일한 3문항(1~5) 자기보고 | `simulation/interview.ts` |
| Universal Browser Connector (관찰/행동공간) | Playwright + 상태 추출 + action 실행(기존 인프라) | `simulation/stateExtractor.ts`, `actionExecutor.ts` |
| Reasoning trace (think-aloud) | Memory Stream 전체를 `logs/trace_{sid}.json` 으로 저장 | `run.ts` |

## 3. 한 run 의 흐름 (uxagent)
1. `--persona-id` 로 persona 1명 로드(`simulation/personas/`).
2. explore 단계 매 step:
   - (주기적) **Reflection**: 관련 기억 회수 → 통찰 1~2문장을 memory 에 추가(importance 높음).
   - **Perception+Planning+Action**(1콜): persona + 과업 하드조건 + 회수 기억 + 현재 상태(14개 후보 전체 속성, B면 비교표) → `{observation, plan, action}`. 관찰·계획·행동을 memory 에 적재.
3. 충분히 따지면 `select_final`.
4. survey 단계: **Agent Interview** — persona+trace 근거로 난이도/만족도/확신도(1~5)+freeText 자기보고.
5. complete → finish. trace 저장 + provenance(`agent_arch=uxagent`, `persona_id`) POST.

> 행동 어휘/스키마(click/compare_add/view_compare/select_final/answer_survey/finish)는 generic·human 과 동일(`lib/schema/llmAction.ts`). 변동은 프롬프트 조작이 아니라 **persona 다양성**에서 발생한다.

## 4. 명시적 단순화 (원 논문 대비) — 논문에 그대로 기술할 것
원 UXAgent[1] 대비 다음을 단순화했다. 본 연구의 비교 타당성(동일 과업·동일 정보환경·동일 측정)에는 영향이 없고, persona 다양성·기억 기반 추론·인터뷰 설문이라는 **본질은 유지**한다.

- **비동기 이중 루프 → 동기 단일 루프 + 주기적 reflection.** fast/slow loop 를 병렬 비동기로 돌리지 않고, step 루프 안에서 동기 호출하며 reflection 만 주기적으로 끼운다.
- **Perception/Planning/Action 3모듈 → 1콜 결합.** 세 모듈의 *내용*(관찰·계획·행동)은 한 JSON 으로 모두 산출하되 호출 수를 줄였다.
- **임베딩 기반 memory 검색 → 키워드 근사.** 회수 점수 = importance·recency·relevance 이되 relevance 를 임베딩 유사도 대신 토큰 겹침으로 근사.
- **Wonder 모듈·Simulation Replay UI 생략.** 현실성 보조·분석 UI 는 본 연구 범위 밖.
- **규모**: 수천 명이 아니라 **셀당 5명**(1차 확정, persona 20명 생성 중 A=p01–05·B=p11–15 사용; 나머지 예비). 비교 상대인 human 표본이 소규모라 의도적으로 제한.
- **종료(anti-loop) 가드**: explore step 이 `maxSteps`(기본 50)의 절반을 넘으면 프롬프트가 같은 후보 반복 클릭을 막고 `select_final` 을 강하게 유도한다. patience 높은 persona 가 step 상한까지 탐색만 하다 미완료(final/survey 누락)로 끝나는 것을 방지하기 위한 휴리스틱(원 논문에는 없음). 수집 파라미터·실제 현황은 [analysis/COLLECTION_STATUS.md](../analysis/COLLECTION_STATUS.md).

## 5. 통제 (persona 가 바꾸지 않는 것)
persona 는 **상충 속성(가격·재생시간·무게·평점 등)을 어떻게 가중하고, 얼마나 신중히 탐색하며, 어떻게 자기보고하는지**에만 영향을 준다. 다음은 persona 와 무관하게 모든 agent·human 에 공통 구속된다:
- 과업 하드조건: **ANC 지원 + 가격 150,000원 이하** 후보 중 선택.
- 동일 후보 데이터·동일 정보 노출(14개 후보 전체 속성)·동일 과업 흐름.
- 동일 측정(수행시간 to select_final, 행동 로그, 3문항 설문).

## 6. 재현성
- persona 는 1회 생성해 `simulation/personas/` 에 **저장·고정**하고 run 마다 재사용한다(레포에 포함 → 시뮬레이션 표본 공개·재현 가능).
- action 단계 temperature 는 낮게 고정(`LLM_TEMPERATURE`, 기본 0.2) — 변동은 persona 에서 오게 한다. persona 생성·interview 단계만 다양성/자연성을 위해 더 높게 사용(코드 내 고정).
- 모델/temperature/agent_arch/persona_id 는 provenance 로 기록된다.

## 7. 관련 문서·참고문헌
- [LLM_MAIN_RUN_CHECKLIST.md](LLM_MAIN_RUN_CHECKLIST.md) — persona 생성·uxagent 실행 절차
- [EXPERIMENT_DESIGN.md](EXPERIMENT_DESIGN.md) — 설계·데이터 구분(generic baseline vs uxagent)
- [MAIN_EXPERIMENT_ASSIGNMENT.md](MAIN_EXPERIMENT_ASSIGNMENT.md) — persona ↔ 셀 배정
- [1] Lu, Zhu, et al., 2025, *UXAgent: A System for Simulating Usability Testing of Web Design with LLM Agents*, arXiv:2504.09407.
