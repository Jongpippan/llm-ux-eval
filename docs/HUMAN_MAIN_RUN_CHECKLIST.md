# Human 본실험 운영 체크리스트

> 본 문서는 Human 참가자 **본실험(main) 1회 세션**을 운영하기 위한 실험자용 체크리스트다.
> 흐름·로그 필드 정의는 [docs/EXPERIMENT.md](EXPERIMENT.md), 설계 원칙·데이터 구분은 [docs/EXPERIMENT_DESIGN.md](EXPERIMENT_DESIGN.md) 에 위임한다.
> 결과 해석·결론은 포함하지 않는다.

## 0. 기본 정보

- 세션 흐름: intro(식별 입력) → experiment(과업 조건 확인) → explore(`/a` 또는 `/b` 탐색) → 최종 선택 → survey(난이도/만족도/확신도) → complete(**`실험 종료` 버튼 클릭 필수**) → CSV/JSON export.
- Human 진입 URL(쿼리 `variant` / `participant` / `pid`):
  - variant A: `http://localhost:3000/?variant=A&participant=human&pid=human_A_001`
  - variant B: `http://localhost:3000/?variant=B&participant=human&pid=human_B_001`
  - `001` 부분은 참가자 순번에 맞춰 증가시킨다(`human_A_002`, `human_A_003`, ...).
- 1차 수집 규모: **Human A 5명, Human B 5명**.
- 산출물 저장 위치: `analysis/input/main/human/` (원본 보존).

---

## 1. 실험 전 준비

- [ ] 서버 실행
  - 개발 모드: `npm run dev`
  - 또는 고정 빌드: `npx next build && npx next start -p 3000`
- [ ] 브라우저 초기화: 이전 세션의 localStorage 를 비운다 — **새 incognito(시크릿) 창**으로 여는 것을 권장(세션 간 상태 격리).
- [ ] `participant_id` 확인: 이번 세션에 부여할 `pid`(예: `human_A_001`)를 배정표에서 확인.
- [ ] `variant` 확인: 배정표상 이 참가자의 조건(A 또는 B)을 확인하고 URL 쿼리 `variant` 와 일치시킨다.
- [ ] 저장 폴더 확인: `analysis/input/main/human/` 디렉토리가 존재하는지 확인(없으면 생성).

---

## 2. 참가자 안내문 (스크립트형 — 그대로 읽어줄 수 있음)

> "지금부터 웹 인터페이스에서 후보들을 살펴보고 하나를 고르는 과제를 진행하겠습니다.
> 이 과제에는 **정답이 따로 없습니다.** 평소 인터넷에서 무언가를 고르듯이 편하게 탐색해 주세요.
> 화면에 제공되는 기능이 있다면 **필요할 때 자유롭게 사용**하셔도 됩니다.
> 진행 중 **언제든 중단**하실 수 있고, 그래도 불이익은 없습니다.
> 입력 화면에는 **이름·연락처 등 개인정보를 절대 입력하지 마시고**, 제가 안내한 식별 번호(participant_id)만 사용됩니다.
> 마지막 설문까지 마친 뒤 화면의 **`실험 종료` 버튼**을 눌러 주세요. 그럼 시작하겠습니다."

---

## 3. 실험 중 실험자 체크리스트

- [ ] 올바른 URL 로 진입했는지 확인: 쿼리의 `variant` / `participant=human` / `pid` 가 배정표와 일치.
- [ ] intro 식별 입력값이 배정표와 일치하는지 확인(개인정보 미입력 재확인).
- [ ] 흐름 진행 관찰: intro → experiment → explore(`/a` 또는 `/b`) → 최종 선택 → survey → complete 순으로 자연스럽게 진행되는지 확인.
- [ ] 막힘 발생 시 **개입 최소화**: 과제 내용·선택을 유도하지 않는다. 조작 방법 등 절차적 질문에만 중립적으로 응답.
- [ ] survey(난이도/만족도/확신도) 응답 완료 확인.
- [ ] complete 화면에서 **`실험 종료` 버튼 클릭** 확인(미클릭 시 finish 로그 누락 → 제외 사유).

---

## 4. 실험 후 export 3종 저장

complete(`실험 종료` 클릭 후) 화면에서 export 한다.

- [ ] **`CSV 내려받기`**(`btn-export-csv`) 클릭 → `{pid}_export.json` + `{pid}_events.csv` + `{pid}_session.csv` 3종 동시 다운로드.
- [ ] (필요 시) **`로그 JSON 내려받기`**(`btn-export-json`) 로 추가 확보.
- [ ] 다운로드된 3종 파일을 `analysis/input/main/human/` 로 이동(원본 보존, 덮어쓰기·변형 금지).

### 파일명 규칙 (예: variant A, 1번 참가자)

| 종류 | 파일명 |
|---|---|
| export JSON | `human_A_001_export.json` |
| events CSV | `human_A_001_events.csv` |
| session CSV | `human_A_001_session.csv` |

- `pid` 가 곧 파일명 접두어(`{pid}_...`)다. variant B 는 `human_B_001_*`, 순번 증가 시 `human_A_002_*` 형식.
- 저장 위치: `analysis/input/main/human/`.

---

## 5. 누락 / 오류 제외 기준

아래 중 하나라도 해당하면 **제외 또는 재수집**한다.

- [ ] finish 미클릭(`실험 종료` 미클릭, `finished_at` 이 null) → 미완료 세션.
- [ ] 중도 이탈(흐름 중단, 완료 미도달).
- [ ] 잘못된 `variant` 또는 `pid` 진입(배정표 불일치).
- [ ] export 3종(`{pid}_export.json` / `{pid}_events.csv` / `{pid}_session.csv`) 중 하나라도 누락.

### 처리 절차

- **재수집 가능**(절차 오류 등): 동일 `pid` 로 조건을 바로잡아 다시 수집.
- **제외 확정**: 해당 산출물을 `analysis/input/main/human/` 가 아닌 `analysis/input/excluded/` 로 분리 이동.
- 제외 시 **비고 기록**: 참가자 식별(`pid`), 제외 사유(예: finish 미클릭 / 중도 이탈 / variant 불일치 / export 누락), 처리(제외 또는 재수집) 를 실험자 측 배정표·로그에 남긴다.

---

## 6. 세션 종료 후 확인

- [ ] `analysis/input/main/human/` 에 이번 세션 3종 파일이 정상 저장되었는지 확인.
- [ ] 배정표에 `pid` ↔ `variant` ↔ 수집/제외/재수집 상태 기록.
- [ ] 다음 참가자용 `pid`·`variant` 준비, 브라우저 incognito 창 재초기화.
