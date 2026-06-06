# LLM Pilot Checklist

실제 LLM 기반 A/B smoke test 절차 문서. 시뮬레이션은 Playwright 로 웹을 구동하며, LLM provider 는 env 기반으로 설정된다.

> **본수집은 로컬 Ollama 기준:** 본 연구는 **로컬 Ollama `qwen2.5:32b`**(`OPENAI_BASE_URL=http://localhost:11434/v1`, quota 무관)로 수집한다. agent 아키텍처(uxagent/generic)는 [docs/UXAGENT.md](./UXAGENT.md) 참고. (Groq 등 호스티드 OpenAI 호환 백엔드도 동일 방식으로 동작하나 무료 티어 rate-limit 으로 본수집엔 부적합 — 아래 pacing 은 호스티드 사용 시 참고용.)

## Provider 동작 규칙 (`simulation/config.ts`, `simulation/agents/llmAgent.ts`)

- `LLM_PROVIDER` ∈ `anthropic | openai | mock`. unset/blank → `mock`.
- key 자동 감지: `LLM_PROVIDER` 미지정 시 `ANTHROPIC_API_KEY` 있으면 `anthropic`, `OPENAI_API_KEY` 있으면 `openai`, 둘 다 없으면 `mock`.
- model: `OPENAI_MODEL` (본 연구 `qwen2.5:32b`, 기본 `gpt-4o-mini`) / `ANTHROPIC_MODEL`(anthropic 사용 시 env 로 지정).
- **OpenAI 호환 백엔드**: `OPENAI_BASE_URL` 로 엔드포인트 변경(미지정 시 공식 OpenAI). Groq = `https://api.groq.com/openai/v1`, Ollama = `http://localhost:11434/v1`, OpenRouter = `https://openrouter.ai/api/v1`.
- **mock 자동 fallback 안 함(중요)**: clean run 수집을 위해 `sim:llm` 은 LLM 실패 시 mock 으로 자동 대체하지 않는다. 실패하면 retry/backoff 후 run 을 중단(clean 실패)한다. 개발용으로 섞으려면 `LLM_ALLOW_MOCK_FALLBACK=true`(그 run 은 자동으로 `is_clean_llm_run=false`).

## 로컬 Ollama 사용 (`.env.local`, 키는 채팅/커밋 금지)

```
LLM_PROVIDER=openai
OPENAI_API_KEY=ollama                          # Ollama 는 키를 무시(아무 값)
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=qwen2.5:32b
```
- `.env.local` 은 gitignore. `tsx` 가 자동 로드하지 않으므로 실행 시 `set -a; . ./.env.local; set +a` 로 주입한다.
- Ollama 서버 기동 + `qwen2.5:32b` pull 확인(`curl -s localhost:11434/api/tags`). 로컬은 rate-limit 이 없어 pacing/TPM 걱정 불필요.
- (호스티드 백엔드 예: Groq `https://api.groq.com/openai/v1` — 무료 TPM 한도가 있어 429 발생 시 아래 retry/backoff + `LLM_CALL_DELAY_MS` pacing 으로 대응.)

## 429 retry/backoff + 호출 페이싱

- `LLM_MAX_RETRIES`(기본 3): 429/오류 시 최대 재시도 횟수. retry 소진 후에도 실패하면 clean 실패(또는 fallback 허용 시 mock).
- `LLM_RETRY_BASE_MS`(기본 5000): 지수 backoff 기준(5s→10s→20s…). 429 응답의 `retry-after`/“try again in Xs” 가 있으면 그 값을 우선.
- `LLM_CALL_DELAY_MS`(기본 0): LLM 호출 사이 최소 간격. **Groq 무료 티어에서는 크게 잡으라**(예: `9000`~`12000`). 빠른 개발 테스트는 0, clean run 수집은 큰 delay 권장.

## 식별·재현성 파라미터

- `--participant-id`(신규): 실행 시 명시 pid 를 지정한다. 예: `npx tsx simulation/run.ts --variant=A --participant-id=llm_A_001`. 미입력 시 `dev-<난수>` 형태로 자동 생성된다.
- `LLM_TEMPERATURE`(신규, 기본 `0.2`): 재현성을 위한 고정 temperature. provider payload(anthropic/openai 호환)에 반영되며, session summary/export 에 `llm_temperature` 로 기록된다. 본실험에서는 낮은 고정값(`0.2`) 사용을 권장한다.

## real LLM smoke test 절차 (키가 있을 때만)

1. env 설정 — API key 는 셸 환경변수로만 주입하고 문서/로그/커밋에 남기지 않는다.
   - `LLM_PROVIDER=anthropic` (또는 `openai`)
   - `ANTHROPIC_API_KEY=...` (또는 `OPENAI_API_KEY=...`) — 플레이스홀더만 문서화, 실제 값 기재 금지.
   - 필요 시 `ANTHROPIC_MODEL` / `OPENAI_MODEL` 명시.
2. 서버 기동 — `npx next build` → `npx next start -p 3000` (또는 개발 시 `npm run dev`). 필요 시 `SIM_BASE_URL` 로 대상 URL 지정.
3. clean run 실행 (Groq 예시, `.env.local` source 후 pacing 크게):
   ```bash
   set -a; . ./.env.local; set +a
   LLM_TEMPERATURE=0.2 LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=A --participant-id=llm_A_pid_temp_001 --headless=true
   LLM_TEMPERATURE=0.2 LLM_CALL_DELAY_MS=9000 LLM_MAX_RETRIES=4 npx tsx simulation/run.ts --variant=B --participant-id=llm_B_pid_temp_001 --headless=true
   ```
   - 권장 식별: A=`llm_A_pid_temp_001`, B=`llm_B_pid_temp_001` (`--participant-id` 로 명시 pid 지정, 미입력 시 `dev-<난수>` 로 기록되며 provenance 로 구분).
