# LLM Main Run Checklist

LLM 기반 A/B 본실험(main run) 실행 체크리스트. pilot 에서 검증한 절차를 본실험 수집용으로 정리한다. 1차 규모는 **LLM A 5회 + LLM B 5회**다. 실행 절차·provenance 규칙의 상세 배경은 [docs/LLM_PILOT_CHECKLIST.md](./LLM_PILOT_CHECKLIST.md) 를 참고한다.

> 본 문서는 실행 절차만 다룬다. 결과 해석·결론은 분석 단계에서 수행한다.

## 1. `.env.local` 확인

`.env.local` 은 gitignore 대상이며, `tsx` 가 자동 로드하지 않으므로 실행 시 `set -a; . ./.env.local; set +a` 로 주입한다. **API key 값은 문서/로그/커밋에 남기지 않는다(플레이스홀더만).**

```
LLM_PROVIDER=openai
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_API_KEY=gsk_...                          # Groq 무료 키, 플레이스홀더만 기재
OPENAI_MODEL=llama-3.3-70b-versatile
LLM_TEMPERATURE=0.2
```

확인 항목:

- [ ] `LLM_PROVIDER=openai`
- [ ] `OPENAI_BASE_URL=https://api.groq.com/openai/v1`
- [ ] `OPENAI_API_KEY=gsk_...` (Groq 무료 키, 실제 값은 셸 환경에만 — 문서/로그/커밋 금지)
- [ ] `OPENAI_MODEL=llama-3.3-70b-versatile`
- [ ] `LLM_TEMPERATURE=0.2`

## 2. 서버 기동

본실험 run 은 서버가 떠 있어야 동작한다.

```bash
npx next start -p 3000
```

- [ ] 서버 기동 확인 (필요 시 `next build` 선행, `SIM_BASE_URL` 로 대상 URL 지정 가능)

## 3. run env 설정

| env | 본실험 값 | 비고 |
|---|---|---|
| `LLM_CALL_DELAY_MS` | `9000`~`12000` | Groq 무료 티어 pacing 권장 범위 |
| `LLM_MAX_RETRIES` | `4` | 429/오류 시 최대 재시도 |
| `LLM_ALLOW_MOCK_FALLBACK` | `false` (기본·유지) | mock 자동 대체 금지 — 본실험 필수 |

- [ ] `LLM_CALL_DELAY_MS` 를 9000~12000 사이로 설정
- [ ] `LLM_MAX_RETRIES=4`
- [ ] `LLM_ALLOW_MOCK_FALLBACK` 미설정 또는 `false` (mock fallback 비활성 유지)

## 4. 실행 명령어

각 run 전에 `.env.local` 을 source 한다(셸 새로 열 때마다).

```bash
set -a; . ./.env.local; set +a
```

### LLM A 5회 (`llm_A_001` ~ `llm_A_005`)

```bash
LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=A --participant-id=llm_A_001 --headless=true
LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=A --participant-id=llm_A_002 --headless=true
LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=A --participant-id=llm_A_003 --headless=true
LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=A --participant-id=llm_A_004 --headless=true
LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=A --participant-id=llm_A_005 --headless=true
```

### LLM B 5회 (`llm_B_001` ~ `llm_B_005`)

```bash
LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=B --participant-id=llm_B_001 --headless=true
LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=B --participant-id=llm_B_002 --headless=true
LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=B --participant-id=llm_B_003 --headless=true
LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=B --participant-id=llm_B_004 --headless=true
LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=B --participant-id=llm_B_005 --headless=true
```

- run 사이에는 텀을 두고 실행한다(아래 Groq 한도 주의 참고).
- 실행 진행:
  - [ ] `llm_A_001` 실행
  - [ ] `llm_A_002` 실행
  - [ ] `llm_A_003` 실행
  - [ ] `llm_A_004` 실행
  - [ ] `llm_A_005` 실행
  - [ ] `llm_B_001` 실행
  - [ ] `llm_B_002` 실행
  - [ ] `llm_B_003` 실행
  - [ ] `llm_B_004` 실행
  - [ ] `llm_B_005` 실행

