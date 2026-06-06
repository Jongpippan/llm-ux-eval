# 비교 인터페이스 사용성 실험 환경

졸업논문 *"웹 인터페이스 사용성 평가에서 LLM 기반 사용자 시뮬레이션의 활용 가능성 연구: 비교 지원 인터페이스 사례"* 의
**실험 환경(구축/준비)** 입니다. Next.js(App Router) + TypeScript.

- **UI A**: 비교 기능 없는 기본 후보 탐색
- **UI B**: A와 동일하되 **비교 담기 + 비교 테이블(값 병치 + 속성별 우열 강조)** 추가, 비교 개수 제한 없음 (유일한 차이 = 비교 기능)
- Human 실험과 LLM 시뮬레이션(Playwright)이 동일 시나리오/과업으로 수행
- 수집: 클릭/탐색 로그, 최종 선택, 수행 시간, 난이도/만족도/확신도 설문
- 식별: intro 에서 `participant_id`·`participant_type`·`ui_variant` 입력 (실험용으로는 **participant_id / participant_type 명시 입력 권장**; 미입력 시 `dev-<난수>` 자동 생성). 시뮬레이션은 `--participant-id=...` 로 주입(mock/llm 공통, 예: `--participant-id=llm_A_001`); 미입력 시 `dev-<난수>` fallback 이나 **본실험엔 명시 입력 권장**. 지정한 participant_id 는 session / events / export / summary 에 동일하게 기록된다.
- export: 완료 화면에서 JSON / CSV 다운로드, 서버는 `logs/` 에 events/session/export(json) + events/session(csv) 저장

> 표시되는 제품/브랜드는 모두 **가상의 더미 데이터**이며, 본 저장소는 실제/가짜 실험 결과를 포함하지 않습니다.

## 빠른 시작
```bash
npm install
npm run dev            # http://localhost:3000
```
자세한 실행/시뮬레이션/로그 export 방법은 [docs/EXPERIMENT.md](docs/EXPERIMENT.md) 참고.

## 디렉토리
```
app/            라우트 (intro, experiment, a, b, survey, complete, api/log, api/session)
components/     UI 컴포넌트 (CandidateCard, ExploreView, Compare*, Likert 등)
lib/            types, candidates, logger, session, schema/(zod), testids
data/           candidates.json (더미 후보)
logs/           runtime 세션/이벤트 JSON·CSV·export 저장 (mock 등, gitignore, 분석 제외)
pilot/          사용자가 수행한 human pilot export 원본 (보존)
simulation/     Playwright runner + state/action + agents(mock/generic llm/persona uxagent) + persona/memory/interview
                personas/   생성된 가상 사용자 persona (uxagent 용, 재현 위해 레포 포함)
analysis/       로그 → 집계 CSV 스크립트, input/, PILOT_QC_REPORT.md, ANALYSIS_PLAN.md
                input/main/{human,llm}/     본실험 데이터
                input/pilot/{human,llm}/    pilot 데이터(분리)
                input/excluded/{mock,fallback}/  분석 제외(mock·fallback 섞인 run)
docs/           EXPERIMENT(실행)·EXPERIMENT_DESIGN(설계)·TESTID·HUMAN_PILOT_CHECKLIST·LLM_PILOT_CHECKLIST
```

## 데이터를 어디에 넣나 (human export CSV/JSON)
- 완료 화면 CSV/JSON export 로 받은 `export_{sid}.json` / `events_{sid}.csv` / `session_{sid}.csv` 를
  본실험은 `analysis/input/main/{human,llm}/`, pilot 은 `analysis/input/pilot/{human,llm}/` 에 **pid 를 알 수 있는 이름**으로 복사한다(원본 보존):
  - 본실험: `analysis/input/main/human/human_A_001_session.csv`, `analysis/input/main/human/human_A_001_events.csv`
  - pilot: `analysis/input/pilot/human/human_A_001_session.csv`, `analysis/input/pilot/human/human_A_001_events.csv`
  - export JSON 도 같은 폴더에 `human_A_001_export.json` 처럼 둔다.
- mock·fallback 이 섞인 run 은 `analysis/input/excluded/{mock,fallback}/` 로 분리하며 분석에서 제외한다.
- 분석 scope: 기본은 `analysis/input/main/` 만 분석한다. pilot 만 보려면 `ANALYSIS_SCOPE=pilot`, 둘 다는 `ANALYSIS_SCOPE=all` (`excluded/`·`logs/` 는 항상 분석 제외).
- 절차·주의는 [docs/HUMAN_MAIN_RUN_CHECKLIST.md](docs/HUMAN_MAIN_RUN_CHECKLIST.md) / [docs/HUMAN_PILOT_CHECKLIST.md](docs/HUMAN_PILOT_CHECKLIST.md), 검수 결과는 [analysis/PILOT_QC_REPORT.md](analysis/PILOT_QC_REPORT.md).

