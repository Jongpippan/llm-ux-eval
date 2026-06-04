# Human Pilot 수행 체크리스트

> 본 환경은 **실험 준비/운영용**입니다. 본 문서는 결과를 해석하거나 논문 결론을 내리지 않으며,
> human pilot 을 **추가로 수행할 때**의 운영 절차만 다룹니다.

> **현황:** human pilot 은 **A·B 각 1회 보유**(`human_A_001`, `human_B_001`)합니다. A 의 최초 수집본은 오염으로 삭제 후 **재수집(clean)** 되어 현재본으로 대체됐습니다.
> 검수·삭제·재수집 기록은 [analysis/PILOT_QC_REPORT.md](../analysis/PILOT_QC_REPORT.md) 참조.
> 본 체크리스트는 **이후 추가 human pilot**(예: `human_A_002`, `human_B_002` …)을 수행할 때 따릅니다.

## 1. 추가 human pilot 수행 절차

1. 서버 기동
   - 개발: `npm run dev`
   - prod 검증: `npx next build` → `npx next start -p 3000`
2. 브라우저로 `http://localhost:3000/` 접속.
3. intro 화면에서 식별 정보를 **명시 입력**:
   - `participant_id` 직접 입력 (예: `P02`) — **`dev-<난수>` 자동생성 금지**
   - `participant_type = human`
   - `ui_variant = A` 또는 `B`
   - 쿼리로도 가능: `http://localhost:3000/?variant=A&participant=human&pid=P02`
4. `실험 시작`(`btn-start`) → 과업 조건 확인(`btn-goto-explore`).
5. 탐색(`/a` 또는 `/b`)에서 후보 확인, B 라면 비교 기능 사용, 최종 후보 선택.
6. 설문 3문항(난이도/만족도/확신도) 응답·제출.
7. 완료 화면에서 **반드시 `실험 종료`(`btn-finish`) 클릭** — 누락 시 `finished_at`/`finish` 이벤트가 비어 데이터가 불완전해집니다.
8. 완료 화면에서 `CSV 내려받기`(`btn-export-csv`) 및 `로그 JSON 내려받기`(`btn-export-json`)로 산출물 확보.

## 2. Export 파일 수집 절차

- `CSV 내려받기`(`btn-export-csv`)로 다음 3개 파일이 동시 다운로드됩니다:
  - `export_{sid}.json` (session 메타 + 최종선택 + 설문 + duration + 전체 events)
  - `events_{sid}.csv` (event 단위)
  - `session_{sid}.csv` (세션 1행 요약)
- 서버에도 동일 파일이 `logs/` 에 저장됩니다. **원본은 그대로 보존**합니다.
- 받은 파일을 `analysis/input/` 으로 **복사**하며 논리 ID 규칙을 따릅니다(원본 파일명은 보존):
  - A 조건: `human_A_00N_session.csv`, `human_A_00N_events.csv`
  - B 조건: `human_B_00N_session.csv`, `human_B_00N_events.csv`
  - raw export: `analysis/input/raw/human_A_00N_export.json` (또는 `human_B_00N_export.json`)
  - `00N` 은 기존 회차 다음 번호(예: 다음 A pilot 은 `human_A_002`).

## 3. 수집 시 주의 (이전 pilot 교훈)

1. **participant_id 명시 입력** — `dev-<난수>` 자동생성 ID 는 실험 데이터로 부적합 (이전 두 pilot 이 dev-id 로 수집됨).
2. **고정된 단일 빌드로 수집** — 코드 변경 중 수집 금지. `human_A_001` 은 코드 버전 전환 중 수집되어 초기 이벤트 필드 누락·`task_duration` 비정상으로 본실험 부적합 판정됨. 동일 오염 재발 방지.
3. **완료 화면 `finish` 클릭 필수** — 이전 A·B pilot 모두 `finish` 미클릭으로 `finished_at` 이 null 이었음.
4. **pilot / 본실험 / mock 데이터를 디렉토리·파일명으로 구분** — `analysis/input/` = pilot, `logs/` = 런타임, mock·빌드 검증 로그와 섞지 않음.

## 4. 체크리스트

- [ ] 수집 전 빌드 고정 확인 (`npx next build` / `npx tsc --noEmit` 통과, 수집 중 코드 변경 없음)
- [ ] intro 에서 `participant_id` 명시 입력 (dev-id 아님)
- [ ] `participant_type = human`, `ui_variant` 의도대로 선택
- [ ] 과업 조건 → 탐색/선택 → 설문 제출까지 완료
- [ ] 완료 화면에서 `실험 종료`(`btn-finish`) 클릭 (`finished_at` 기록됨)
- [ ] `CSV 내려받기` + `로그 JSON 내려받기` 로 export 확보
- [ ] `export_/events_/session_{sid}` 3종 + raw json 수령 확인
- [ ] `analysis/input/` 에 `human_A_00N_*` / `human_B_00N_*` 형식으로 복사 (raw 는 `analysis/input/raw/`)
- [ ] 원본 파일 보존, pilot/본실험/mock 데이터 혼동 없음

## 관련 문서

- [docs/EXPERIMENT.md](EXPERIMENT.md) — 실험 실행 가이드 (전체 흐름·로그 구조)
- [analysis/PILOT_QC_REPORT.md](../analysis/PILOT_QC_REPORT.md) — 기수행 pilot(A·B 각 1회) 검수 결과
- [analysis/ANALYSIS_PLAN.md](../analysis/ANALYSIS_PLAN.md) — 분석 계획
