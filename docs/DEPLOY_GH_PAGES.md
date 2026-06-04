# GitHub Pages 정적 배포 (human 원격 수집)

링크 하나로 다른 기기의 참가자가 실험을 수행하고, 완료 시 **`export_*.json`** 을 받아 제출하는 방식이다.

> **모델 요약**: GitHub Pages 는 정적 호스팅이라 서버(API route)·자동 로그 저장이 **없다**. 분석에 필요한 건 `export_*.json`(클라이언트 생성) 하나뿐이므로, **참가자가 완료화면에서 받은 파일을 실험자에게 제출**하는 방식으로 수집한다.
> **LLM 시뮬레이션은 Pages 가 아니라 로컬에서** 돌린다(provenance 기록에 서버가 필요 — `docs/LLM_MAIN_RUN_CHECKLIST.md`). Pages 는 **human 전용** 배포다.

## 1. 동작 방식 (정적 모드)
- `NEXT_PUBLIC_STATIC_EXPORT=1` 빌드에서: `output:'export'` 로 `out/` 정적 사이트 생성, API route 는 빌드에서 제외(`scripts/build-static.mjs` 가 `app/api` 를 빌드 동안만 옮겼다 복원).
- 클라이언트는 `/api/*` POST 를 **스킵**(404 없음). 행동 로그는 localStorage 에 쌓이고, 완료화면 **‘실험 종료 & 결과 저장’** 클릭 시 `export_{sid}.json` 이 **자동 다운로드**된다.
- 이미지·자산은 `NEXT_PUBLIC_BASE_PATH`(서브경로 배포 시 `/<repo>`)로 prefix 된다.

## 2. 최초 설정 (1회)
1. 저장소를 GitHub 에 push.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions** 로 설정.
3. **project site**(`https://<user>.github.io/<repo>/`)로 배포하면 서브경로가 필요하므로:
   **Settings → Secrets and variables → Actions → Variables** 에 `PAGES_BASE_PATH = /<repo>` 추가.
   - user/org page(`<user>.github.io`) 또는 커스텀 도메인(루트)면 `PAGES_BASE_PATH` 를 비우거나 만들지 않는다.
4. `main` 에 push 하면 `.github/workflows/deploy.yml` 이 빌드·배포한다(수동 실행: Actions → Deploy to GitHub Pages → Run workflow).

## 3. 로컬에서 정적 빌드 확인(선택)
```bash
npm run build:static                              # 루트(basePath 없음)
NEXT_PUBLIC_BASE_PATH=/<repo> npm run build:static # project site 와 동일 조건
python3 -m http.server 8080 --directory out        # http://localhost:8080 에서 확인
```
> `npm run build:static` 은 `app/api` 를 빌드 동안만 옮겼다가 try/finally 로 **반드시 복원**한다(로컬/LLM 시뮬레이션용 route 보존).

## 4. 참가자 링크 (between-subject: 한 사람당 한 조건 1회)
쿼리 파라미터는 `variant` / `participant` / `pid`:
- A: `https://<user>.github.io/<repo>/?variant=A&participant=human&pid=human_A_001`
- B: `https://<user>.github.io/<repo>/?variant=B&participant=human&pid=human_B_002`
- 참가자마다 **새 시크릿 창** 권장(localStorage 격리). 배정은 `docs/MAIN_EXPERIMENT_ASSIGNMENT.md`.

## 5. 수집 흐름
1. 참가자: 링크 → 탐색/선택 → 설문 → 완료화면 **‘실험 종료 & 결과 저장’** 클릭 → `export_{pid 세션}.json` 자동 다운로드 → **실험자에게 제출**(메일/드라이브 업로드 등).
2. 실험자: 받은 파일을 `analysis/input/main/human/` 에 둔다(파일명에 participant_id 포함 권장: `human_A_001_export.json`). 이후 `python3 analysis/aggregate_sessions.py`.

## 6. 주의 / 한계
- **서버 자동 백업이 없다** → 참가자가 finish & 다운로드 & 제출을 안 하면 그 세션 데이터는 없다. 안내를 명확히 하고 제출 여부를 배정표에서 확인.
- 핵심 데이터(select_final·survey)는 finish 전에 이미 events 에 있으므로, 누락 시에도 받은 export.json 안에 들어 있다(분석 수행시간은 select_final 기준이라 finish 여부와 무관).
- 표시 데이터는 모두 더미. **PII 미수집**(participant_id 만). export.json 외 개인정보를 입력받지 않는다.
- mock/fallback/pilot 데이터와 섞지 말 것(`analysis/input/main/` = 본실험만, `docs/MAIN_DATA_QC_CHECKLIST.md`).