## 1차 본실험 규모·실행
- 규모(1차 확정): **Human A 5 / B 5** + **LLM(uxagent) A 5 / B 5**(persona p01–05→A, p11–15→B; between) + **LLM(generic) A 5 / B 5** baseline = 총 30세션. 실제 수집 현황·결과는 [analysis/COLLECTION_STATUS.md](analysis/COLLECTION_STATUS.md), 배정은 [docs/MAIN_EXPERIMENT_ASSIGNMENT.md](docs/MAIN_EXPERIMENT_ASSIGNMENT.md).
- human 실행 링크: `http://localhost:3000/?variant=A&participant=human&pid=human_A_001` (쿼리 파라미터 `variant`/`participant`/`pid`).
- LLM(uxagent) 실행 (`.env.local` 주입 후, persona 1명당 1 run):
  ```bash
  set -a; . ./.env.local; set +a
  AGENT_ARCH=uxagent npx tsx simulation/run.ts --variant=A --persona-id=p01 --participant-id=llm_ux_A_001 --headless=true
  ```
- 본실험 전 마지막 확인(단일 빌드 / 명시 pid / temperature 고정 / finish / agent_arch·persona_id): [docs/MAIN_DATA_QC_CHECKLIST.md](docs/MAIN_DATA_QC_CHECKLIST.md).

