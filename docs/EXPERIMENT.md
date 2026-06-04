# 실험 실행 가이드

> 본 환경은 **실험 준비/운영용**입니다. 실제 사용자 실험 수행이나 결과 해석/결론은 포함하지 않으며,
> UI에 표시되는 후보는 모두 **가상의 더미 데이터**입니다.

## 0. 사전 준비
```bash
npm install
npx playwright install chromium   # 시뮬레이션용 브라우저(최초 1회)
```

## 1. Human pilot 실행 절차
```bash
npm run dev
```
1. 브라우저로 접속: `http://localhost:3000/`
2. intro 화면에서 **participant_id 입력**, **participant_type(human/llm) 선택**, **ui_variant(A/B) 선택** 후 `실험 시작`.
   - 쿼리로도 지정 가능: `http://localhost:3000/?variant=A&participant=human&pid=P01`
3. 흐름: intro(`btn-start`) → 조건확인(`btn-goto-explore`) → 탐색(/a 또는 /b) → 최종선택 → 설문 → 완료
4. 완료 화면에서 `로그 JSON 내려받기`(`btn-export-json`) 또는 `CSV 내려받기`(`btn-export-csv`)로 산출물 확보.
5. 모든 클릭/전이가 로그로 남습니다 (localStorage + 서버 `logs/`).

> **실험용으로는 participant_id / participant_type 을 명시 입력하는 것을 권장**합니다.
> 미입력 시 `participant_id` 는 개발용 `dev-<난수>` 가 자동 생성되며, 이는 실험 데이터로 적합하지 않습니다.

### participant_id 부여 규칙 예시
- human: `P01, P02, ...` (참여자 모집 순번)
- LLM: `L01, L02, ...` 또는 `llm-<model>-<seq>` (예: `llm-claude-01`)
- 한 참여자가 A·B 를 모두 수행하는 within-subject 라면 `P01-A`, `P01-B` 처럼 조건 접미사 사용.

### A/B 조건 배정 방법 예시
- between-subject: 짝수 번호 → A, 홀수 번호 → B (또는 난수 배정 후 기록).
- within-subject: 참여자별로 A·B 순서를 카운터밸런싱(절반은 A→B, 절반은 B→A).
- 배정 결과(participant_id ↔ variant)는 **실험자 측 별도 표**로 관리하고 logs 와 대조.

### A/B 통제 (변경 금지)
- A와 B는 동일 후보 데이터·동일 정보항목·동일 **속성 값**·동일 과업 흐름을 공유합니다.
- **유일한 차이는 비교 기능 유무**: B에만 "비교 담기 / 비교 영역 / 비교 테이블"이 있습니다.
- B의 비교 지원 = **값 병치 + 속성별 우열 강조**(가장 우수한 값에 `▲`·하이라이트, 동점이면 모두). 강조는 A와 같은 값 위의 **시각적 처리 보조**이며 새 정보값을 추가하지 않습니다 — 비교 기능(단일 조작)에 포함되는 구성요소로 간주합니다. 비교 가능 후보 **개수 제한은 없습니다**(다중대안 비교).
- 이 차이를 추가로 늘리지 마십시오(통제 변수). LLM 시뮬레이션도 `state.compareView` 로 동일한 강조 단서를 받습니다.

## 2. LLM mock simulation 실행 절차
dev 또는 prod 서버가 떠 있는 상태에서(별도 터미널):
```bash
# mock(룰 기반, API 키 불필요) — UI A
npm run sim:mock -- --variant=A

# UI B
npm run sim:mock -- --variant=B --headless=false   # 브라우저 보면서 실행
```
- mock 은 결정적 룰 기반 agent 로, **흐름 동작 검증용**입니다. 실험 결과 데이터가 아닙니다.
- 옵션: `--variant=A|B`, `--scenario=s1`, `--maxSteps=40`, `--headless=true|false`, `--baseUrl=...`
- prod 서버로 검증 시: `npx next build` → `npx next start -p 3000` → `LLM_PROVIDER=mock npx tsx simulation/run.ts --variant=A --headless=true`