## 5. clean run 확인 기준 (회차마다)

각 run 직후 `[sim] provenance:` 로그 또는 session summary 로 다음을 확인한다. 하나라도 불충족이면 clean run 이 아니다.

- [ ] `is_clean_llm_run=true`
- [ ] `used_mock_fallback=false`
- [ ] `fallback_reason` 없음
- [ ] `participant_id` 가 정확함 (`llm_A_001` 등 명시 id, `dev-` 자동 id 아님)
- [ ] `ui_variant` 가 정확함 (A run 은 A, B run 은 B)
- [ ] `llm_model` 기록 확인 (`llama-3.3-70b-versatile`)
- [ ] `llm_temperature` 기록 확인 (`0.2`)

## 6. 수집물 정리

clean run 으로 인정된 회차의 export 만 본실험 디렉토리로 모은다.

- 수집물 3종(session JSON/CSV, export JSON) 중 export 를 `analysis/input/main/llm/` 로 복사·정리한다.
- 파일명 규칙: `llm_A_001_export.json`, `llm_B_001_export.json` 등 (participant_id 기준).

- [ ] clean A 5회 export → `analysis/input/main/llm/`
- [ ] clean B 5회 export → `analysis/input/main/llm/`

## 7. 실패 run 처리

- mock fallback 발생(`used_mock_fallback=true`) 또는 clean 실패(`is_clean_llm_run != true`) 한 run 은 **본실험 LLM 데이터에서 제외**한다.
- 해당 산출물은 `analysis/input/excluded/fallback/` 로 분리 보관한다(실패 원인 함께 기록).
- **같은 `participant_id` 로 덮어쓰지 않는다.** 원본 실패본은 excluded 에 그대로 남기고, 재시도는 별도 id 를 부여한다.
  - 재시도 id 예: `llm_A_001` 실패 → 재시도는 `llm_A_001_retry1`, 다시 실패하면 `llm_A_001_retry2` …
  - 재시도가 clean 으로 통과하면 그 retry id 산출물을 `analysis/input/main/llm/` 로 수집한다.
- mock fallback 이 섞인 세션은 real LLM 본실험 데이터가 아니다 — real 결과로 보고/집계하지 않는다.

- [ ] 실패/오염 run 을 `analysis/input/excluded/fallback/` 로 분리 (원본 id 유지)
- [ ] 재시도는 별도 id(`*_retryN`)로 실행, 원본 id 덮어쓰기 없음
- [ ] 본실험 디렉토리에는 clean run 만 존재하는지 확인

## 8. Groq 무료 티어 한도 주의

- 무료 티어에는 분당 토큰 한도(TPM)가 있어 호출이 잦으면 429 가 발생한다.
- 대응:
  - **pacing**: `LLM_CALL_DELAY_MS` 9000~12000 으로 호출 간격 확보.
  - **run 간 대기**: 한 run 종료 후 다음 run 까지 텀을 둔다(연속 실행 시 한도 누적 소진).
  - **retry/backoff**: 일시적 429 는 `LLM_MAX_RETRIES=4` + 지수 backoff 로 자동 처리된다(429 의 `retry-after`/"try again in Xs" 우선).
- 단, 한도가 소진되면 retry 로도 즉시 해소되지 않으므로 **다음 분/일까지 대기**한 뒤 재개한다.

- [ ] pacing/대기 적용 후에도 한도 소진 시 시간 경과 후 재개

## 관련 문서

- [docs/LLM_PILOT_CHECKLIST.md](./LLM_PILOT_CHECKLIST.md)
- [docs/MAIN_EXPERIMENT_PLAN.md](./MAIN_EXPERIMENT_PLAN.md)
- [docs/EXPERIMENT.md](./EXPERIMENT.md)
