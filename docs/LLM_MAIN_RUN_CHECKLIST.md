# LLM Main Run Checklist

LLM 기반 A/B 본실험(main run) 실행 체크리스트. 1차 규모는 **uxagent A 10 / B 10**(persona 20명, between) + **generic baseline A 5 / B 5**다. agent 아키텍처 배경은 [docs/UXAGENT.md](./UXAGENT.md), 배정표는 [docs/MAIN_EXPERIMENT_ASSIGNMENT.md](./MAIN_EXPERIMENT_ASSIGNMENT.md) 참고.

> 본 문서는 실행 절차만 다룬다. 결과 해석·결론은 분석 단계에서 수행한다.

## 1. `.env.local` 확인 (로컬 Ollama)

`.env.local` 은 gitignore 대상이며 `tsx` 가 자동 로드하지 않으므로 실행 시 `set -a; . ./.env.local; set +a` 로 주입한다. 본실험은 **로컬 Ollama `qwen2.5:32b`** 로 수집한다(quota 무관).

```
LLM_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=ollama                 # Ollama 는 키를 무시(아무 값)
OPENAI_MODEL=qwen2.5:32b
LLM_TEMPERATURE=0.2                    # action 단계 고정(변동은 persona 에서)
```

- [ ] `LLM_PROVIDER=openai`, `OPENAI_BASE_URL=http://localhost:11434/v1`, `OPENAI_MODEL=qwen2.5:32b`
- [ ] Ollama 서버 기동 + 모델 pull 확인: `curl -s localhost:11434/api/tags` 에 `qwen2.5:32b` 존재
- [ ] `LLM_TEMPERATURE=0.2`

## 2. 서버 기동 (API 라우트 포함 빌드)

```bash
npx next build && npx next start -p 3000
```
- [ ] **코드 변경 후 반드시 재빌드**(stale 빌드는 신규 provenance 필드 `agent_arch`/`persona_id` 를 누락시킨다).
- [ ] 서버 기동 확인(`curl -s -o /dev/null -w '%{http_code}' localhost:3000/` = 200).

## 3. persona 생성 (uxagent, 1회)

```bash
set -a; . ./.env.local; set +a
npx tsx simulation/generate-personas.ts --count=20
```
- [ ] `simulation/personas/p01.json` ~ `p20.json` + `index.json` 생성 확인.
- [ ] 한 번 생성한 persona 는 **고정**해 모든 uxagent run 에서 재사용(재현). 재생성 금지.

## 4. 실행 명령어

각 run 전 `.env.local` 을 source 한다. **uxagent: persona 1명 = 1 run** (p01~p10→A, p11~p20→B).

```bash
set -a; . ./.env.local; set +a
# uxagent A (llm_ux_A_001~010 ← p01~p10)
AGENT_ARCH=uxagent npx tsx simulation/run.ts --variant=A --persona-id=p01 --participant-id=llm_ux_A_001 --headless=true
# … p02→llm_ux_A_002 … p10→llm_ux_A_010
# uxagent B (llm_ux_B_001~010 ← p11~p20)
AGENT_ARCH=uxagent npx tsx simulation/run.ts --variant=B --persona-id=p11 --participant-id=llm_ux_B_001 --headless=true
# … p20→llm_ux_B_010
# generic baseline (persona 없음; 기본 AGENT_ARCH=generic)
npx tsx simulation/run.ts --variant=A --participant-id=llm_A_001 --headless=true
```

- 로컬 Ollama 는 동시 실행 시 자원 경합 → **순차 실행** 권장.
- [ ] uxagent A 10건(p01~p10) 실행
- [ ] uxagent B 10건(p11~p20) 실행
- [ ] generic baseline A 5 / B 5 (이미 수집되어 있으면 생략; `agent_arch=generic` 확인)

## 5. clean run 확인 기준 (회차마다)

각 run 직후 `[sim] provenance:` 로그 또는 session summary 로 확인. 하나라도 불충족이면 clean run 이 아니다.

- [ ] `is_clean_llm_run=true` / `used_mock_fallback=false` / `fallback_reason` 없음
- [ ] `participant_id` 정확(명시 id, `dev-` 아님), `ui_variant` 정확
- [ ] `llm_model=qwen2.5:32b`, `llm_temperature=0.2`
- [ ] **`agent_arch`** 정확(uxagent run=`uxagent`, baseline=`generic`), uxagent 는 **`persona_id`** 기록
- [ ] uxagent 는 `logs/trace_{sid}.json`(reasoning trace) 생성 확인

## 6. 수집물 정리

clean run 의 export 만 본실험 디렉토리로 모은다. export 가 정본(session/events 동봉).

- 파일명: `llm_ux_A_001_export.json`, `llm_A_001_export.json` 등(participant_id 기준) → `analysis/input/main/llm/`.
- uxagent trace 는 `logs/trace_{sid}.json` 에 보존(정성 데이터, 분석 입력 아님).
- [ ] clean uxagent A 10 / B 10 export → `analysis/input/main/llm/`
- [ ] generic baseline A 5 / B 5 export 존재(`agent_arch=generic`)

## 7. 실패 run 처리

- clean 실패(`is_clean_llm_run != true`) run 은 본실험에서 **제외** → `analysis/input/excluded/fallback/` 로 분리(원인 기록).
- **같은 participant_id 로 덮어쓰지 않는다.** 재시도는 별도 id(`*_retryN`). 단 같은 persona 로 재시도(변동 원천 유지).
- [ ] 실패/오염 run 분리(원본 id 유지), 재시도 별도 id, 본실험 디렉토리에 clean 만 존재 확인

## 관련 문서
- [docs/UXAGENT.md](./UXAGENT.md) — agent 아키텍처(uxagent/generic)
- [docs/MAIN_EXPERIMENT_ASSIGNMENT.md](./MAIN_EXPERIMENT_ASSIGNMENT.md) — persona↔셀 배정표
- [docs/MAIN_EXPERIMENT_PLAN.md](./MAIN_EXPERIMENT_PLAN.md) · [docs/EXPERIMENT.md](./EXPERIMENT.md)
