# 수집 현황·결과 스냅샷 (COLLECTION_STATUS)

> **이 문서가 "실제로 무엇을 수집했고 어떤 결과가 나왔는지"의 단일 참조점이다.** 분석·논문 작성 시 여기서 시작하라.
> 설계 원칙은 [docs/EXPERIMENT_DESIGN.md](../docs/EXPERIMENT_DESIGN.md), LLM agent 구조는 [docs/UXAGENT.md](../docs/UXAGENT.md), 지표 정의는 [ANALYSIS_PLAN.md](ANALYSIS_PLAN.md).

## 1. 실제 수집한 데이터 (1차, 확정)
총 **30세션** — `analysis/input/main/` (분석 기본 scope=main).

| 집단 | A | B | participant_id | agent_arch | 비고 |
|---|---|---|---|---|---|
| Human | 5 | 5 | `human_A_001~005`, `human_B_001~005` | — | 실사용자 |
| LLM **uxagent** | 5 | 5 | `llm_ux_A_001~005`, `llm_ux_B_001~005` | `uxagent` | 주 데이터(persona+기억+반성+인터뷰) |
| LLM **generic** | 5 | 5 | `llm_A_001~005`, `llm_B_001~005` | `generic` | baseline(상태→action 단일 호출) |

- **셀당 5명/회 (5/cell)** 으로 확정(human n=5와 동일 N 맞춤). 당초 계획의 uxagent 10/cell 에서 **5/cell 로 축소**(수집 시간·메모리 부하 이유, between 유지).
- uxagent persona 배정: **A=p01~p05, B=p11~p15** (`simulation/personas/`). p06~p10·p16~p20 은 생성만 해두고 **미사용(예비)** — 나중에 n 을 늘리려면 이들로 추가 run 가능.
- 모든 LLM 세션 `is_clean_llm_run=true`, `used_mock_fallback=false`.

## 2. 수집 파라미터 (재현용)
- 모델: **Ollama 로컬 `qwen2.5:32b`** (단일 모델 고정). action `LLM_TEMPERATURE=0.2`.
- `AGENT_ARCH=uxagent`, `REFLECT_EVERY=4`, `--maxSteps=50`.
- **anti-loop 가드**(personaAgent): explore step 이 maxSteps 의 절반(=25)을 넘으면 같은 후보 반복 클릭을 막고 `select_final` 을 강하게 유도 → 무한 탐색/루프로 인한 미완료(final/survey 누락) 방지. (도입 이유: patience 높은 persona 가 step 상한까지 탐색만 하다 종료되는 사례가 있었음.)
- uxagent reasoning trace(think-aloud)는 `logs/trace_{sid}.json` 에 보존(정성 분석용, 11건).

## 3. 집계 스냅샷 (`analysis/out/sessions_grouped.csv`, 각 n=5)
> 기술통계·**방향 관찰**만. n=5 라 통계검정 아님. 재생성: `python3 analysis/aggregate_sessions.py`.

| cell | n | time→final(s)¹ | 난이도(↓쉬움) | 만족(↑) | 확신(↑) | final 분포 |
|---|---|---|---|---|---|---|
| A human | 5 | 236 | 3.4 | 2.0 | 3.4 | c07:3 c11 c12 |
| A uxagent | 5 | 742 | 3.0 | 3.2 | 4.2 | c03:2 c10:2 c13 |
| A generic | 5 | 83 | 2.0 | 4.0 | 3.0 | c12:3 c11 c13 |
| B human | 5 | 120 | 2.2 | 3.6 | 4.0 | c07:3 c11 c12 |
| B uxagent | 5 | 362 | 2.6 | 4.0 | 4.2 | c03:3 c11 c13 |
| B generic | 5 | 157 | 2.0 | 4.0 | 3.2 | c04 c11:2 c12 c03 |

¹ **절대 시간 비교 불가**: uxagent time→final 은 step 마다 LLM 추론 대기(~수십 초)가 포함된 값. 사람과 절대값 비교 금지, **A→B 방향만** 의미.

### 관찰 (기술통계, 해석 신중)
- **A→B 방향 정렬**: human 은 B 에서 난이도↓·만족↑·시간↓. **uxagent 도 같은 방향**(난이도 3.0→2.6, 만족 3.2→4.0, 시간↓). **generic 은 설문이 평탄**(난이도 2.0/2.0, 만족 4.0/4.0) — persona 부재 시 "같은 사용자 N회" 문제 재현.
- **선택 일치(RQ1)는 약함**: human 은 c07 선호, LLM(uxagent/generic)은 c03/c10/c11 선호 → 최종 선택 exact-match 낮음. "주관·과정 지표는 정렬, 최종 선택은 불일치"로 서술.

## 4. 아직 안 한 분석 (논문 결과장 채우기 전 필요)
ANALYSIS_PLAN §6-1 에 정의만 있고 **미구현**:
- RQ1: 선택 exact-match rate, 설문 A→B 방향 일치 판정.
- RQ2: click 수·viewed distinct·compare action 빈도·탐색 깊이, viewed set Jaccard·경로 edit distance.
- 이들은 **저장된 export 의 events 만으로 오프라인 계산 가능**(LLM 재실행 불필요).

## 5. 논문/분석 시 참조 맵
| 무엇 | 어디 |
|---|---|
| 연구목적·RQ·방법 서술 | `논문계획서.md` |
| 실험 설계·A/B 통제·데이터 구분 | `docs/EXPERIMENT_DESIGN.md` |
| LLM agent 구조(persona/기억/반성/인터뷰)·UXAgent[1] 매핑·단순화 | `docs/UXAGENT.md` |
| 실행 절차·로그 필드·export 구조 | `docs/EXPERIMENT.md`, `docs/LLM_MAIN_RUN_CHECKLIST.md` |
| **실제 수집물·파라미터·결과 스냅샷** | **이 문서** |
| 지표 정의·분석 파이프라인 | `analysis/ANALYSIS_PLAN.md`, `analysis/README.md` |
| 집계 산출물(수치) | `analysis/out/sessions_grouped.csv`, `sessions_long.csv` |
| 원자료 | `analysis/input/main/{human,llm}/*_export.json`, 정성: `logs/trace_*.json` |
| persona 정의(시뮬레이션 표본) | `simulation/personas/p*.json` |