## 3. 실제 LLM API 연결 전 주의사항
```bash
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=... npm run sim:llm -- --variant=B
```
- 키가 없으면 자동으로 mock agent 로 fallback 됩니다.
- 연결 전 확인: **API 키/Provider 설정**, **비용·레이트리밋**, **재현성(temperature/seed 정책)**, **로그에 모델·파라미터 기록 여부**.
- LLM 세션도 intro 에서 `participant_type=llm` 과 식별용 `participant_id`(예: `llm-claude-01`)를 부여해 human 과 구분.

## 4. 로그 / Export 파일 구조
서버 저장(`logs/`):
| 파일 | 시점 | 내용 |
|------|------|------|
| `events_{sid}.json` | 이벤트마다 append | LogEvent 배열 |
| `session_{sid}.json` | 설문 제출·완료 시 merge | 세션 메타 + 최종선택 + 설문 + duration |
| `export_{sid}.json` | 완료(finish) 시 | session 메타 + 최종선택 + 설문 + duration + **전체 events** (브라우저 CSV export 의 session JSON 과 동형) |
| `events_{sid}.csv` | 완료 시 | event 단위 CSV (고정 컬럼) |
| `session_{sid}.csv` | 완료 시 | 세션 1행 요약 CSV (고정 컬럼) |

브라우저 export(완료 화면):
- `로그 JSON 내려받기`(`btn-export-json`): events 배열 JSON
- `CSV 내려받기`(`btn-export-csv`): `export_{sid}.json` + `events_{sid}.csv` + `session_{sid}.csv` 동시 다운로드

LogEvent 필드:
- 필수: `event_type, timestamp, ui_variant, participant_type, session_id, target_id, action_detail, elapsed_ms`
- 분석용(선택/nullable): `participant_id, step_name, candidate_id, candidate_position, compare_count, current_compare_ids, final_selected_candidate_id, survey_difficulty, survey_satisfaction, survey_confidence`
- CSV 에서 배열(`current_compare_ids`)은 `|` 구분 문자열, `action_detail` 은 JSON 문자열로 저장.

## 5. 분석 준비
```bash
python3 analysis/aggregate_sessions.py   # → analysis/out/sessions_long.csv, sessions_grouped.csv
python3 analysis/aggregate_events.py     # → analysis/out/events_long.csv, events_by_type.csv
```
- A/B 는 `ui_variant`, human↔LLM 은 `participant_type` 컬럼으로 그룹핑.
- 표 집계만 수행하며 결과를 **해석/결론짓지 않습니다.** 자세한 내용은 [analysis/README.md](../analysis/README.md).

## 6. 실제 실험 전 체크리스트
- [ ] `npx next build` / `npx tsc --noEmit` 통과
- [ ] `npx playwright install chromium` 완료
- [ ] A/B 각각 human 흐름 수동 1회 점검 (입력→선택→설문→완료→export)
- [ ] mock 시뮬레이션 A/B 각 1회 end-to-end 확인
- [ ] participant_id 부여 규칙 / A·B 배정표 확정
- [ ] 실제 LLM 사용 시: 키·provider·비용·레이트리밋·재현성 정책 확인
- [ ] **검증·테스트로 생긴 mock 로그 전부 삭제** (logs/ 에 `.gitkeep` 만 남았는지 확인)
- [ ] logs/ 백업·익명화 정책 확인 (PII 미수집 — session_id/participant_id 만 사용)

## 7. ⚠️ 실제 실험 데이터 vs mock 테스트 로그 구분 (필수)
- **mock simulation·빌드 검증으로 생성된 로그는 실험 데이터가 아닙니다.** 실제 수집을 시작하기 전 반드시 `logs/` 를 비워 `.gitkeep` 만 남기십시오.
- mock agent 가 남기는 설문 자유응답은 `"mock agent run"` 입니다 — 실측과 섞이면 안 됩니다.
- 분석 산출물(`analysis/out/`)도 입력 로그에 의존하므로, mock 로그로 만든 CSV 와 실험 CSV 를 혼동하지 마십시오.
- `logs/` 와 `analysis/out/` 은 gitignore 되어 커밋되지 않습니다.