4. 확인 항목:
   - [ ] `[sim] config:` 의 `provider` 가 `mock` 이 아님(예: `openai`+Groq base_url)
   - [ ] LLM action JSON parse 성공, Playwright 정상, final selection·survey 기록
   - [ ] **`[sim] provenance:` 가 `is_clean_llm_run=true` / `used_mock_fallback=false`**
   - [ ] `participant_id` 가 `dev-` id 가 아닌 명시 id(`llm_A_pid_temp_001` 등)로 저장됐는지
   - [ ] `llm_temperature` 기록 확인(`0.2` 등 고정값)
   - [ ] `[llmAgent] fallback`/`429` 가 retry 로 해소(또는 미발생)
   - [ ] A 에 compare 이벤트 없음 / B 에서 compare 발생 여부 확인(**B 에서 compare 는 강제 아님 → 미사용 가능, 그 경우 기록**)
   - [ ] open_detail 무한 반복이 완화됐는지(history prompt 효과)

옵션 플래그: `--variant=A|B`, `--scenario=s1`, `--maxSteps=N`, `--headless=true|false`, env `SIM_BASE_URL`.

## clean LLM run 기준 (인정 조건)

- **clean = 세션의 모든 action 이 실제 LLM provider 에서 나오고 mock fallback 이 한 번도 없음** → `is_clean_llm_run=true`, `used_mock_fallback=false`.
- mock 이 한 step 이라도 섞이면(429 소진·오류 → fallback 허용 시) → `is_clean_llm_run=false`, 그 run 은 real LLM 실험 데이터로 **인정하지 않는다**.
- 기본 정책(`LLM_ALLOW_MOCK_FALLBACK` 미설정)에서는 LLM 실패 시 run 이 **중단(clean 실패)** 되며, 이 run 은 보존하지 않고 실패 원인만 기록한다.
- 이 provenance 는 `session_{sid}.json` / `session_{sid}.csv` / `export_{sid}.json` 에 기록되고, 분석에서 `is_clean_llm_run != true` 인 llm 세션은 real LLM 집계에서 제외된다(`analysis/aggregate_sessions.py`).

## mock vs real LLM 구분 (중요)

- **provenance 필드로 판별**: 세션 로그/요약/ export 의 `llm_provider`, `llm_model`, `llm_temperature`, `used_mock_fallback`, `is_clean_llm_run`, `fallback_reason`.
  - clean real LLM: `is_clean_llm_run=true`, `used_mock_fallback=false`.
  - fallback 오염: `used_mock_fallback=true`, `is_clean_llm_run=false`, `fallback_reason` 에 사유.
  - 순수 mock 실행: `llm_provider=mock`, `is_clean_llm_run=false`.
- `[sim] config:` 의 `provider` 와 `[sim] provenance:` 로그로도 즉시 확인 가능.
- 매 회차 **"clean real LLM 여부"를 결과에 명시 기록**한다. fallback 섞인 run·mock 결과를 real LLM 결과로 보고하지 않는다.

## API key 없는 경우 처리

- real smoke 는 생략한다 (현재 상태).
- 흐름 확인용 mock 실행만 수행 가능:
  - `LLM_PROVIDER=mock npx tsx simulation/run.ts --variant=A --headless=true`
  - 또는 `npm run sim:mock -- --variant=A`
- 이 경우 `logs/` 에 남는 산출물은 **mock 결과**임을 명시적으로 표시한다 (real 실험 데이터 아님).

## 재현성 주의

- **temperature 는 `LLM_TEMPERATURE`(기본 `0.2`)로 설정되어 provider payload(anthropic/openai 호환)에 반영**되며, `llm_temperature` 로 provenance 에 기록된다(위 "식별·재현성 파라미터" 참조).
- 다만 **seed 는 미설정**이고, Groq/OpenAI-compatible provider 는 temperature 가 낮아도 완전 결정적이지 않을 수 있다 → 동일 입력에도 결과가 달라질 수 있다. 본실험에서는 낮은 고정 temperature + 모델/파라미터 기록으로 재현성 근거를 남기고, 필요 시 반복 수집한다.

## 체크리스트 (요약)

- [ ] env: `LLM_PROVIDER` + `*_API_KEY` (셸 주입) + model 설정 확인
- [ ] 서버 기동 (`next build` → `next start -p 3000`)
- [ ] variant A 1회 실행 (`--participant-id=llm_A_pid_temp_001`)
- [ ] variant B 1회 실행 (`--participant-id=llm_B_pid_temp_001`)
- [ ] LLM action JSON parse 성공
- [ ] Playwright 실행 성공
- [ ] final selection · survey response 기록 확인
- [ ] variant B compare action 발생 확인
- [ ] `[sim] config:` 로그로 실제 provider 확인 (mock fallback 여부)
- [ ] real LLM smoke 수행 여부를 결과에 명시 기록
- [ ] 재현성 정책(temperature/seed) 결정 여부 확인
- [ ] `participant_id` 가 명시 id 로 저장됐는지 / `llm_temperature` 기록 확인

## 관련 문서

- [docs/EXPERIMENT.md](./EXPERIMENT.md)
- [docs/MAIN_EXPERIMENT_PLAN.md](./MAIN_EXPERIMENT_PLAN.md)
- [analysis/ANALYSIS_PLAN.md](../analysis/ANALYSIS_PLAN.md)