## 스크립트
| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 (타입체크 포함) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run sim:mock -- --variant=A` | mock 시뮬레이션(키 불필요, 흐름 검증용) |
| `npm run sim:llm -- --variant=B` | **generic** real LLM 시뮬레이션(baseline; 상태→action 단일 호출). **기본은 mock 자동 fallback 안 함** |
| `npm run sim:personas -- --count=20` | **Persona Generator** — 다양한 가상 사용자 persona 생성·저장(`simulation/personas/`) |
| `npm run sim:uxagent -- --variant=A --persona-id=p01` | **uxagent** 시뮬레이션(persona+기억+반성+인터뷰 설문) — [docs/UXAGENT.md](docs/UXAGENT.md) |
| `python3 analysis/aggregate_sessions.py` | 세션 집계 CSV 생성 (기본 `analysis/input/main/`, A/B·human/llm 그룹; `ANALYSIS_SCOPE=pilot`/`all` 로 범위 변경) |
| `python3 analysis/aggregate_events.py` | 이벤트 집계 CSV 생성 (event_type 분포, B compare 사용 등) |

> 분석 산출물은 `analysis/out/` 에 생성됩니다(gitignore). 데이터가 없으면 에러 없이 "로그 없음" 안내 후 종료합니다.

## real LLM 시뮬레이션 (로컬 Ollama 기준)
OpenAI 호환 백엔드를 `OPENAI_BASE_URL` 로 붙입니다. 본 연구는 **로컬 Ollama**(quota 무관)에서 `qwen2.5:32b` 로 수집합니다. (Groq 등 호스티드 OpenAI 호환 백엔드도 동일 방식으로 가능하나 무료 티어는 rate-limit 으로 본수집에 부적합.)

`.env.local` (gitignore, 키는 채팅/커밋 금지):
```
LLM_PROVIDER=openai
OPENAI_API_KEY=ollama                           # Ollama 는 키를 무시(아무 값)
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=qwen2.5:32b
LLM_TEMPERATURE=0.2                             # action 단계 기본 0.2, 재현성 위해 낮게
```
uxagent 수집 (서버 기동 후, persona 생성 → persona 1명당 1 run):
```bash
npx next build && npx next start -p 3000 &      # 서버(API 라우트 포함; static export 아님)
set -a; . ./.env.local; set +a
npx tsx simulation/generate-personas.ts --count=20            # 1회: persona 20명 생성
AGENT_ARCH=uxagent npx tsx simulation/run.ts --variant=A --persona-id=p01 --participant-id=llm_ux_A_001 --headless=true
AGENT_ARCH=uxagent npx tsx simulation/run.ts --variant=B --persona-id=p11 --participant-id=llm_ux_B_001 --headless=true
```
generic baseline 은 `--persona-id` 없이(기본 `AGENT_ARCH=generic`): `npx tsx simulation/run.ts --variant=A --participant-id=llm_A_001 --headless=true`.
- **agent_arch**: `generic`(baseline, 단일 호출) | `uxagent`(persona+기억+반성+인터뷰). provenance·분석에서 분리 집계 — [docs/UXAGENT.md](docs/UXAGENT.md).
- **mock fallback 주의**: 기본적으로 LLM 실패 시 mock 으로 섞지 않고 run 을 중단한다(clean run 보존). 개발용으로만 `LLM_ALLOW_MOCK_FALLBACK=true`.
- **clean LLM run 기준**: 모든 action 이 실제 LLM 에서 나오고 mock fallback 이 0 이면 `is_clean_llm_run=true`. 한 step 이라도 mock 이 섞이면 `is_clean_llm_run=false` 로 기록되어 분석에서 제외된다.
- **temperature**: action 단계는 `LLM_TEMPERATURE`(기본 `0.2`)로 낮게 고정(변동은 persona 에서). persona 생성·인터뷰 단계만 다양성/자연성 위해 더 높게(코드 내 고정). session summary / export 에 `llm_temperature` 기록.
- **reasoning trace**: uxagent run 은 think-aloud 격 memory 를 `logs/trace_{sid}.json` 으로 저장(정성 데이터).
- **pilot vs 본실험**: pilot 은 절차·도구 검증용, 본실험은 분석 대상 데이터 수집용으로 구분하며 mock/fallback 섞인 run 은 분석에서 제외한다 — [docs/EXPERIMENT_DESIGN.md](docs/EXPERIMENT_DESIGN.md).
- env: `AGENT_ARCH`(generic|uxagent), `REFLECT_EVERY`(기본4), `LLM_TEMPERATURE`(기본0.2), `LLM_MAX_RETRIES`(기본3), `LLM_RETRY_BASE_MS`(기본5000), `LLM_MAX_WAIT_MS`(기본120000), `LLM_CALL_DELAY_MS`(기본0), `LLM_ALLOW_MOCK_FALLBACK`(기본false). 상세: [docs/LLM_PILOT_CHECKLIST.md](docs/LLM_PILOT_CHECKLIST.md).

## 문서
| 문서 | 내용 |
|------|------|
| [docs/EXPERIMENT.md](docs/EXPERIMENT.md) | 실행·시뮬레이션·로그/export 절차 |
| [docs/EXPERIMENT_DESIGN.md](docs/EXPERIMENT_DESIGN.md) | 설계 원칙, A/B 통제, human/llm/mock·pilot/본실험 데이터 구분 |
| [docs/UXAGENT.md](docs/UXAGENT.md) | **LLM agent 아키텍처** — persona+기억+반성+인터뷰(uxagent) ↔ generic baseline, UXAgent[1] 매핑·단순화 |
| [docs/MAIN_EXPERIMENT_PLAN.md](docs/MAIN_EXPERIMENT_PLAN.md) | 본실험 실행 계획 |
| [docs/MAIN_EXPERIMENT_ASSIGNMENT.md](docs/MAIN_EXPERIMENT_ASSIGNMENT.md) | 1차 본실험 셀 배정 (Human/LLM × A/B, 각 5) |
| [docs/HUMAN_MAIN_RUN_CHECKLIST.md](docs/HUMAN_MAIN_RUN_CHECKLIST.md) | 본실험 human run 수행·수집 절차 |
| [docs/LLM_MAIN_RUN_CHECKLIST.md](docs/LLM_MAIN_RUN_CHECKLIST.md) | 본실험 LLM run 수행·수집 절차 |
| [docs/MAIN_DATA_QC_CHECKLIST.md](docs/MAIN_DATA_QC_CHECKLIST.md) | 본실험 전 마지막 확인 (단일 빌드·명시 pid·temperature·finish·agent_arch·persona_id) |
| [docs/DEPLOY_GH_PAGES.md](docs/DEPLOY_GH_PAGES.md) | **다른 기기/원격 human 수집** — GitHub Pages 정적 배포 + export.json 제출 |
| [docs/HUMAN_PILOT_CHECKLIST.md](docs/HUMAN_PILOT_CHECKLIST.md) | 추가 human pilot 수행·수집 절차 |
| [docs/LLM_PILOT_CHECKLIST.md](docs/LLM_PILOT_CHECKLIST.md) | real LLM A/B smoke test 절차, mock/real 구분 |
| [docs/TESTID.md](docs/TESTID.md) | data-testid 계약·LLM action 매핑 |
| [analysis/PILOT_QC_REPORT.md](analysis/PILOT_QC_REPORT.md) | 수행된 human pilot A·B QC 결과 |
| [analysis/ANALYSIS_PLAN.md](analysis/ANALYSIS_PLAN.md) | 분석 파이프라인 점검 계획 |

## data-testid 계약
UI와 시뮬레이션은 `lib/testids.ts`의 `TESTID` 상수만 사용합니다. 목록: [docs/TESTID.md](docs/TESTID.md).
